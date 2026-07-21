import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'
import { fetchCarPolygon } from '../services/wfs-sema.js'
import { formatAlertWithSeverity } from './alerts.js'

const router = Router()

// Todas as rotas exigem autenticação
router.use(requireAuth)

// POST /api/cars — Adicionar CAR para monitoramento
router.post('/', async (req: AuthRequest, res) => {
  try {
    const { carNumber } = req.body
    const userId = req.user!.id

    if (!carNumber || typeof carNumber !== 'string' || carNumber.trim().length < 3) {
      res.status(400).json({ error: 'Número do CAR inválido. Ex: MT271442/2017 ou 271442' })
      return
    }

    const cleaned = carNumber.trim()

    // Verificar duplicado
    const existing = db.prepare(
      'SELECT id FROM cars WHERE user_id = ? AND car_number = ? AND active = 1'
    ).get(userId, cleaned) as any

    if (existing) {
      res.status(409).json({ error: 'Este CAR já está sendo monitorado' })
      return
    }

    // Buscar polígono do WFS
    console.log(`[cars] Buscando WFS para: ${cleaned}`)
    const polygon = await fetchCarPolygon(cleaned)

    const id = uuid()
    
    db.prepare(`
      INSERT INTO cars (id, user_id, car_number, car_number_wfs, polygon_json, area_ha, municipality)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      userId,
      cleaned,
      polygon?.carNumberWfs || null,
      polygon ? JSON.stringify(polygon.geometry) : null,
      polygon?.areaHa || null,
      polygon?.municipality || null,
    )

    // Se encontrou polígono, atualiza o cache
    if (polygon) {
      const cacheStmt = db.prepare(`
        UPDATE cars 
        SET last_polygon_fetch = datetime('now'),
            polygon_json = ?,
            area_ha = ?,
            municipality = ?
        WHERE id = ?
      `)
      cacheStmt.run(JSON.stringify(polygon.geometry), polygon.areaHa, polygon.municipality, id)
    }

    const car = db.prepare('SELECT * FROM cars WHERE id = ?').get(id) as any

    res.status(201).json({
      car: formatCar(car),
      polygonFound: !!polygon,
      message: polygon
        ? 'CAR cadastrado com sucesso! Polígono encontrado.'
        : 'CAR cadastrado, mas o polígono não foi encontrado no WFS da SEMA. O monitoramento por alertas SCCON ainda funciona.',
    })
  } catch (err: any) {
    console.error('[cars] POST error:', err)
    res.status(500).json({ error: 'Erro ao cadastrar CAR' })
  }
})

interface BulkImportRow {
  carNumber: string
  nickname?: string | null
  clientName?: string | null
  tags?: string[]
}

interface BulkImportResult {
  carNumber: string
  success: boolean
  polygonFound: boolean
  error?: string
}

/** Cria um único CAR (com organização opcional) dentro de um lote — reusa a lógica de POST /. */
async function importOneCar(userId: string, row: BulkImportRow): Promise<BulkImportResult> {
  const carNumber = row.carNumber.trim()
  try {
    const existing = db
      .prepare('SELECT id FROM cars WHERE user_id = ? AND car_number = ? AND active = 1')
      .get(userId, carNumber)
    if (existing) return { carNumber, success: false, polygonFound: false, error: 'Já monitorado' }

    const polygon = await fetchCarPolygon(carNumber)
    const id = uuid()
    db.prepare(
      `INSERT INTO cars (id, user_id, car_number, car_number_wfs, polygon_json, area_ha, municipality, nickname)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).run(
      id,
      userId,
      carNumber,
      polygon?.carNumberWfs || null,
      polygon ? JSON.stringify(polygon.geometry) : null,
      polygon?.areaHa || null,
      polygon?.municipality || null,
      row.nickname?.trim().slice(0, 100) || null,
    )

    if (row.clientName?.trim()) {
      const clientName = row.clientName.trim().slice(0, 100)
      const existingClient = db
        .prepare('SELECT id FROM portfolio_clients WHERE user_id = ? AND name = ?')
        .get(userId, clientName) as any
      const clientId = existingClient?.id || uuid()
      if (!existingClient) {
        db.prepare('INSERT INTO portfolio_clients (id, user_id, name) VALUES (?, ?, ?)').run(clientId, userId, clientName)
      }
      db.prepare('UPDATE cars SET client_id = ? WHERE id = ?').run(clientId, id)
    }

    for (const tagNameRaw of row.tags || []) {
      const tagName = tagNameRaw.trim().slice(0, 100)
      if (!tagName) continue
      const existingTag = db.prepare('SELECT id FROM portfolio_tags WHERE user_id = ? AND name = ?').get(userId, tagName) as any
      const tagId = existingTag?.id || uuid()
      if (!existingTag) {
        db.prepare('INSERT INTO portfolio_tags (id, user_id, name) VALUES (?, ?, ?)').run(tagId, userId, tagName)
      }
      db.prepare('INSERT OR IGNORE INTO car_tag_links (car_id, tag_id) VALUES (?, ?)').run(id, tagId)
    }

    return { carNumber, success: true, polygonFound: !!polygon }
  } catch (err: any) {
    return { carNumber, success: false, polygonFound: false, error: err?.message || 'Erro desconhecido' }
  }
}

// POST /api/cars/bulk-import — Fase 8.2: cola lista de nº de CAR (um por linha) → cria vários
router.post('/bulk-import', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const raw = req.body?.carNumbers
    const list: string[] = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/\r?\n/) : []
    const cleaned = [...new Set(list.map((s) => String(s).trim()).filter((s) => s.length >= 3))].slice(0, 50)

    if (!cleaned.length) {
      res.status(400).json({ error: 'Informe ao menos um número de CAR válido (um por linha, máx. 50)' })
      return
    }

    const results: BulkImportResult[] = []
    for (const carNumber of cleaned) {
      results.push(await importOneCar(userId, { carNumber }))
    }

    res.status(201).json({ results, total: results.length, imported: results.filter((r) => r.success).length })
  } catch (err: any) {
    console.error('[cars] bulk-import error:', err)
    res.status(500).json({ error: 'Erro na importação em massa' })
  }
})

