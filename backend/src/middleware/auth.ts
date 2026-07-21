import type { Request, Response, NextFunction } from 'express'
import { verifyToken } from '../lib/jwt.js'
import { authenticateApiKey } from '../services/api-keys.js'

export interface AuthRequest extends Request {
  user?: { id: string; email: string; role: string }
}

/**
 * Aceita tanto o JWT da sessão (Bearer <jwt>) quanto uma API Key (Fase 9.3, geradas em
 * /api/interop/api-keys) — via Bearer <key> ou header X-Api-Key — para acesso programático
 * (QGIS/ArcGIS/scripts) sem precisar fazer login.
 */
export function requireAuth(req: AuthRequest, res: Response, next: NextFunction) {
  const header = req.headers.authorization
  const bearerToken = header?.startsWith('Bearer ') ? header.slice(7) : null
  const apiKeyHeader = typeof req.headers['x-api-key'] === 'string' ? req.headers['x-api-key'] : null

  if (bearerToken) {
    const payload = verifyToken(bearerToken)
    if (payload) {
      req.user = payload
      next()
      return
    }
    const apiUser = authenticateApiKey(bearerToken)
    if (apiUser) {
      req.user = apiUser
      next()
      return
    }
  }

  if (apiKeyHeader) {
    const apiUser = authenticateApiKey(apiKeyHeader)
    if (apiUser) {
      req.user = apiUser
      next()
      return
    }
  }

  res.status(401).json({ error: 'Token não fornecido ou inválido' })
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Acesso restrito a administradores' })
    return
  }
  next()
}
