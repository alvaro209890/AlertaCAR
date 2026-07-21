import { Router } from 'express'
import { requireAuth, requireAdmin, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'

const router = Router()

// GET /api/admin/stats
router.get('/stats', requireAuth, requireAdmin, (_req: AuthRequest, res) => {
  try {
    const users = db.prepare('SELECT COUNT(*) as count FROM users WHERE active = 1').get() as any
    const cars = db.prepare('SELECT COUNT(*) as count FROM cars WHERE active = 1').get() as any
    const alerts = db.prepare('SELECT COUNT(*) as count FROM alerts').get() as any
    const whatsapp = db.prepare('SELECT connected FROM whatsapp_sessions WHERE id = ?').get('default') as any

    res.json({
      users: users?.count || 0,
      cars: cars?.count || 0,
      alerts: alerts?.count || 0,
      whatsapp: whatsapp?.connected ? 'Online' : 'Offline',
    })
  } catch (err: any) {
    res.status(500).json({ error: 'Erro ao buscar estatísticas' })
  }
})

export default router
