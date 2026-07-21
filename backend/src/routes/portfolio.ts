import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { checkCar } from '../services/sccon.js'
import { monitorCarMultilayer } from '../services/car-monitor.js'
import { buildExport, type ExportFormat, type ExportLayer } from '../services/gis-export.js'

const router = Router()
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/
const VALID_EXPORT_FORMATS: ExportFormat[] = ['geojson', 'kml', 'kmz', 'shp', 'csv', 'gpkg']

router.use(requireAuth)

// GET /api/portfolio — catálogo do usuário para organizar a carteira.
router.get('/', (req: AuthRequest, res) => {
  const userId = req.user!.id
  const clients = db.prepare(`SELECT c.id, c.name, c.color, COUNT(cars.id) AS car_count
    FROM portfolio_clients c LEFT JOIN cars ON cars.client_id = c.id AND cars.active = 1
    WHERE c.user_id = ? GROUP BY c.id ORDER BY c.name COLLATE NOCASE`).all(userId) as any[]
  const tags = db.prepare(`SELECT t.id, t.name, t.color, COUNT(l.car_id) AS car_count
    FROM portfolio_tags t LEFT JOIN car_tag_links l ON l.tag_id = t.id
    WHERE t.user_id = ? GROUP BY t.id ORDER BY t.name COLLATE NOCASE`).all(userId) as any[]
  res.json({ clients: clients.map(formatItem), tags: tags.map(formatItem) })
})

router.post('/clients', (req: AuthRequest, res) => createItem(req, res, 'portfolio_clients', '#10b981'))
router.post('/tags', (req: AuthRequest, res) => createItem(req, res, 'portfolio_tags', '#64748b'))

function createItem(req: AuthRequest, res: any, table: 'portfolio_clients' | 'portfolio_tags', fallbackColor: string) {
  const name = typeof req.body?.name === 'string' ? req.body.name.trim().slice(0, 100) : ''
  const color = typeof req.body?.color === 'string' && HEX_COLOR.test(req.body.color) ? req.body.color : fallbackColor
  if (!name) return void res.status(400).json({ error: 'Nome é obrigatório' })
  try {
    const id = uuid()
    db.prepare(`INSERT INTO ${table} (id, user_id, name, color) VALUES (?, ?, ?, ?)`).run(id, req.user!.id, name, color)
    res.status(201).json({ item: { id, name, color, carCount: 0 } })
  } catch (error: any) {
    if (String(error?.message).includes('UNIQUE')) return void res.status(409).json({ error: 'Já existe um item com este nome' })
    console.error('[portfolio] create error:', error)
    res.status(500).json({ error: 'Erro ao criar item da carteira' })
  }
}

function formatItem(row: any) {
  return { id: row.id, name: row.name, color: row.color, carCount: row.car_count || 0 }
}

