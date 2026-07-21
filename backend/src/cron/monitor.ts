import cron from 'node-cron'
import db from '../db/connection.js'
import { checkAllActiveCars } from '../services/sccon.js'

let monitorTask: cron.ScheduledTask | null = null

export function startCronMonitor(): void {
  // Diário às 06:00 (horário de Brasília = UTC-3 → 09:00 UTC)
  monitorTask = cron.schedule('0 9 * * *', async () => {
    console.log('[cron] Iniciando monitoramento diário SCCON...')
    
    const logId = db.prepare(`
      INSERT INTO cron_logs (started_at, status) VALUES (datetime('now'), 'running')
    `).run().lastInsertRowid

    try {
      const result = await checkAllActiveCars()
      
      db.prepare(`
        UPDATE cron_logs 
        SET finished_at = datetime('now'),
            cars_processed = ?,
            alerts_found = ?,
            alerts_sent = ?,
            errors = ?,
            status = 'completed'
        WHERE id = ?
      `).run(
        result.total,
        result.totalNewAlerts,
        0, // WhatsApp (Fase 5)
        result.errors,
        logId,
      )

      console.log(`[cron] Monitoramento concluído: ${result.totalNewAlerts} novos alertas em ${result.total} CARs`)
    } catch (err: any) {
      console.error('[cron] Erro no monitoramento:', err.message)
      
      db.prepare(`
        UPDATE cron_logs 
        SET finished_at = datetime('now'), status = 'error', errors = 1
        WHERE id = ?
      `).run(logId)
    }
  }, {
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
