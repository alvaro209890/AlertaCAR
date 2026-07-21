import cron from 'node-cron'
import db from '../db/connection.js'
import { checkAllActiveCars } from '../services/sccon.js'
import { monitorAllCarsMultilayer } from '../services/car-monitor.js'

let monitorTask: cron.ScheduledTask | null = null

/** Roda SCCON + Fase 4 (SEMA multicamada) para todos os CARs ativos e grava o log do cron. */
export async function runDailyMonitor(): Promise<void> {
  console.log('[cron] Iniciando monitoramento diário (SCCON + SEMA multicamada)...')

  const logId = db.prepare(`
    INSERT INTO cron_logs (started_at, status) VALUES (datetime('now'), 'running')
  `).run().lastInsertRowid

  try {
    const scconResult = await checkAllActiveCars()
    const semaResult = await monitorAllCarsMultilayer()

    const sourcesJson = JSON.stringify({
      sccon: { carsProcessed: scconResult.total, newAlerts: scconResult.totalNewAlerts, errors: scconResult.errors },
      semaMulticamada: { carsProcessed: semaResult.total, newAlerts: semaResult.totalNewAlerts, errors: semaResult.errors },
    })

    db.prepare(`
      UPDATE cron_logs
      SET finished_at = datetime('now'),
          cars_processed = ?,
          alerts_found = ?,
          alerts_sent = ?,
          errors = ?,
          sources_json = ?,
          status = 'completed'
      WHERE id = ?
    `).run(
      Math.max(scconResult.total, semaResult.total),
      scconResult.totalNewAlerts + semaResult.totalNewAlerts,
      0, // WhatsApp (Fase 10)
      scconResult.errors + semaResult.errors,
      sourcesJson,
      logId,
    )

    console.log(
      `[cron] Monitoramento concluído: ${scconResult.totalNewAlerts} alertas SCCON + ${semaResult.totalNewAlerts} alertas SEMA multicamada`,
    )
  } catch (err: any) {
    console.error('[cron] Erro no monitoramento:', err.message)

    db.prepare(`
      UPDATE cron_logs
      SET finished_at = datetime('now'), status = 'error', errors = 1
      WHERE id = ?
    `).run(logId)
  }
}

export function startCronMonitor(): void {
  // Diário às 06:00 (horário de Brasília = UTC-3 → 09:00 UTC)
  monitorTask = cron.schedule('0 9 * * *', runDailyMonitor, {
    timezone: 'America/Sao_Paulo',
  })

  console.log('[cron] Monitoramento diário agendado para 06:00 (GMT-3)')
}

export function stopCronMonitor(): void {
  if (monitorTask) {
    monitorTask.stop()
    console.log('[cron] Monitoramento parado')
  }
}