// POST /api/cars/bulk-import-csv — Fase 8.2: CSV colado "nºCAR,apelido,cliente,tag1;tag2"
router.post('/bulk-import-csv', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const csv: string = typeof req.body?.csv === 'string' ? req.body.csv : ''
    if (!csv.trim()) {
      res.status(400).json({ error: 'CSV vazio' })
      return
    }

    const lines = csv.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
    // Pula o cabeçalho se a 1ª linha não começar com um número/MT (heurística simples).
    const dataLines = /^\s*(MT)?\d/i.test(lines[0] || '') ? lines : lines.slice(1)

    const rows: BulkImportRow[] = dataLines
      .slice(0, 50)
      .map((line) => {
        const [carNumber, nickname, clientName, tagsStr] = line.split(',').map((c) => c?.trim())
        return {
          carNumber: carNumber || '',
          nickname: nickname || null,
          clientName: clientName || null,
          tags: tagsStr ? tagsStr.split(';').map((t) => t.trim()).filter(Boolean) : [],
        }
      })
      .filter((r) => r.carNumber.length >= 3)

    if (!rows.length) {
      res.status(400).json({ error: 'Nenhuma linha válida (formato: nºCAR,apelido,cliente,tag1;tag2)' })
      return
    }

    const results: BulkImportResult[] = []
    for (const row of rows) {
      results.push(await importOneCar(userId, row))
    }

    res.status(201).json({ results, total: results.length, imported: results.filter((r) => r.success).length })
  } catch (err: any) {
    console.error('[cars] bulk-import-csv error:', err)
    res.status(500).json({ error: 'Erro na importação em massa via CSV' })
  }
})

// GET /api/cars — Listar CARs do usuário
router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id

    const cars = db.prepare(`
      SELECT c.*, 
        pc.id AS client_id, pc.name AS client_name, pc.color AS client_color,
        (SELECT COUNT(*) FROM alerts a WHERE a.car_id = c.id) as alert_count,
        (SELECT COUNT(*) FROM alerts a WHERE a.car_id = c.id AND a.sent_to_whatsapp = 0) as unread_alerts
      FROM cars c LEFT JOIN portfolio_clients pc ON pc.id = c.client_id
      WHERE c.user_id = ? AND c.active = 1
      ORDER BY c.created_at DESC
    `).all(userId) as any[]

    res.json({
      cars: cars.map((car) => formatCar(car, loadCarTags(car.id))),
      total: cars.length,
    })
  } catch (err: any) {
    console.error('[cars] GET error:', err)
    res.status(500).json({ error: 'Erro ao listar CARs' })
  }
})

