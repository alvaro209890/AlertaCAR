/**
 * Fase 9.3 — Webhooks: dispara POST assinado (HMAC-SHA256) quando surge um novo alerta,
 * para integrar com outros sistemas do consultor. Disparo é best-effort (fire-and-forget):
 * uma falha de webhook nunca deve impedir o salvamento do alerta em si.
 */
import crypto from 'node:crypto'
import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'

export type WebhookEvent = 'alert.created'

export interface WebhookSummary {
  id: string
  url: string
  events: WebhookEvent[]
  active: boolean
  lastStatus: number | null
  lastTriggeredAt: string | null
  createdAt: string
}

export interface NewAlertWebhookPayload {
  id: string
  carId: string
  carNumber: string
  source: string
  classType: string | null
  title: string
  detectedDate: string
  areaHa: number | null
}

const WEBHOOK_TIMEOUT_MS = 10_000

export function createWebhook(userId: string, url: string, events: WebhookEvent[] = ['alert.created']) {
  const id = uuid()
  const secret = crypto.randomBytes(24).toString('hex')
  db.prepare(
    `INSERT INTO webhooks (id, user_id, url, secret, events_json) VALUES (?, ?, ?, ?, ?)`,
  ).run(id, userId, url, secret, JSON.stringify(events))
  return { id, url, secret, events }
}

export function listWebhooks(userId: string): WebhookSummary[] {
  const rows = db
    .prepare(
      `SELECT id, url, events_json, active, last_status, last_triggered_at, created_at
       FROM webhooks WHERE user_id = ? ORDER BY created_at DESC`,
    )
    .all(userId) as any[]
  return rows.map((r) => ({
    id: r.id,
    url: r.url,
    events: JSON.parse(r.events_json),
    active: !!r.active,
    lastStatus: r.last_status,
    lastTriggeredAt: r.last_triggered_at,
    createdAt: r.created_at,
  }))
}

export function deleteWebhook(userId: string, webhookId: string): boolean {
  const result = db.prepare(`DELETE FROM webhooks WHERE id = ? AND user_id = ?`).run(webhookId, userId)
  return result.changes > 0
}

export function setWebhookActive(userId: string, webhookId: string, active: boolean): boolean {
  const result = db
    .prepare(`UPDATE webhooks SET active = ? WHERE id = ? AND user_id = ?`)
    .run(active ? 1 : 0, webhookId, userId)
  return result.changes > 0
}

/** Dispara (fire-and-forget) o evento alert.created para todos os webhooks ativos do usuário. */
export function dispatchNewAlertWebhooks(userId: string, payload: NewAlertWebhookPayload): void {
  const hooks = db
    .prepare(`SELECT id, url, secret, events_json FROM webhooks WHERE user_id = ? AND active = 1`)
    .all(userId) as any[]

  const relevant = hooks.filter((h) => (JSON.parse(h.events_json) as string[]).includes('alert.created'))
  if (!relevant.length) return

  const body = JSON.stringify({ event: 'alert.created', data: payload })

  for (const hook of relevant) {
    const signature = crypto.createHmac('sha256', hook.secret).update(body).digest('hex')
    fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-AlertaCAR-Signature': `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(WEBHOOK_TIMEOUT_MS),
    })
      .then((res) => {
        db.prepare(`UPDATE webhooks SET last_status = ?, last_triggered_at = datetime('now') WHERE id = ?`).run(
          res.status,
          hook.id,
        )
      })
      .catch((err) => {
        console.error(`[webhooks] Falha ao notificar ${hook.url}:`, err?.message || err)
        db.prepare(`UPDATE webhooks SET last_status = -1, last_triggered_at = datetime('now') WHERE id = ?`).run(hook.id)
      })
  }
}
