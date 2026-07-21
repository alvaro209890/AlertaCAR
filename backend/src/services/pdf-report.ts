/**
 * Fase 9.1 — Relatórios PDF: laudo técnico por imóvel, relatório de carteira
 * consolidado e relatório histórico (NDVI + timeline). Layout puro (sem I/O),
 * usado tanto pelas rotas HTTP quanto pelos testes — mesmo padrão do
 * import-report-pdf.ts do GeoForest (mesma identidade visual emerald/dark).
 */
import PDFDocument from 'pdfkit'
import type { Polygon, MultiPolygon } from 'geojson'

const COLORS = {
  primary: '#059669',
  primaryLight: '#D1FAE5',
  primaryBg: '#ECFDF5',
  dark: '#0F172A',
  darkText: '#1E293B',
  text: '#334155',
  lightText: '#64748B',
  border: '#E2E8F0',
  bg: '#F8FAFC',
  danger: '#DC2626',
  dangerBg: '#FEF2F2',
  warn: '#D97706',
  white: '#FFFFFF',
}

const SEVERITY_COLORS: Record<string, string> = {
  critico: '#DC2626',
  alto: '#D97706',
  medio: '#CA8A04',
  baixo: '#059669',
}

function safeText(value: unknown, max = 500): string {
  return String(value ?? '').replace(/\s+/g, ' ').trim().slice(0, max)
}

function fmtHa(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—'
  return `${value.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ha`
}

function fmtDate(value: string | null | undefined): string {
  if (!value) return '—'
  try {
    return new Date(value).toLocaleDateString('pt-BR')
  } catch {
    return value
  }
}

/* ─── Doc bootstrapping ──────────────────────────────────────── */

interface DocContext {
  doc: PDFKit.PDFDocument
  margin: number
  pageW: number
  pageH: number
  contentW: number
  footerLabel: string
}

function createDoc(title: string, footerLabel: string): { ctx: DocContext; done: Promise<Buffer> } {
  const doc = new PDFDocument({
    size: 'A4',
    margin: 40,
    bufferPages: true,
    info: { Title: title, Author: 'AlertaCAR', Subject: 'Relatório técnico ambiental', Keywords: 'CAR, SEMA, monitoramento ambiental' },
  })
  const chunks: Buffer[] = []
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on('data', (chunk: Buffer) => chunks.push(chunk))
    doc.on('end', () => resolve(Buffer.concat(chunks)))
    doc.on('error', reject)
  })
  const margin = 40
  const ctx: DocContext = {
    doc,
    margin,
    pageW: doc.page.width,
    pageH: doc.page.height,
    contentW: doc.page.width - margin * 2,
    footerLabel,
  }
  return { ctx, done }
}

function ensureSpace(ctx: DocContext, height: number) {
  const { doc, pageH, margin, contentW, pageW, footerLabel } = ctx
  if (doc.y + height > pageH - margin - 28) {
    doc.addPage()
    doc
      .font('Helvetica')
      .fillColor(COLORS.lightText)
      .fontSize(8)
      .text(footerLabel, margin, 22, { width: contentW, align: 'right' })
    doc.moveTo(margin, 36).lineTo(pageW - margin, 36).strokeColor(COLORS.border).lineWidth(0.6).stroke()
    doc.y = 48
    doc.x = margin
  }
}

