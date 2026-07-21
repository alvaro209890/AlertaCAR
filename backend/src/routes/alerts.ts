import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'
import { computeSeverity, isValidAlertStatus } from '../lib/severity.js'

const router = Router()

router.use(requireAuth)

// GET /api/cars/:id/alerts — Timeline completa com filtros (Fase 5.4)
router.get('/cars/:carId/alerts', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.carId

    const car = db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId) as any
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    const { source, status, classType } = req.query as Record<string, string | undefined>
    const limit = Math.min(200, Math.max(1, parseInt(String(req.query.limit || '50'), 10) || 50))
    const offset = Math.max(0, parseInt(String(req.query.offset || '0'), 10) || 0)

    const conditions: string[] = ['car_id = ?']
    const params: any[] = [carId]
    if (source) {
      conditions.push('source = ?')
      params.push(source)
    }
    if (status) {
      conditions.push('status = ?')
      params.push(status)
    }
    if (classType) {
      conditions.push('class_type = ?')
      params.push(classType)
    }
    const whereClause = conditions.join(' AND ')

    const total = (db.prepare(`SELECT COUNT(*) as count FROM alerts WHERE ${whereClause}`).get(...params) as any).count

    const rows = db
      .prepare(`SELECT * FROM alerts WHERE ${whereClause} ORDER BY detected_date DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as any[]

    res.json({ alerts: rows.map(formatAlertWithSeverity), total, limit, offset })
  } catch (err: any) {
    console.error('[alerts] GET error:', err)
    res.status(500).json({ error: 'Erro ao listar alertas' })
  }
})

// PATCH /api/alerts/:id — Triagem: atualizar status e/ou notas (Fase 5.4)
router.patch('/alerts/:id', (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const alertId = req.params.id
    const { status, notes } = req.body as { status?: string; notes?: string }

    const alert = db.prepare('SELECT id FROM alerts WHERE id = ? AND user_id = ?').get(alertId, userId) as any
    if (!alert) {
      res.status(404).json({ error: 'Alerta não encontrado' })
      return
    }

    if (status !== undefined && !isValidAlertStatus(status)) {
      res.status(400).json({ error: 'Status inválido' })
      return
    }

    if (status !== undefined) {
      db.prepare('UPDATE alerts SET status = ? WHERE id = ?').run(status, alertId)
    }
    if (notes !== undefined) {
      db.prepare('UPDATE alerts SET notes = ? WHERE id = ?').run(notes, alertId)
    }

    const updated = db.prepare('SELECT * FROM alerts WHERE id = ?').get(alertId) as any
    res.json({ alert: formatAlertWithSeverity(updated) })
  } catch (err: any) {
    console.error('[alerts] PATCH error:', err)
    res.status(500).json({ error: 'Erro ao atualizar alerta' })
  }
})

export function formatAlertWithSeverity(row: any) {
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
    status: row.status || 'novo',
    notes: row.notes || null,
    severity: computeSeverity(row.class_type, row.area_ha || 0),
    createdAt: row.created_at,
  }
}

export default router
