/**
 * Fase 9.1 — Relatórios PDF: laudo técnico, relatório de carteira, relatório histórico,
 * marca própria (branding), link temporário de compartilhamento e agendamento.
 *
 * Nota de escopo: agendamento gera o PDF automaticamente (cron diário), mas a ENTREGA por
 * Email/WhatsApp fica para a Fase 10 (canais de notificação) — por ora o usuário baixa pelo
 * link de compartilhamento gerado junto com o agendamento.
 */
import crypto from 'node:crypto'
import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'
import { computeSeverity } from '../lib/severity.js'
import { classifyTrend } from '../services/satellite.js'
import { buildHistoricoPdf, buildLaudoPdf, buildPortfolioReportPdf } from '../services/pdf-report.js'

const router = Router()

/* ─── Helpers compartilhados ─────────────────────────────────── */

function loadBranding(userId: string): { consultantName: string; logoBase64: string | null; footerText: string | null } {
  const user = db.prepare('SELECT name, report_logo_base64, report_footer_text FROM users WHERE id = ?').get(userId) as any
  return {
    consultantName: user?.name || 'Consultor',
    logoBase64: user?.report_logo_base64 || null,
    footerText: user?.report_footer_text || null,
  }
}

function buildLaudoInputForCar(carId: string, userId: string) {
  const car = db.prepare('SELECT * FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId) as any
  if (!car) return null

  const layers = db
    .prepare('SELECT label, area_ha, feature_count FROM car_layers WHERE car_id = ? ORDER BY label')
    .all(carId) as any[]
  const licenses = db
    .prepare('SELECT tipo, numero_titulo, data_vencimento, urgencia FROM car_licenses WHERE car_id = ? ORDER BY data_vencimento')
    .all(carId) as any[]
  const sobreposicoes = db
    .prepare('SELECT tipo, nome, coverage_percent FROM car_sobreposicoes WHERE car_id = ? ORDER BY coverage_percent DESC')
    .all(carId) as any[]
  const alertRows = db
    .prepare('SELECT * FROM alerts WHERE car_id = ? ORDER BY detected_date DESC LIMIT 200')
    .all(carId) as any[]
  const latestLaudo = db
    .prepare('SELECT content_md FROM ai_laudos WHERE car_id = ? ORDER BY updated_at DESC LIMIT 1')
    .get(carId) as any
  const latestRiskScore = db
    .prepare('SELECT score, band, explanation FROM risk_scores WHERE car_id = ? ORDER BY computed_at DESC LIMIT 1')
    .get(carId) as any

  const branding = loadBranding(userId)

  return {
    car: {
      carNumber: car.car_number,
      nickname: car.nickname,
      municipality: car.municipality,
      areaHa: car.area_ha,
      bioma: car.bioma,
      arlExigidaPercent: car.arl_exigida_percent,
      arlExigidaHa: car.arl_exigida_ha,
      arlDeclaradaHa: car.arl_declarada_ha,
      deficitArlHa: car.deficit_arl_ha,
      polygon: car.polygon_json ? JSON.parse(car.polygon_json) : null,
    },
    layers: layers.map((l) => ({ label: l.label, areaHa: l.area_ha, featureCount: l.feature_count })),
    licenses: licenses.map((l) => ({ tipo: l.tipo, numeroTitulo: l.numero_titulo, dataVencimento: l.data_vencimento, urgencia: l.urgencia })),
    sobreposicoes: sobreposicoes.map((s) => ({ tipo: s.tipo, nome: s.nome, coveragePercent: s.coverage_percent })),
    alerts: alertRows.map((a) => ({
      title: a.title,
      source: a.source,
      detectedDate: a.detected_date,
      areaHa: a.area_ha,
      severity: computeSeverity(a.class_type, a.area_ha || 0),
      status: a.status || 'novo',
    })),
    alertPoints: alertRows
      .filter((a) => a.geometry_json)
      .slice(0, 40)
      .map((a) => {
        try {
          const geom = JSON.parse(a.geometry_json)
          const [lon, lat] = geom.type === 'Point' ? geom.coordinates : centroidOfRing(geom)
          return { lon, lat, severity: computeSeverity(a.class_type, a.area_ha || 0) }
        } catch {
          return null
        }
      })
      .filter(Boolean) as Array<{ lon: number; lat: number; severity: string }>,
    riskScore: latestRiskScore ? { score: latestRiskScore.score, band: latestRiskScore.band, explanation: latestRiskScore.explanation } : null,
    laudoMarkdown: latestLaudo?.content_md || null,
    consultantName: branding.consultantName,
    logoBase64: branding.logoBase64,
    footerText: branding.footerText,
  }
}

function centroidOfRing(geometry: any): [number, number] {
  const ring: number[][] = geometry.type === 'Polygon' ? geometry.coordinates[0] : geometry.coordinates[0][0]
  const n = ring.length
  const sum = ring.reduce((acc, [x, y]) => [acc[0] + x, acc[1] + y], [0, 0])
  return [sum[0] / n, sum[1] / n]
}

function buildPortfolioReportInputForUser(userId: string, clientId?: string, tagId?: string) {
  let sql = `SELECT c.*, pc.name as client_name FROM cars c LEFT JOIN portfolio_clients pc ON pc.id = c.client_id WHERE c.user_id = ? AND c.active = 1`
  const params: any[] = [userId]
  if (clientId) {
    sql += ' AND c.client_id = ?'
    params.push(clientId)
  }
  if (tagId) {
    sql += ' AND c.id IN (SELECT car_id FROM car_tag_links WHERE tag_id = ?)'
    params.push(tagId)
  }
  const cars = db.prepare(sql).all(...params) as any[]

  const rows = cars.map((car) => {
    const alertCount = (db.prepare('SELECT COUNT(*) as count FROM alerts WHERE car_id = ?').get(car.id) as any).count
    const riskRow = db
      .prepare('SELECT score, band FROM risk_scores WHERE car_id = ? ORDER BY computed_at DESC LIMIT 1')
      .get(car.id) as any
    return {
      carNumber: car.car_number,
      nickname: car.nickname,
      clientName: car.client_name,
      municipality: car.municipality,
      areaHa: car.area_ha,
      alertCount,
      riskScore: riskRow?.score ?? null,
      riskBand: riskRow?.band ?? null,
    }
  })

  const branding = loadBranding(userId)
  return { consultantName: branding.consultantName, logoBase64: branding.logoBase64, footerText: branding.footerText, rows }
}

function buildHistoricoInputForCar(carId: string, userId: string) {
  const car = db.prepare('SELECT car_number, nickname FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId) as any
  if (!car) return null

  const ndviRows = db.prepare('SELECT year, mean_ndvi FROM car_ndvi WHERE car_id = ? ORDER BY year').all(carId) as any[]
  const values = ndviRows.map((r) => r.mean_ndvi).filter((v) => v !== null)
  const delta = values.length >= 2 ? values[values.length - 1] - values[0] : null
  const classification = classifyTrend(delta)

  const alertsByYearRows = db
    .prepare(
      `SELECT CAST(strftime('%Y', detected_date) AS INTEGER) as year, COUNT(*) as count, SUM(COALESCE(area_ha, 0)) as area_ha
       FROM alerts WHERE car_id = ? GROUP BY year ORDER BY year`,
    )
    .all(carId) as any[]

  const branding = loadBranding(userId)
  return {
    car: { carNumber: car.car_number, nickname: car.nickname },
    ndviTrend: ndviRows.map((r) => ({ year: r.year, meanNdvi: r.mean_ndvi, classification: r.year === ndviRows[ndviRows.length - 1]?.year ? classification : undefined })),
    alertsByYear: alertsByYearRows.map((r) => ({ year: r.year, count: r.count, areaHa: r.area_ha })),
    consultantName: branding.consultantName,
    logoBase64: branding.logoBase64,
  }
}

function sendPdf(res: import('express').Response, buffer: Buffer, filename: string) {
  res.setHeader('Content-Type', 'application/pdf')
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`)
  res.send(buffer)
}

/* ─── Rotas autenticadas ──────────────────────────────────────── */

router.use('/cars/:carId/report', requireAuth)
router.use('/portfolio/report.pdf', requireAuth)
router.use('/users/me/branding', requireAuth)
router.use('/report-schedules', requireAuth)

// GET /api/cars/:carId/report/laudo.pdf
router.get('/cars/:carId/report/laudo.pdf', async (req: AuthRequest, res) => {
  try {
    const input = buildLaudoInputForCar(req.params.carId, req.user!.id)
    if (!input) return void res.status(404).json({ error: 'CAR não encontrado' })
    const pdf = await buildLaudoPdf(input)
    sendPdf(res, pdf, `laudo_${(input.car.nickname || input.car.carNumber).replace(/\s+/g, '_')}.pdf`)
  } catch (err: any) {
    console.error('[reports] laudo.pdf error:', err)
    res.status(500).json({ error: 'Erro ao gerar laudo PDF' })
  }
})

// GET /api/cars/:carId/report/historico.pdf
router.get('/cars/:carId/report/historico.pdf', async (req: AuthRequest, res) => {
  try {
    const input = buildHistoricoInputForCar(req.params.carId, req.user!.id)
    if (!input) return void res.status(404).json({ error: 'CAR não encontrado' })
    const pdf = await buildHistoricoPdf(input)
    sendPdf(res, pdf, `historico_${(input.car.nickname || input.car.carNumber).replace(/\s+/g, '_')}.pdf`)
  } catch (err: any) {
    console.error('[reports] historico.pdf error:', err)
    res.status(500).json({ error: 'Erro ao gerar relatório histórico' })
  }
})

// POST /api/cars/:carId/report/laudo/share?hours=48 — link temporário (24-72h)
router.post('/cars/:carId/report/laudo/share', (req: AuthRequest, res) => {
  try {
    const car = db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(req.params.carId, req.user!.id) as any
    if (!car) return void res.status(404).json({ error: 'CAR não encontrado' })

    const hours = Math.min(72, Math.max(24, parseInt(String(req.query.hours || '48'), 10) || 48))
    const token = crypto.randomBytes(20).toString('hex')
    const expiresAt = new Date(Date.now() + hours * 3_600_000).toISOString()

    db.prepare(
      `INSERT INTO report_shares (id, token, user_id, report_type, car_id, expires_at) VALUES (?, ?, ?, 'laudo', ?, ?)`,
    ).run(uuid(), token, req.user!.id, req.params.carId, expiresAt)

    res.status(201).json({ token, expiresAt, path: `/api/public/reports/${token}` })
  } catch (err: any) {
    console.error('[reports] share error:', err)
    res.status(500).json({ error: 'Erro ao gerar link de compartilhamento' })
  }
})

// GET /api/portfolio/report.pdf?clientId=&tagId=
router.get('/portfolio/report.pdf', async (req: AuthRequest, res) => {
  try {
    const clientId = req.query.clientId ? String(req.query.clientId) : undefined
    const tagId = req.query.tagId ? String(req.query.tagId) : undefined
    const input = buildPortfolioReportInputForUser(req.user!.id, clientId, tagId)
    const pdf = await buildPortfolioReportPdf(input)
    sendPdf(res, pdf, 'relatorio_carteira.pdf')
  } catch (err: any) {
    console.error('[reports] portfolio report error:', err)
    res.status(500).json({ error: 'Erro ao gerar relatório de carteira' })
  }
})

// PATCH /api/users/me/branding — logo (base64) e rodapé do consultor nos relatórios
router.patch('/users/me/branding', (req: AuthRequest, res) => {
  try {
    const { logoBase64, footerText } = req.body as { logoBase64?: string | null; footerText?: string | null }
    if (logoBase64 !== undefined) {
      if (logoBase64 !== null && (typeof logoBase64 !== 'string' || logoBase64.length > 500_000)) {
        res.status(400).json({ error: 'Logo inválido (base64, máx. ~500KB)' })
        return
      }
      db.prepare('UPDATE users SET report_logo_base64 = ? WHERE id = ?').run(logoBase64, req.user!.id)
    }
    if (footerText !== undefined) {
      db.prepare('UPDATE users SET report_footer_text = ? WHERE id = ?').run(
        footerText ? String(footerText).slice(0, 200) : null,
        req.user!.id,
      )
    }
    res.json({ message: 'Marca atualizada' })
  } catch (err: any) {
    console.error('[reports] branding error:', err)
    res.status(500).json({ error: 'Erro ao atualizar marca' })
  }
})

router.get('/users/me/branding', (req: AuthRequest, res) => {
  res.json(loadBranding(req.user!.id))
})

/* ─── Agendamento (geração automática; entrega por canal fica pra Fase 10) ── */

// POST /api/report-schedules
router.post('/report-schedules', (req: AuthRequest, res) => {
  try {
    const { scope, carId, frequency } = req.body as { scope?: string; carId?: string; frequency?: string }
    if (scope !== 'portfolio' && scope !== 'car') return void res.status(400).json({ error: 'scope deve ser "portfolio" ou "car"' })
    if (frequency !== 'weekly' && frequency !== 'monthly') return void res.status(400).json({ error: 'frequency deve ser "weekly" ou "monthly"' })
    if (scope === 'car') {
      const car = db.prepare('SELECT id FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, req.user!.id) as any
      if (!car) return void res.status(400).json({ error: 'CAR inválido' })
    }
    const id = uuid()
    db.prepare(`INSERT INTO report_schedules (id, user_id, scope, car_id, frequency) VALUES (?, ?, ?, ?, ?)`).run(
      id,
      req.user!.id,
      scope,
      scope === 'car' ? carId : null,
      frequency,
    )
    res.status(201).json({ id, scope, carId: scope === 'car' ? carId : null, frequency, active: true })
  } catch (err: any) {
    console.error('[reports] create schedule error:', err)
    res.status(500).json({ error: 'Erro ao criar agendamento' })
  }
})

// GET /api/report-schedules
router.get('/report-schedules', (req: AuthRequest, res) => {
  const rows = db
    .prepare(`SELECT id, scope, car_id, frequency, active, last_run_at, created_at FROM report_schedules WHERE user_id = ? ORDER BY created_at DESC`)
    .all(req.user!.id) as any[]
  res.json({
    schedules: rows.map((r) => ({
      id: r.id,
      scope: r.scope,
      carId: r.car_id,
      frequency: r.frequency,
      active: !!r.active,
      lastRunAt: r.last_run_at,
      createdAt: r.created_at,
    })),
  })
})

// DELETE /api/report-schedules/:id
router.delete('/report-schedules/:id', (req: AuthRequest, res) => {
  const result = db.prepare('DELETE FROM report_schedules WHERE id = ? AND user_id = ?').run(req.params.id, req.user!.id)
  if (!result.changes) return void res.status(404).json({ error: 'Agendamento não encontrado' })
  res.json({ message: 'Agendamento removido' })
})

// GET /api/report-schedules/files — relatórios já gerados (com link de download)
router.get('/report-schedules/files', (req: AuthRequest, res) => {
  const rows = db
    .prepare(
      `SELECT rf.id, rf.report_type, rf.car_id, rf.share_token, rf.generated_at FROM report_files rf
       WHERE rf.user_id = ? ORDER BY rf.generated_at DESC LIMIT 50`,
    )
    .all(req.user!.id) as any[]
  res.json({
    files: rows.map((r) => ({
      id: r.id,
      reportType: r.report_type,
      carId: r.car_id,
      downloadPath: r.share_token ? `/api/public/reports/${r.share_token}` : null,
      generatedAt: r.generated_at,
    })),
  })
})

export { buildLaudoInputForCar, buildPortfolioReportInputForUser, buildHistoricoInputForCar }
export default router