// GET /api/cars/:id — Detalhes de um CAR
router.get('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.id

    const car = db.prepare(
      'SELECT * FROM cars WHERE id = ? AND user_id = ? AND active = 1'
    ).get(carId, userId) as any

    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    const alerts = db.prepare(`
      SELECT * FROM alerts WHERE car_id = ? ORDER BY detected_date DESC LIMIT 20
    `).all(carId) as any[]

    const layers = db.prepare(`
      SELECT layer_key, label, area_ha, feature_count, extra_json, updated_at
      FROM car_layers WHERE car_id = ? ORDER BY layer_key
    `).all(carId) as any[]

    const licenses = db.prepare(`
      SELECT tipo, numero_titulo, razao_social, data_aprovacao, data_vencimento, urgencia, updated_at
      FROM car_licenses WHERE car_id = ? ORDER BY data_vencimento
    `).all(carId) as any[]

    const sobreposicoes = db.prepare(`
      SELECT tipo, nome, intersection_ha, coverage_percent, updated_at
      FROM car_sobreposicoes WHERE car_id = ? ORDER BY coverage_percent DESC
    `).all(carId) as any[]

    res.json({
      car: formatCar(car, loadCarTags(car.id), loadClient(car.client_id)),
      alerts: alerts.map(formatAlertWithSeverity),
      layers: layers.map(formatLayer),
      licenses: licenses.map(formatLicense),
      sobreposicoes: sobreposicoes.map(formatSobreposicao),
      conformidade: {
        bioma: car.bioma || null,
        arlExigidaPercent: car.arl_exigida_percent ?? null,
        arlExigidaHa: car.arl_exigida_ha ?? null,
        arlDeclaradaHa: car.arl_declarada_ha ?? null,
        deficitArlHa: car.deficit_arl_ha ?? null,
        layersUpdatedAt: car.layers_updated_at || null,
      },
    })
  } catch (err: any) {
    console.error('[cars] GET/:id error:', err)
    res.status(500).json({ error: 'Erro ao buscar CAR' })
  }
})

// PATCH /api/cars/:id/portfolio — associa o imóvel a um cliente e tags do mesmo usuário.
router.patch('/:id/portfolio', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.id
    const car = db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId) as any
    if (!car) return void res.status(404).json({ error: 'CAR não encontrado' })

    const clientId = req.body?.clientId === null || req.body?.clientId === '' ? null : typeof req.body?.clientId === 'string' ? req.body.clientId : undefined
    const tagIds = Array.isArray(req.body?.tagIds) ? [...new Set(req.body.tagIds.filter((id: unknown) => typeof id === 'string'))] : undefined
    if (clientId === undefined || tagIds === undefined || tagIds.length > 20) return void res.status(400).json({ error: 'Cliente ou tags inválidos' })

    if (clientId) {
      const client = db.prepare('SELECT id FROM portfolio_clients WHERE id = ? AND user_id = ?').get(clientId, userId)
      if (!client) return void res.status(400).json({ error: 'Cliente inválido' })
    }
    if (tagIds.length) {
      const placeholders = tagIds.map(() => '?').join(', ')
      const count = (db.prepare(`SELECT COUNT(*) AS count FROM portfolio_tags WHERE user_id = ? AND id IN (${placeholders})`).get(userId, ...tagIds) as any).count
      if (count !== tagIds.length) return void res.status(400).json({ error: 'Uma ou mais tags são inválidas' })
    }

    db.transaction(() => {
      db.prepare('UPDATE cars SET client_id = ? WHERE id = ?').run(clientId, carId)
      db.prepare('DELETE FROM car_tag_links WHERE car_id = ?').run(carId)
      const insert = db.prepare('INSERT INTO car_tag_links (car_id, tag_id) VALUES (?, ?)')
      for (const tagId of tagIds) insert.run(carId, tagId)
    })()

    const updated = db.prepare('SELECT * FROM cars WHERE id = ?').get(carId) as any
    res.json({ car: formatCar(updated, loadCarTags(carId), loadClient(clientId)) })
  } catch (err: any) {
    console.error('[cars] PATCH portfolio error:', err)
    res.status(500).json({ error: 'Erro ao atualizar organização da carteira' })
  }
})