// GET /api/portfolio/analytics — Fase 8.3: dashboard analítico da carteira
router.get('/analytics', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const cars = db.prepare('SELECT id, area_ha, municipality FROM cars WHERE user_id = ? AND active = 1').all(userId) as any[]
    const totalAreaHa = cars.reduce((sum, c) => sum + (c.area_ha || 0), 0)

    if (!cars.length) {
      res.json({ totalAreaHa: 0, totalImoveis: 0, alertsByClass: [], alertsByMunicipality: [], monthlyTrend: [] })
      return
    }

    const carIds = cars.map((c) => c.id)
    const placeholders = carIds.map(() => '?').join(',')
    const carMunicipality = new Map(cars.map((c) => [c.id, c.municipality || 'Não informado']))

    const alertsByClass = db
      .prepare(`SELECT class_type as classType, COUNT(*) as count FROM alerts WHERE car_id IN (${placeholders}) GROUP BY class_type ORDER BY count DESC LIMIT 12`)
      .all(...carIds) as any[]

    const alertCarRows = db.prepare(`SELECT car_id FROM alerts WHERE car_id IN (${placeholders})`).all(...carIds) as any[]
    const byMunicipality = new Map<string, number>()
    for (const row of alertCarRows) {
      const key = carMunicipality.get(row.car_id) || 'Não informado'
      byMunicipality.set(key, (byMunicipality.get(key) || 0) + 1)
    }
    const alertsByMunicipality = [...byMunicipality.entries()]
      .map(([municipality, count]) => ({ municipality, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const monthlyTrend = db
      .prepare(
        `SELECT strftime('%Y-%m', detected_date) as month, COUNT(*) as count
         FROM alerts WHERE car_id IN (${placeholders}) AND detected_date >= date('now', '-12 months')
         GROUP BY month ORDER BY month`,
      )
      .all(...carIds) as any[]

    res.json({
      totalAreaHa: Number(totalAreaHa.toFixed(2)),
      totalImoveis: cars.length,
      alertsByClass,
      alertsByMunicipality,
      monthlyTrend,
    })
  } catch (err: any) {
    console.error('[portfolio] analytics error:', err)
    res.status(500).json({ error: 'Erro ao gerar analytics da carteira' })
  }
})

// POST /api/portfolio/bulk-check — Fase 8.3: verifica (SCCON + SEMA multicamada) os CARs selecionados
router.post('/bulk-check', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carIds = Array.isArray(req.body?.carIds)
      ? [...new Set(req.body.carIds.filter((id: unknown) => typeof id === 'string'))].slice(0, 50)
      : []
    if (!carIds.length) {
      res.status(400).json({ error: 'Informe ao menos um CAR (máx. 50)' })
      return
    }

    const results: Array<{ carId: string; alertsNew?: number; alertsFound?: number; semaNewAlerts?: number; error?: string }> = []
    for (const carId of carIds as string[]) {
      const car = db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId)
      if (!car) {
        results.push({ carId, error: 'CAR não encontrado' })
        continue
      }
      try {
        const [sccon, sema] = await Promise.all([checkCar(carId), monitorCarMultilayer(carId)])
        results.push({ carId, alertsNew: sccon.alertsNew, alertsFound: sccon.alertsFound, semaNewAlerts: sema.totalNewAlerts })
      } catch (err: any) {
        results.push({ carId, error: err?.message || 'Erro ao verificar' })
      }
    }

    res.json({ results })
  } catch (err: any) {
    console.error('[portfolio] bulk-check error:', err)
    res.status(500).json({ error: 'Erro na verificação em massa' })
  }
})

// GET /api/portfolio/export?format=&carIds= — Fase 8.3/9.2: exportação em massa (todos os CARs ou selecionados)
router.get('/export', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const format = String(req.query.format || 'geojson').toLowerCase()
    if (!(VALID_EXPORT_FORMATS as string[]).includes(format)) {
      res.status(400).json({ error: `Formato inválido. Use: ${VALID_EXPORT_FORMATS.join(', ')}` })
      return
    }

    const carIdsParam = req.query.carIds ? String(req.query.carIds).split(',').filter(Boolean) : null
    const cars = carIdsParam?.length
      ? (db
          .prepare(`SELECT * FROM cars WHERE user_id = ? AND active = 1 AND id IN (${carIdsParam.map(() => '?').join(',')})`)
          .all(userId, ...carIdsParam) as any[])
      : (db.prepare('SELECT * FROM cars WHERE user_id = ? AND active = 1').all(userId) as any[])

    const layers: ExportLayer[] = cars
      .filter((c) => c.polygon_json)
      .map((c) => ({
        key: c.car_number,
        label: c.nickname || c.car_number,
        features: [
          {
            geometry: JSON.parse(c.polygon_json),
            properties: {
              carNumber: c.car_number,
              nickname: c.nickname || null,
              municipality: c.municipality || null,
              areaHa: c.area_ha,
              bioma: c.bioma || null,
            },
          },
        ],
      }))

    if (!layers.length) {
      res.status(404).json({ error: 'Nenhum CAR com polígono para exportar' })
      return
    }

    const result = await buildExport(format as ExportFormat, layers, 'carteira')
    res.setHeader('Content-Type', result.contentType)
    res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
    res.send(result.buffer)
  } catch (err: any) {
    console.error('[portfolio] export error:', err)
    res.status(500).json({ error: 'Erro na exportação em massa' })
  }
})

export default router