function drawHeader(ctx: DocContext, title: string, subtitle: string, generatedAt: Date, logoBase64?: string | null) {
  const { doc, pageW, margin, contentW } = ctx
  doc.rect(0, 0, pageW, 128).fill(COLORS.dark)
  doc.rect(0, 128, pageW, 4).fill(COLORS.primary)

  let logoWidth = 0
  if (logoBase64) {
    try {
      const buf = Buffer.from(logoBase64.replace(/^data:image\/\w+;base64,/, ''), 'base64')
      doc.image(buf, margin, 24, { fit: [44, 44] })
      logoWidth = 58
    } catch {
      /* logo opcional — ignora se inválido */
    }
  }

  doc.font('Helvetica-Bold').fontSize(20).fillColor(COLORS.white).text(title, margin + logoWidth, 30, {
    width: contentW - logoWidth,
  })
  doc.font('Helvetica').fontSize(9.5).fillColor(COLORS.primaryLight).text(subtitle, margin + logoWidth, 56, {
    width: contentW - logoWidth,
  })
  doc.font('Helvetica').fontSize(8.5).fillColor('#94A3B8').text(
    `Gerado em ${generatedAt.toLocaleString('pt-BR', { timeZone: 'America/Cuiaba' })} · AlertaCAR`,
    margin,
    100,
    { width: contentW },
  )
  doc.y = 152
  doc.x = margin
}

function drawSectionTitle(ctx: DocContext, label: string) {
  const { doc, margin, pageW, contentW } = ctx
  ensureSpace(ctx, 40)
  doc.font('Helvetica-Bold').fontSize(13).fillColor(COLORS.dark).text(label, margin, doc.y)
  doc.moveTo(margin, doc.y + 4).lineTo(pageW - margin, doc.y + 4).strokeColor(COLORS.primary).lineWidth(1.3).stroke()
  doc.moveDown(0.8)
  doc.x = margin
  void contentW
}

function drawKeyValueGrid(ctx: DocContext, pairs: Array<[string, string]>, columns = 2) {
  const { doc, margin, contentW } = ctx
  const colW = contentW / columns
  const rows = Math.ceil(pairs.length / columns)
  ensureSpace(ctx, rows * 30 + 10)
  const startY = doc.y
  pairs.forEach(([label, value], i) => {
    const col = i % columns
    const row = Math.floor(i / columns)
    const x = margin + col * colW
    const y = startY + row * 30
    doc.font('Helvetica').fontSize(8).fillColor(COLORS.lightText).text(label, x, y, { width: colW - 10 })
    doc.font('Helvetica-Bold').fontSize(10).fillColor(COLORS.darkText).text(value, x, y + 11, { width: colW - 10 })
  })
  doc.y = startY + rows * 30 + 6
  doc.x = margin
}

function drawTable(ctx: DocContext, headers: string[], rows: string[][], colWidths: number[]) {
  const { doc, margin, contentW } = ctx
  ensureSpace(ctx, 26)
  const headerY = doc.y
  doc.rect(margin, headerY, contentW, 20).fill(COLORS.primaryBg)
  let x = margin + 6
  headers.forEach((h, i) => {
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLORS.darkText).text(h, x, headerY + 6, { width: colWidths[i] - 6 })
    x += colWidths[i]
  })
  doc.y = headerY + 22
  doc.x = margin

  for (const row of rows) {
    const lineHeight = 16
    ensureSpace(ctx, lineHeight + 2)
    const rowY = doc.y
    let cx = margin + 6
    row.forEach((cell, i) => {
      doc.font('Helvetica').fontSize(8).fillColor(COLORS.text).text(cell, cx, rowY, { width: colWidths[i] - 6, ellipsis: true })
      cx += colWidths[i]
    })
    doc.moveTo(margin, rowY + lineHeight).lineTo(margin + contentW, rowY + lineHeight).strokeColor(COLORS.border).lineWidth(0.4).stroke()
    doc.y = rowY + lineHeight + 2
    doc.x = margin
  }
  doc.moveDown(0.5)
}

