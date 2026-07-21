import { describe, expect, it } from 'vitest'
import { calculateRiskScore, deterministicRiskExplanation } from './risk-score.js'
import type { CarAiContext } from './ai-context.js'

const baseContext: CarAiContext = {
  cadastro: { numero: 'MT001/2020', municipio: 'Cuiabá', areaHa: 100, bioma: 'Cerrado' },
  camadas: {},
  conformidade: { arlExigidaHa: 20, arlDeclaradaHa: 20, deficitArlHa: 0 },
  alertas: [],
  sobreposicoes: [],
  autorizacoes: [],
  ndviTrend: [],
}

describe('calculateRiskScore', () => {
  it('retorna risco baixo sem fatores negativos', () => {
    expect(calculateRiskScore(baseContext)).toMatchObject({ score: 0, band: 'baixo' })
  })

  it('combina alertas, queda de NDVI, sobreposição e déficit sem ultrapassar 100', () => {
    const result = calculateRiskScore({
      ...baseContext,
      conformidade: { ...baseContext.conformidade, deficitArlHa: 200 },
      alertas: Array.from({ length: 6 }, (_, index) => ({ id: String(index), classe: 'desmatamento', data: '2026-07-01', areaHa: 30, fonte: 'SCCON', status: 'novo', titulo: 'Desmatamento detectado' })),
      sobreposicoes: [{ tipo: 'UC', nome: 'Unidade', percentual: 100 }],
      ndviTrend: [{ ano: 2020, ndviMedio: 0.8 }, { ano: 2025, ndviMedio: 0.3 }],
    })
    expect(result.score).toBe(100)
    expect(result.band).toBe('critico')
  })

  it('ignora pontos NDVI nulos', () => {
    const result = calculateRiskScore({ ...baseContext, ndviTrend: [{ ano: 2020, ndviMedio: null }, { ano: 2025, ndviMedio: null }] })
    expect(result.components.ndvi).toBe(0)
  })

  it('explica fatores calculados sem alegar uma decisão', () => {
    const explanation = deterministicRiskExplanation(calculateRiskScore({ ...baseContext, alertas: [{ id: 'a', classe: 'queimada', data: '2026-07-01', areaHa: 1, fonte: 'SCCON', status: 'novo', titulo: 'Queimada' }] }))
    expect(explanation).toContain('Score')
    expect(explanation).toContain('alertas')
  })
})
