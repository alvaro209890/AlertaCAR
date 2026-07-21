import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/

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

export default router