/** Renderizador simplificado de Markdown → PDF (títulos, listas, negrito removido, parágrafos). */
function renderMarkdown(ctx: DocContext, markdown: string) {
  const { doc, margin, contentW } = ctx
  const lines = markdown.split('\n')
  for (const rawLine of lines) {
    const line = rawLine.trim()
    if (!line) {
      doc.moveDown(0.4)
      continue
    }
    const stripped = line.replace(/\*\*(.+?)\*\*/g, '$1').replace(/\*(.+?)\*/g, '$1')
    if (/^#{1,3}\s+/.test(stripped)) {
      const text = stripped.replace(/^#{1,3}\s+/, '')
      ensureSpace(ctx, 24)
      doc.font('Helvetica-Bold').fontSize(11).fillColor(COLORS.dark).text(text, margin, doc.y, { width: contentW })
      doc.moveDown(0.3)
    } else if (/^[-*]\s+/.test(stripped)) {
      const text = stripped.replace(/^[-*]\s+/, '')
      ensureSpace(ctx, 16)
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(`•  ${text}`, margin + 8, doc.y, { width: contentW - 8 })
    } else {
      ensureSpace(ctx, 16)
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(stripped, margin, doc.y, { width: contentW })
    }
  }
  doc.x = margin
}

/** Esboço vetorial simples do polígono do imóvel (não é mapa georreferenciado) + alertas coloridos por severidade. */
function drawPolygonSketch(
  ctx: DocContext,
  geometry: Polygon | MultiPolygon,
  points: Array<{ lon: number; lat: number; severity: string }>,
  boxHeight = 180,
) {
  const { doc, margin, contentW } = ctx
  ensureSpace(ctx, boxHeight + 20)
  const boxY = doc.y
  doc.roundedRect(margin, boxY, contentW, boxHeight, 6).fillAndStroke(COLORS.bg, COLORS.border)

  const rings: number[][][] = geometry.type === 'Polygon' ? [geometry.coordinates[0]] : geometry.coordinates.map((p) => p[0])
  const allPoints = rings.flat()
  const lons = allPoints.map((p) => p[0])
  const lats = allPoints.map((p) => p[1])
  const minLon = Math.min(...lons)
  const maxLon = Math.max(...lons)
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const pad = 14
  const w = contentW - pad * 2
  const h = boxHeight - pad * 2
  const scaleX = (maxLon - minLon) || 1
  const scaleY = (maxLat - minLat) || 1
  const scale = Math.min(w / scaleX, h / scaleY)
  const offsetX = margin + pad + (w - scaleX * scale) / 2
  const offsetY = boxY + pad + (h - scaleY * scale) / 2

  const project = (lon: number, lat: number): [number, number] => [
    offsetX + (lon - minLon) * scale,
    offsetY + (maxLat - lat) * scale,
  ]

  for (const ring of rings) {
    if (ring.length < 2) continue
    const [x0, y0] = project(ring[0][0], ring[0][1])
    doc.moveTo(x0, y0)
    for (const [lon, lat] of ring.slice(1)) {
      const [x, y] = project(lon, lat)
      doc.lineTo(x, y)
    }
    doc.closePath()
  }
  doc.fillOpacity(0.15).fill(COLORS.primary)
  doc.fillOpacity(1)
  for (const ring of rings) {
    if (ring.length < 2) continue
    const [x0, y0] = project(ring[0][0], ring[0][1])
    doc.moveTo(x0, y0)
    for (const [lon, lat] of ring.slice(1)) {
      const [x, y] = project(lon, lat)
      doc.lineTo(x, y)
    }
    doc.closePath()
  }
  doc.strokeColor(COLORS.primary).lineWidth(1.5).stroke()

  for (const p of points) {
    const [x, y] = project(p.lon, p.lat)
    doc.circle(x, y, 3).fill(SEVERITY_COLORS[p.severity] || COLORS.warn)
  }

  doc.font('Helvetica').fontSize(7).fillColor(COLORS.lightText).text(
    'Esboço vetorial do perímetro (não georreferenciado) — ver mapa interativo completo no AlertaCAR.',
    margin + 6,
    boxY + boxHeight - 14,
    { width: contentW - 12 },
  )

  doc.y = boxY + boxHeight + 10
  doc.x = margin
}

function drawSignatureBlock(ctx: DocContext) {
  const { doc, margin, contentW } = ctx
  ensureSpace(ctx, 90)
  doc.moveDown(1)
  const y = doc.y + 40
  doc.moveTo(margin, y).lineTo(margin + 220, y).strokeColor(COLORS.border).lineWidth(0.8).stroke()
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.lightText).text('Assinatura do Responsável Técnico (RT)', margin, y + 4)
  doc.font('Helvetica').fontSize(8).fillColor(COLORS.lightText).text('CREA/CFT nº ____________________', margin, y + 18)
  doc.y = y + 40
  doc.x = margin
  void contentW
}

