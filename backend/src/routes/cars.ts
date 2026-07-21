import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'
import { fetchCarPolygon } from '../services/wfs-sema.js'

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

// GET /api/cars — Listar CARs do usuário
router.get('/', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id

    const cars = db.prepare(`
      SELECT c.*, 
        (SELECT COUNT(*) FROM alerts a WHERE a.car_id = c.id) as alert_count,
        (SELECT COUNT(*) FROM alerts a WHERE a.car_id = c.id AND a.sent_to_whatsapp = 0) as unread_alerts
      FROM cars c
      WHERE c.user_id = ? AND c.active = 1
      ORDER BY c.created_at DESC
    `).all(userId) as any[]

    res.json({
      cars: cars.map(formatCar),
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

    res.json({
      car: formatCar(car),
      alerts: alerts.map(formatAlert),
    })
  } catch (err: any) {
    console.error('[cars] GET/:id error:', err)
    res.status(500).json({ error: 'Erro ao buscar CAR' })
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
function formatCar(row: any) {
  return {
    id: row.id,
    carNumber: row.car_number,
    carNumberWfs: row.car_number_wfs,
    polygon: row.polygon_json ? JSON.parse(row.polygon_json) : null,
    areaHa: row.area_ha,
    municipality: row.municipality,
    alertCount: row.alert_count || 0,
    unreadAlerts: row.unread_alerts || 0,
    lastPolygonFetch: row.last_polygon_fetch,
    lastCheckAt: row.last_check_at,
    active: row.active,
    createdAt: row.created_at,
  }
}

function formatAlert(row: any) {
  return {
    id: row.id,
    carId: row.car_id,
    source: row.source,
    sourceId: row.source_id,
    classType: row.class_type,
    title: row.title,
    description: row.description,
    detectedDate: row.detected_date,
    areaHa: row.area_ha,
    geometry: row.geometry_json ? JSON.parse(row.geometry_json) : null,
    sentToWhatsapp: row.sent_to_whatsapp,
    sentAt: row.sent_at,
    createdAt: row.created_at,
  }
}

export default router
