/**
 * Fase 9.3 — API Key por usuário para acesso programático (QGIS/ArcGIS/scripts).
 * A chave em texto puro só existe no momento da criação; só o hash SHA-256 é persistido.
 */
import crypto from 'node:crypto'
import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'

const KEY_PREFIX = 'alertacar_live_'

export interface ApiKeySummary {
  id: string
  label: string
  keyPrefix: string
  lastUsedAt: string | null
  createdAt: string
  revoked: boolean
}

export interface AuthenticatedUser {
  id: string
  email: string
  role: string
}

function hashKey(plaintext: string): string {
  return crypto.createHash('sha256').update(plaintext).digest('hex')
}

export function createApiKey(userId: string, label: string): { id: string; key: string; label: string } {
  const rawSuffix = crypto.randomBytes(24).toString('hex')
  const key = `${KEY_PREFIX}${rawSuffix}`
  const id = uuid()
  const keyPrefix = key.slice(0, KEY_PREFIX.length + 8)

  db.prepare(
    `INSERT INTO api_keys (id, user_id, key_hash, key_prefix, label) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, userId, hashKey(key), keyPrefix, label.trim().slice(0, 100) || 'Sem nome')

  return { id, key, label }
}

export function listApiKeys(userId: string): ApiKeySummary[] {
  const rows = db
    .prepare(
      `SELECT id, label, key_prefix, last_used_at, revoked_at, created_at FROM api_keys
       WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId) as any[]
  return rows.map((r) => ({
    id: r.id,
    label: r.label,
    keyPrefix: r.key_prefix,
    lastUsedAt: r.last_used_at,
    createdAt: r.created_at,
    revoked: !!r.revoked_at,
  }))
}

export function revokeApiKey(userId: string, keyId: string): boolean {
  const result = db
    .prepare(`UPDATE api_keys SET revoked_at = datetime('now') WHERE id = ? AND user_id = ? AND revoked_at IS NULL`)
    .run(keyId, userId)
  return result.changes > 0
}

/** Valida uma API key em texto puro e retorna o usuário associado (ou null). Atualiza last_used_at. */
export function authenticateApiKey(plaintext: string): AuthenticatedUser | null {
  if (!plaintext.startsWith(KEY_PREFIX)) return null
  const hash = hashKey(plaintext)
  const row = db
    .prepare(
      `SELECT ak.id as key_id, u.id as user_id, u.email, u.role FROM api_keys ak
       JOIN users u ON u.id = ak.user_id
       WHERE ak.key_hash = ? AND ak.revoked_at IS NULL AND u.active = 1`,
    )
    .get(hash) as any
  if (!row) return null

  db.prepare(`UPDATE api_keys SET last_used_at = datetime('now') WHERE id = ?`).run(row.key_id)
  return { id: row.user_id, email: row.email, role: row.role }
}