function drawDisclaimer(ctx: DocContext) {
  const { doc, margin, contentW } = ctx
  ensureSpace(ctx, 30)
  doc.font('Helvetica-Oblique').fontSize(7.5).fillColor(COLORS.lightText).text(
    'Este documento é uma análise preliminar gerada com apoio de fontes públicas (SEMA-MT, SCCON, INPE) e/ou ' +
      'inteligência artificial. Não substitui a análise e responsabilidade técnica de um profissional habilitado (RT).',
    margin,
    doc.y,
    { width: contentW },
  )
  doc.moveDown(0.5)
  doc.x = margin
}

/* ─── Laudo técnico por imóvel ───────────────────────────────── */

export interface LaudoPdfInput {
  car: {
    carNumber: string
    nickname: string | null
    municipality: string | null
    areaHa: number | null
    bioma: string | null
    arlExigidaPercent: number | null
    arlExigidaHa: number | null
    arlDeclaradaHa: number | null
    deficitArlHa: number | null
    polygon: Polygon | MultiPolygon | null
  }
  layers: Array<{ label: string; areaHa: number; featureCount: number }>
  licenses: Array<{ tipo: string; numeroTitulo: string | null; dataVencimento: string | null; urgencia: string | null }>
  sobreposicoes: Array<{ tipo: string; nome: string; coveragePercent: number }>
  alerts: Array<{ title: string; source: string; detectedDate: string; areaHa: number | null; severity: string; status: string }>
  /** Centróides de alertas com geometria conhecida, para o esboço vetorial (opcional). */
  alertPoints?: Array<{ lon: number; lat: number; severity: string }>
  riskScore: { score: number; band: string; explanation: string | null } | null
  laudoMarkdown: string | null
  consultantName: string
  logoBase64: string | null
  footerText: string | null
  generatedAt?: Date
}

