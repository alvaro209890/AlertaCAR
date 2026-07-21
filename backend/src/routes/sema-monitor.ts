import { Router } from 'express'
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js'
import { monitorCarMultilayer, monitorAllCarsMultilayer } from '../services/car-monitor.js'
import db from '../db/connection.js'

const router = Router()

// POST /api/sema-monitor/check/:carId — Forçar verificação multicamada (Fase 4) de um CAR
router.post('/check/:carId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.carId

    const car = db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId) as any
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    const result = await monitorCarMultilayer(carId)
    res.json(result)
  } catch (err: any) {
    console.error('[sema-monitor] Erro no check manual:', err)
    res.status(500).json({ error: 'Erro ao verificar fontes SEMA' })
  }
})

// POST /api/sema-monitor/check-all — Admin: força verificação multicamada de todos os CARs
router.post('/check-all', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    const result = await monitorAllCarsMultilayer()
    res.json(result)
  } catch (err: any) {
    console.error('[sema-monitor] Erro no check-all:', err)
    res.status(500).json({ error: 'Erro ao verificar todos os CARs' })
  }
})

export default router
