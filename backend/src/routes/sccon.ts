import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/auth.js'
import { checkCar, checkAllActiveCars, ALERT_CLASSES } from '../services/sccon.js'
import { startCronMonitor, stopCronMonitor } from '../cron/monitor.js'
import db from '../db/connection.js'

const router = Router()

// GET /api/sccon/config — Classes de alerta disponíveis
router.get('/config', (_req, res) => {
  res.json({ classes: ALERT_CLASSES })
})

// POST /api/sccon/check/:carId — Forçar verificação manual de um CAR
router.post('/check/:carId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.carId

    // Verificar que o CAR pertence ao usuário
    const car = db.prepare(
      'SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1'
    ).get(carId, userId) as any

    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    console.log(`[sccon] Check manual: CAR ${carId} por usuário ${userId}`)
    const result = await checkCar(carId)

    res.json(result)
  } catch (err: any) {
    console.error('[sccon] Erro no check manual:', err)
    res.status(500).json({ error: 'Erro ao verificar alertas' })
  }
})

// POST /api/sccon/check-all — Admin: força verificação de todos os CARs
router.post('/check-all', requireAuth, requireAdmin, async (_req: AuthRequest, res) => {
  try {
    console.log('[sccon] Check-all iniciado pelo admin')
    const result = await checkAllActiveCars()
    res.json(result)
  } catch (err: any) {
    console.error('[sccon] Erro no check-all:', err)
    res.status(500).json({ error: 'Erro ao verificar todos os CARs' })
  }
})

// GET /api/sccon/logs — Logs de execução do cron
router.get('/logs', requireAuth, requireAdmin, (_req: AuthRequest, res) => {
  try {
    const logs = db.prepare(
      'SELECT * FROM cron_logs ORDER BY started_at DESC LIMIT 20'
    ).all()

    res.json({ logs })
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar logs' })
  }
})

// POST /api/sccon/cron/start — Admin: iniciar cron
router.post('/cron/start', requireAuth, requireAdmin, (_req: AuthRequest, res) => {
  try {
    startCronMonitor()
    res.json({ message: 'Cron iniciado — monitoramento diário às 06:00' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

// POST /api/sccon/cron/stop — Admin: parar cron
router.post('/cron/stop', requireAuth, requireAdmin, (_req: AuthRequest, res) => {
  try {
    stopCronMonitor()
    res.json({ message: 'Cron parado' })
  } catch (err: any) {
    res.status(500).json({ error: err.message })
  }
})

export default router
