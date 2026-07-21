/**
 * Fase 9.1 — Link temporário de compartilhamento de relatórios (sem auth).
 *
 * Fica num router próprio, montado em '/api/public' ANTES dos routers que aplicam
 * requireAuth sem filtro de path (export.ts, interop.ts, ai.ts, satellite.ts, alerts.ts —
 * todos montados em app.use('/api', ...)): como esses routers respondem 401 para
 * qualquer rota que não reconhecem quando chamados antes deste, uma rota pública dentro
 * do mesmo prefixo bare '/api' só é alcançável se for registrada primeiro.
 */
import { Router } from 'express'
import db from '../db/connection.js'
import { buildHistoricoPdf, buildLaudoPdf, buildPortfolioReportPdf } from '../services/pdf-report.js'
import { buildHistoricoInputForCar, buildLaudoInputForCar, buildPortfolioReportInputForUser } from './reports.js'

const router = Router()

function sendPdf(res: import('express').Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
}

// GET /api/public/reports/:token
router.get('/reports/:token', async (req, res) => {
  try {
    const share = db.prepare('SELECT * FROM report_shares WHERE token = ?').get(req.params.token) as any
    if (!share) {
      res.status(404).json({ error: 'Link não encontrado' })
      return
    }
    if (new Date(share.expires_at).getTime() < Date.now()) {
      res.status(410).json({ error: 'Link expirado' })
      return
    }

    if (share.report_type === 'laudo' && share.car_id) {
      const input = buildLaudoInputForCar(share.car_id, share.user_id)
      if (!input) {
        res.status(404).json({ error: 'CAR não encontrado' })
        return
      }
      const pdf = await buildLaudoPdf(input)
      sendPdf(res, pdf, `laudo_${(input.car.nickname || input.car.carNumber).replace(/\s+/g, '_')}.pdf`)
      return
    }

    if (share.report_type === 'portfolio') {
      const input = buildPortfolioReportInputForUser(share.user_id)
      const pdf = await buildPortfolioReportPdf(input)
      sendPdf(res, pdf, 'relatorio_carteira.pdf')
      return
    }

    if (share.report_type === 'historico' && share.car_id) {
      const input = buildHistoricoInputForCar(share.car_id, share.user_id)
      if (!input) {
        res.status(404).json({ error: 'CAR não encontrado' })
        return
      }
      const pdf = await buildHistoricoPdf(input)
      sendPdf(res, pdf, 'relatorio_historico.pdf')
      return
    }

    res.status(400).json({ error: 'Tipo de relatório inválido' })
  } catch (err: any) {
    console.error('[public-reports] error:', err)
    res.status(500).json({ error: 'Erro ao gerar relatório compartilhado' })
  }
})

export default router