export async function buildLaudoPdf(input: LaudoPdfInput): Promise<Buffer> {
  const generatedAt = input.generatedAt || new Date()
  const carLabel = input.car.nickname || input.car.carNumber
  const { ctx, done } = createDoc(`Laudo Técnico — ${carLabel}`, `AlertaCAR · Laudo · ${carLabel}`)
  const { doc } = ctx

  drawHeader(ctx, 'Laudo Técnico Ambiental', `Imóvel: ${carLabel}`, generatedAt, input.logoBase64)

  drawSectionTitle(ctx, 'Dados cadastrais')
  drawKeyValueGrid(ctx, [
    ['Nº do CAR', input.car.carNumber],
    ['Município', safeText(input.car.municipality) || '—'],
    ['Área total', fmtHa(input.car.areaHa)],
    ['Bioma', input.car.bioma || '—'],
    ['Elaborado por', input.consultantName],
    ['Data', generatedAt.toLocaleDateString('pt-BR')],
  ])

  drawSectionTitle(ctx, 'Conformidade — Reserva Legal (ARL)')
  drawKeyValueGrid(ctx, [
    ['% ARL exigido (bioma)', input.car.arlExigidaPercent ? `${input.car.arlExigidaPercent}%` : '—'],
    ['ARL exigida', fmtHa(input.car.arlExigidaHa)],
    ['ARL declarada', fmtHa(input.car.arlDeclaradaHa)],
    ['Déficit de ARL', fmtHa(input.car.deficitArlHa)],
  ], 2)

  if (input.car.polygon) {
    drawSectionTitle(ctx, 'Perímetro do imóvel')
    drawPolygonSketch(ctx, input.car.polygon, input.alertPoints || [])
  }

  if (input.layers.length) {
    drawSectionTitle(ctx, 'Camadas do imóvel (SEMA)')
    drawTable(
      ctx,
      ['Camada', 'Área', 'Feições'],
      input.layers.map((l) => [l.label, fmtHa(l.areaHa), String(l.featureCount)]),
      [ctx.contentW * 0.5, ctx.contentW * 0.3, ctx.contentW * 0.2],
    )
  }

  if (input.licenses.length) {
    drawSectionTitle(ctx, 'Licenciamento ambiental')
    drawTable(
      ctx,
      ['Tipo', 'Título', 'Vencimento', 'Urgência'],
      input.licenses.map((l) => [l.tipo, safeText(l.numeroTitulo, 30) || '—', fmtDate(l.dataVencimento), l.urgencia || '—']),
      [ctx.contentW * 0.2, ctx.contentW * 0.3, ctx.contentW * 0.25, ctx.contentW * 0.25],
    )
  }

  if (input.sobreposicoes.length) {
    drawSectionTitle(ctx, 'Sobreposições fundiárias')
    drawTable(
      ctx,
      ['Tipo', 'Nome', '% do imóvel'],
      input.sobreposicoes.map((s) => [s.tipo, safeText(s.nome, 40), `${s.coveragePercent.toFixed(2)}%`]),
      [ctx.contentW * 0.25, ctx.contentW * 0.5, ctx.contentW * 0.25],
    )
  }

  if (input.riskScore) {
    drawSectionTitle(ctx, 'Score de risco')
    drawKeyValueGrid(ctx, [
      ['Score', `${input.riskScore.score}/100`],
      ['Classificação', input.riskScore.band],
    ])
    if (input.riskScore.explanation) {
      ensureSpace(ctx, 30)
      doc.font('Helvetica').fontSize(9).fillColor(COLORS.text).text(input.riskScore.explanation, ctx.margin, doc.y, { width: ctx.contentW })
      doc.moveDown(0.5)
    }
  }

  if (input.alerts.length) {
    drawSectionTitle(ctx, `Timeline de alertas (${input.alerts.length})`)
    drawTable(
      ctx,
      ['Data', 'Fonte', 'Título', 'Área', 'Severidade', 'Status'],
      input.alerts
        .slice(0, 60)
        .map((a) => [fmtDate(a.detectedDate), a.source, safeText(a.title, 40), fmtHa(a.areaHa), a.severity, a.status]),
      [ctx.contentW * 0.14, ctx.contentW * 0.14, ctx.contentW * 0.34, ctx.contentW * 0.13, ctx.contentW * 0.13, ctx.contentW * 0.12],
    )
  }

  if (input.laudoMarkdown) {
    drawSectionTitle(ctx, 'Análise e recomendações (IA)')
    renderMarkdown(ctx, input.laudoMarkdown)
  }

  drawDisclaimer(ctx)
  drawSignatureBlock(ctx)

  if (input.footerText) {
    ensureSpace(ctx, 20)
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.lightText).text(safeText(input.footerText, 200), ctx.margin, doc.y, {
      width: ctx.contentW,
      align: 'center',
    })
  }

  doc.end()
  return done
}

/* ─── Relatório de carteira consolidado ──────────────────────── */

export interface PortfolioReportRow {
  carNumber: string
  nickname: string | null
  clientName: string | null
  municipality: string | null
  areaHa: number | null
  alertCount: number
  riskScore: number | null
  riskBand: string | null
}

export interface PortfolioReportInput {
  consultantName: string
  rows: PortfolioReportRow[]
  logoBase64: string | null
  footerText: string | null
  generatedAt?: Date
}

