import type { CarAiContext } from './ai-context.js'

export type RiskBand = 'baixo' | 'medio' | 'alto' | 'critico'
export type RiskScore = { score: number; band: RiskBand; components: Record<string, number> }

export function calculateRiskScore(context: CarAiContext): RiskScore {
  const recentAlerts = context.alertas.filter((alert) => alert.status !== 'resolvido').length
  const criticalAlerts = context.alertas.filter((alert) => /desmat|queim|embargo/i.test(`${alert.classe || ''} ${alert.titulo}`)).length
  const alertArea = context.alertas.reduce((total, alert) => total + Math.max(0, alert.areaHa || 0), 0)
  const firstNdvi = context.ndviTrend.find((point) => point.ndviMedio !== null)?.ndviMedio
  const lastNdvi = [...context.ndviTrend].reverse().find((point) => point.ndviMedio !== null)?.ndviMedio
  const ndviLoss = firstNdvi != null && lastNdvi != null ? Math.max(0, firstNdvi - lastNdvi) : 0
  const restrictedOverlap = context.sobreposicoes.reduce((total, overlap) => total + Math.max(0, overlap.percentual || 0), 0)
  const deficitArl = Math.max(0, context.conformidade.deficitArlHa || 0)

  const components = {
    alertas: Math.min(25, recentAlerts * 3 + criticalAlerts * 5 + Math.min(8, alertArea / 10)),
    ndvi: Math.min(25, ndviLoss * 100),
    sobreposicoes: Math.min(20, restrictedOverlap / 5),
    conformidade: Math.min(20, deficitArl / 5),
    pendencias: Math.min(10, context.alertas.filter((alert) => alert.status === 'novo' || alert.status === 'em_analise').length * 2),
  }
  const score = Math.round(Math.min(100, Object.values(components).reduce((total, value) => total + value, 0)))
  const band: RiskBand = score >= 75 ? 'critico' : score >= 50 ? 'alto' : score >= 25 ? 'medio' : 'baixo'
  return { score, band, components }
}

export function deterministicRiskExplanation(risk: RiskScore): string {
  const factors = Object.entries(risk.components).filter(([, value]) => value > 0).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const labels: Record<string, string> = { alertas: 'histórico de alertas', ndvi: 'queda de NDVI', sobreposicoes: 'sobreposições restritivas', conformidade: 'déficit de Reserva Legal', pendencias: 'alertas ainda em triagem' }
  const detail = factors.length ? factors.map(([key]) => labels[key]).join(', ') : 'nenhum fator de risco relevante nos dados disponíveis'
  return `Score ${risk.score}/100 (${risk.band}), calculado a partir de ${detail}. Priorize a validação dos dados de maior impacto.`
}
