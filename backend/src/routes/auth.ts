import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'
import { hashPassword, comparePassword, signToken } from '../lib/jwt.js'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'

const router = Router()

// POST /api/auth/register
router.post('/register', async (req, res) => {
  try {
    const { email, password, name, whatsapp } = req.body

    if (!email || !password || !name || !whatsapp) {
      res.status(400).json({ error: 'Todos os campos são obrigatórios: email, password, name, whatsapp' })
      return
    }

    if (password.length < 6) {
      res.status(400).json({ error: 'Senha deve ter no mínimo 6 caracteres' })
      return
    }

    // Verificar email único
    const existing = db.prepare('SELECT id FROM users WHERE email = ?').get(email)
    if (existing) {
      res.status(409).json({ error: 'Email já cadastrado' })
      return
    }

    const id = uuid()
    const passwordHash = await hashPassword(password)

    db.prepare(`
      INSERT INTO users (id, email, password_hash, name, whatsapp_number)
      VALUES (?, ?, ?, ?, ?)
    `).run(id, email, passwordHash, name, whatsapp)

    const token = signToken({ id, email, role: 'user' })

    res.status(201).json({
      token,
      user: { id, email, name, whatsapp_number: whatsapp, role: 'user' },
    })
  } catch (err: any) {
    console.error('[register]', err)
    res.status(500).json({ error: 'Erro interno ao registrar' })
  }
})

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body

    if (!email || !password) {
      res.status(400).json({ error: 'Email e senha são obrigatórios' })
      return
    }

    const user = db.prepare('SELECT * FROM users WHERE email = ? AND active = 1').get(email) as any
    if (!user) {
      res.status(401).json({ error: 'Email ou senha inválidos' })
      return
    }

    const valid = await comparePassword(password, user.password_hash)
    if (!valid) {
      res.status(401).json({ error: 'Email ou senha inválidos' })
      return
    }

    const token = signToken({ id: user.id, email: user.email, role: user.role })

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        whatsapp_number: user.whatsapp_number,
        role: user.role,
      },
    })
  } catch (err: any) {
    console.error('[login]', err)
    res.status(500).json({ error: 'Erro interno ao fazer login' })
  }
})

// GET /api/auth/me
router.get('/me', requireAuth, (req: AuthRequest, res) => {
  const user = db.prepare('SELECT id, email, name, whatsapp_number, role, created_at FROM users WHERE id = ?').get(req.user!.id) as any
  if (!user) {
    res.status(404).json({ error: 'Usuário não encontrado' })
    return
  }
  res.json({ user })
})

export default router