export async function buildPortfolioReportPdf(input: PortfolioReportInput): Promise<Buffer> {
  const generatedAt = input.generatedAt || new Date()
  const { ctx, done } = createDoc('Relatório de Carteira — AlertaCAR', 'AlertaCAR · Relatório de Carteira')
  const { doc } = ctx

  drawHeader(ctx, 'Relatório de Carteira', `${input.rows.length} imóveis monitorados`, generatedAt, input.logoBase64)

  const totalArea = input.rows.reduce((sum, r) => sum + (r.areaHa || 0), 0)
  const totalAlerts = input.rows.reduce((sum, r) => sum + r.alertCount, 0)
  const scored = input.rows.filter((r) => r.riskScore !== null)
  const avgScore = scored.length ? scored.reduce((sum, r) => sum + (r.riskScore || 0), 0) / scored.length : null

  drawSectionTitle(ctx, 'Resumo')
  drawKeyValueGrid(
    ctx,
    [
      ['Imóveis', String(input.rows.length)],
      ['Área total monitorada', fmtHa(totalArea)],
      ['Alertas (total)', String(totalAlerts)],
      ['Score de risco médio', avgScore !== null ? avgScore.toFixed(0) : '—'],
    ],
    2,
  )

  drawSectionTitle(ctx, 'Ranking de risco')
  const sorted = [...input.rows].sort((a, b) => (b.riskScore || 0) - (a.riskScore || 0))
  drawTable(
    ctx,
    ['Imóvel', 'Cliente', 'Município', 'Área', 'Alertas', 'Score'],
    sorted.map((r) => [
      safeText(r.nickname || r.carNumber, 30),
      safeText(r.clientName, 24) || '—',
      safeText(r.municipality, 24) || '—',
      fmtHa(r.areaHa),
      String(r.alertCount),
      r.riskScore !== null ? `${r.riskScore} (${r.riskBand})` : '—',
    ]),
    [ctx.contentW * 0.22, ctx.contentW * 0.18, ctx.contentW * 0.2, ctx.contentW * 0.14, ctx.contentW * 0.12, ctx.contentW * 0.14],
  )

  drawDisclaimer(ctx)
  if (input.footerText) {
    ensureSpace(ctx, 20)
    doc.font('Helvetica').fontSize(7.5).fillColor(COLORS.lightText).text(safeText(input.footerText, 200), ctx.margin, doc.y, {
      width: ctx.contentW,
      align: 'center',
    })
  }

  doc.end()
  return done
}

/* ─── Relatório histórico (NDVI + timeline por ano) ──────────── */

export interface HistoricoReportInput {
  car: { carNumber: string; nickname: string | null }
  ndviTrend: Array<{ year: number; meanNdvi: number | null; classification?: string }>
  alertsByYear: Array<{ year: number; count: number; areaHa: number }>
  consultantName: string
  logoBase64: string | null
  generatedAt?: Date
}

export async function buildHistoricoPdf(input: HistoricoReportInput): Promise<Buffer> {
  const generatedAt = input.generatedAt || new Date()
  const carLabel = input.car.nickname || input.car.carNumber
  const { ctx, done } = createDoc(`Relatório Histórico — ${carLabel}`, `AlertaCAR · Histórico · ${carLabel}`)
  const { doc } = ctx

  drawHeader(ctx, 'Relatório Histórico', `Imóvel: ${carLabel} · Análise temporal`, generatedAt, input.logoBase64)

  if (input.ndviTrend.length) {
    drawSectionTitle(ctx, 'Tendência de NDVI')
    drawTable(
      ctx,
      ['Ano', 'NDVI médio', 'Classificação'],
      input.ndviTrend.map((t) => [String(t.year), t.meanNdvi !== null ? t.meanNdvi.toFixed(3) : '—', t.classification || '—']),
      [ctx.contentW * 0.3, ctx.contentW * 0.35, ctx.contentW * 0.35],
    )
  }

  if (input.alertsByYear.length) {
    drawSectionTitle(ctx, 'Alertas por ano')
    drawTable(
      ctx,
      ['Ano', 'Nº de alertas', 'Área total'],
      input.alertsByYear.map((a) => [String(a.year), String(a.count), fmtHa(a.areaHa)]),
      [ctx.contentW * 0.3, ctx.contentW * 0.35, ctx.contentW * 0.35],
    )
  }

  drawDisclaimer(ctx)
  doc.end()
  return done
}
