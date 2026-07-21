import { describe, expect, it } from 'vitest'
import { buildHistoricoPdf, buildLaudoPdf, buildPortfolioReportPdf } from './pdf-report.js'

function expectValidPdf(pdf: Buffer) {
  expect(Buffer.isBuffer(pdf)).toBe(true)
  expect(pdf.length).toBeGreaterThan(500)
  expect(pdf.subarray(0, 5).toString('utf8')).toBe('%PDF-')
  expect(pdf.includes(Buffer.from('%%EOF'))).toBe(true)
}

const polygon = {
  type: 'Polygon' as const,
  coordinates: [
    [
      [-55, -12],
      [-55, -11],
      [-54, -11],
      [-54, -12],
      [-55, -12],
    ],
  ],
}

describe('buildLaudoPdf', () => {
  it('gera um PDF válido com todas as seções preenchidas', async () => {
    const pdf = await buildLaudoPdf({
      car: {
        carNumber: 'MT271442/2017',
        nickname: 'Fazenda Teste',
        municipality: 'Sinop',
        areaHa: 1160.01,
        bioma: 'Amazônia',
        arlExigidaPercent: 80,
        arlExigidaHa: 928,
        arlDeclaradaHa: 950,
        deficitArlHa: 0,
        polygon,
      },
      layers: [{ label: 'Reserva Legal', areaHa: 950, featureCount: 1 }],
      licenses: [{ tipo: 'LP', numeroTitulo: '123/2020', dataVencimento: '2027-01-01', urgencia: 'ok' }],
      sobreposicoes: [{ tipo: 'UC', nome: 'Parque Estadual X', coveragePercent: 5.2 }],
      alerts: [
        { title: 'Desmate detectado', source: 'sccon', detectedDate: '2026-06-01', areaHa: 3.2, severity: 'alto', status: 'novo' },
      ],
      alertPoints: [{ lon: -54.5, lat: -11.5, severity: 'alto' }],
      riskScore: { score: 42, band: 'medio', explanation: 'Score moderado por histórico recente de alertas.' },
      laudoMarkdown: '## Análise\n\nO imóvel apresenta **conformidade** com a Reserva Legal.\n\n- Recomenda-se monitoramento contínuo\n- Sem passivos identificados',
      consultantName: 'Eng. Teste',
      logoBase64: null,
      footerText: 'Consultoria Ambiental Teste — CREA 000000',
    })
    expectValidPdf(pdf)
  })

  it('gera PDF mínimo sem camadas/licenças/laudo IA', async () => {
    const pdf = await buildLaudoPdf({
      car: {
        carNumber: 'MT1/2020',
        nickname: null,
        municipality: null,
        areaHa: null,
        bioma: null,
        arlExigidaPercent: null,
        arlExigidaHa: null,
        arlDeclaradaHa: null,
        deficitArlHa: null,
        polygon: null,
      },
      layers: [],
      licenses: [],
      sobreposicoes: [],
      alerts: [],
      riskScore: null,
      laudoMarkdown: null,
      consultantName: 'Consultor',
      logoBase64: null,
      footerText: null,
    })
    expectValidPdf(pdf)
  })
})

describe('buildPortfolioReportPdf', () => {
  it('gera relatório de carteira com ranking de risco', async () => {
    const pdf = await buildPortfolioReportPdf({
      consultantName: 'Eng. Teste',
      logoBase64: null,
      footerText: null,
      rows: [
        { carNumber: 'MT1/2020', nickname: 'Fazenda A', clientName: 'Cliente X', municipality: 'Sinop', areaHa: 500, alertCount: 3, riskScore: 60, riskBand: 'alto' },
        { carNumber: 'MT2/2020', nickname: 'Fazenda B', clientName: 'Cliente Y', municipality: 'Sorriso', areaHa: 200, alertCount: 0, riskScore: 10, riskBand: 'baixo' },
      ],
    })
    expectValidPdf(pdf)
  })

  it('gera relatório vazio sem quebrar', async () => {
    const pdf = await buildPortfolioReportPdf({ consultantName: 'Eng.', logoBase64: null, footerText: null, rows: [] })
    expectValidPdf(pdf)
  })
})

describe('buildHistoricoPdf', () => {
  it('gera relatório histórico com NDVI e alertas por ano', async () => {
    const pdf = await buildHistoricoPdf({
      car: { carNumber: 'MT1/2020', nickname: 'Fazenda A' },
      ndviTrend: [
        { year: 2020, meanNdvi: 0.7, classification: 'estável' },
        { year: 2024, meanNdvi: 0.68, classification: 'estável' },
      ],
      alertsByYear: [{ year: 2024, count: 2, areaHa: 4.1 }],
      consultantName: 'Eng. Teste',
      logoBase64: null,
    })
    expectValidPdf(pdf)
  })
})