// PATCH /api/cars/:id — Atualizar apelido (Fase 5.5)
router.patch('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.id
    const { nickname } = req.body as { nickname?: string }

    const car = db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId) as any
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    if (nickname !== undefined) {
      const trimmed = String(nickname).trim().slice(0, 100)
      db.prepare('UPDATE cars SET nickname = ? WHERE id = ?').run(trimmed || null, carId)
    }

    const updated = db.prepare('SELECT * FROM cars WHERE id = ?').get(carId) as any
    res.json({ car: formatCar(updated) })
  } catch (err: any) {
    console.error('[cars] PATCH error:', err)
    res.status(500).json({ error: 'Erro ao atualizar CAR' })
  }
})

// DELETE /api/cars/:id — Soft delete do CAR
router.delete('/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.id

    const car = db.prepare(
      'SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1'
    ).get(carId, userId) as any

    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    db.prepare('UPDATE cars SET active = 0 WHERE id = ?').run(carId)

    res.json({ message: 'CAR removido do monitoramento' })
  } catch (err: any) {
    console.error('[cars] DELETE error:', err)
    res.status(500).json({ error: 'Erro ao remover CAR' })
  }
})

// PATCH /api/cars/:id/refresh — Forçar atualização do polígono
router.patch('/:id/refresh', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.id

    const car = db.prepare(
      'SELECT * FROM cars WHERE id = ? AND user_id = ? AND active = 1'
    ).get(carId, userId) as any

    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    console.log(`[cars] Atualizando polígono para: ${car.car_number}`)
    const polygon = await fetchCarPolygon(car.car_number)

    if (!polygon) {
      res.json({ message: 'Nenhum polígono encontrado no WFS', updated: false })
      return
    }

    db.prepare(`
      UPDATE cars 
      SET polygon_json = ?, area_ha = ?, municipality = ?, 
          car_number_wfs = ?, last_polygon_fetch = datetime('now')
      WHERE id = ?
    `).run(
      JSON.stringify(polygon.geometry),
      polygon.areaHa,
      polygon.municipality,
      polygon.carNumberWfs,
      carId,
    )

    const updated = db.prepare('SELECT * FROM cars WHERE id = ?').get(carId) as any

    res.json({
      car: formatCar(updated),
      message: 'Polígono atualizado com sucesso',
      updated: true,
    })
  } catch (err: any) {
    console.error('[cars] PATCH refresh error:', err)
    res.status(500).json({ error: 'Erro ao atualizar polígono' })
  }
})

// Helpers
function formatCar(row: any, tags = loadCarTags(row.id), client = loadClient(row.client_id)) {
  return {
    id: row.id,
    carNumber: row.car_number,
    carNumberWfs: row.car_number_wfs,
    nickname: row.nickname || null,
    polygon: row.polygon_json ? JSON.parse(row.polygon_json) : null,
    areaHa: row.area_ha,
    municipality: row.municipality,
    alertCount: row.alert_count || 0,
    unreadAlerts: row.unread_alerts || 0,
    lastPolygonFetch: row.last_polygon_fetch,
    lastCheckAt: row.last_check_at,
    client,
    tags,
    active: row.active,
    createdAt: row.created_at,
  }
}

function loadClient(clientId: string | null | undefined) {
  if (!clientId) return null
  const row = db.prepare('SELECT id, name, color FROM portfolio_clients WHERE id = ?').get(clientId) as any
  return row ? { id: row.id, name: row.name, color: row.color } : null
}

function loadCarTags(carId: string) {
  const rows = db.prepare(`SELECT t.id, t.name, t.color FROM portfolio_tags t
    JOIN car_tag_links l ON l.tag_id = t.id WHERE l.car_id = ? ORDER BY t.name COLLATE NOCASE`).all(carId) as any[]
  return rows.map((row) => ({ id: row.id, name: row.name, color: row.color }))
}

function formatLayer(row: any) {
  return {
    key: row.layer_key,
    label: row.label,
    areaHa: row.area_ha,
    featureCount: row.feature_count,
    extra: row.extra_json ? JSON.parse(row.extra_json) : null,
    updatedAt: row.updated_at,
  }
}

function formatLicense(row: any) {
  return {
    tipo: row.tipo,
    numeroTitulo: row.numero_titulo,
    razaoSocial: row.razao_social,
    dataAprovacao: row.data_aprovacao,
    dataVencimento: row.data_vencimento,
    urgencia: row.urgencia,
    updatedAt: row.updated_at,
  }
}

function formatSobreposicao(row: any) {
  return {
    tipo: row.tipo,
    nome: row.nome,
    intersectionHa: row.intersection_ha,
    coveragePercent: row.coverage_percent,
    updatedAt: row.updated_at,
  }
}

export default router
