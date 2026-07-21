/**
 * Fase 9.1 — Agendamento de relatórios (Fase 8/9). Gera o PDF automaticamente na frequência
 * configurada e cria um link de compartilhamento (72h) pronto para download. A ENTREGA por
 * Email/WhatsApp fica para a Fase 10 — por ora o consultor baixa pelo link no dashboard.
 */
import crypto from 'node:crypto'
import cron from 'node-cron'
import { v4 as uuid } from 'uuid'
import db from '../db/connection.js'

let reportsTask: cron.ScheduledTask | null = null

const FREQUENCY_MS: Record<string, number> = {
  weekly: 7 * 24 * 3_600_000,
  monthly: 30 * 24 * 3_600_000,
}

function isDue(schedule: { frequency: string; last_run_at: string | null }): boolean {
  if (!schedule.last_run_at) return true
  const elapsed = Date.now() - new Date(schedule.last_run_at).getTime()
  return elapsed >= FREQUENCY_MS[schedule.frequency]
}

export async function runReportSchedules(): Promise<{ generated: number; errors: number }> {
  const schedules = db.prepare('SELECT * FROM report_schedules WHERE active = 1').all() as any[]
  let generated = 0
  let errors = 0

  for (const schedule of schedules) {
    if (!isDue(schedule)) continue
    try {
      if (schedule.scope === 'car' && schedule.car_id) {
        const car = db.prepare('SELECT id FROM cars WHERE id = ? AND active = 1').get(schedule.car_id) as any
        if (!car) continue
      }

      // O PDF em si não é gerado nem persistido aqui — fica pra quando o link for aberto
      // (mesma rota pública usada pelo compartilhamento manual), evitando computar um PDF
      // que talvez nunca seja baixado.
      const token = crypto.randomBytes(20).toString('hex')
      const expiresAt = new Date(Date.now() + 72 * 3_600_000).toISOString()
      db.prepare(
        `INSERT INTO report_shares (id, token, user_id, report_type, car_id, expires_at) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(uuid(), token, schedule.user_id, schedule.scope === 'car' ? 'laudo' : 'portfolio', schedule.car_id || null, expiresAt)

      db.prepare(
        `INSERT INTO report_files (id, schedule_id, user_id, report_type, car_id, share_token) VALUES (?, ?, ?, ?, ?, ?)`,
      ).run(uuid(), schedule.id, schedule.user_id, schedule.scope === 'car' ? 'laudo' : 'portfolio', schedule.car_id || null, token)

      db.prepare(`UPDATE report_schedules SET last_run_at = datetime('now') WHERE id = ?`).run(schedule.id)
      generated++
    } catch (err: any) {
      console.error(`[cron-reports] Erro ao gerar relatório do agendamento ${schedule.id}:`, err?.message)
      errors++
    }
  }

  return { generated, errors }
}

export function startReportSchedulesCron(): void {
  // Diário às 07:00 (GMT-3), depois do monitoramento das 06:00.
  reportsTask = cron.schedule(
    '0 10 * * *',
    () => {
      runReportSchedules()
        .then(({ generated, errors }) => console.log(`[cron-reports] ${generated} relatório(s) gerado(s), ${errors} erro(s)`))
        .catch((err) => console.error('[cron-reports] Falha:', err?.message))
    },
    { timezone: 'America/Sao_Paulo' },
  )
  console.log('[cron-reports] Agendamento de relatórios agendado para 07:00 (GMT-3)')
}

export function stopReportSchedulesCron(): void {
  if (reportsTask) {
    reportsTask.stop()
    console.log('[cron-reports] Agendamento de relatórios parado')
  }
}
