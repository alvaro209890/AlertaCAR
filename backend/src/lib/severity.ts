// Severidade de alertas — Fase 5 (workflow profissional).
// Severidade = classe base (por tipo de achado) ajustada pela área envolvida.
// Determinístico e transparente: não usa IA para o número (documentado em IA-ASSISTENTE.md).

export type Severity = 'baixa' | 'media' | 'alta' | 'critica'

const LEVELS: Severity[] = ['baixa', 'media', 'alta', 'critica']

const BASE_SEVERITY_BY_CLASS: Record<string, Severity> = {
  // SCCON — desmatamento/degradação
  CUT: 'critica',
  MINERAL_EXTRACTION: 'critica',
  DEGRADATION_CHEMICAL_AGENT: 'critica',
  SELECTIVE_EXTRACTION: 'alta',
  DEGRADATION_SELECTIVE_CUT: 'alta',
  BURN_SCAR: 'media',
  FOCUS_OF_BURN: 'media',
  AIRSTRIP_OPENING: 'media',
  ACCESS: 'media',
  LANDSLIDES: 'baixa',
  BLOW_DOWN: 'baixa',
  // SEMA — fiscalização
  EMBARGO: 'critica',
  AUTO_INFRACAO: 'alta',
  NOTIFICACAO: 'media',
  DESEMBARGO: 'baixa',
  // SEMA — autorizações (informativo, não é problema)
  AUTORIZACAO_DESMATE: 'baixa',
  AUTEX_PMFS: 'baixa',
  // SEMA — licenciamento (urgência de vencimento)
  LICENCA_LP: 'baixa',
  LICENCA_LI: 'baixa',
  LICENCA_LO: 'baixa',
  LICENCA_LOP: 'baixa',
  // Fundiário — sobreposições
  TERRA_INDIGENA: 'alta',
  UNIDADE_CONSERVACAO: 'alta',
  ASSENTAMENTO_INCRA: 'media',
  ASSENTAMENTO_INTERMAT: 'media',
  CORREDOR_BIODIVERSIDADE: 'media',
}

function bump(level: Severity, delta: number): Severity {
  const index = LEVELS.indexOf(level)
  const next = Math.min(LEVELS.length - 1, Math.max(0, index + delta))
  return LEVELS[next]
}

/**
 * Severidade = classe base ajustada pela área (quando aplicável):
 * ≥10 ha sobe um nível; <0,5 ha (e >0) desce um nível. Achados pontuais (área 0,
 * ex. infrações/notificações/licenças) usam só a classe base.
 */
export function computeSeverity(classType: string, areaHa: number): Severity {
  const base = BASE_SEVERITY_BY_CLASS[classType] || 'media'
  if (!areaHa || areaHa <= 0) return base
  if (areaHa >= 10) return bump(base, 1)
  if (areaHa < 0.5) return bump(base, -1)
  return base
}

export type AlertStatus = 'novo' | 'em_analise' | 'validado' | 'falso_positivo' | 'resolvido'

export const ALERT_STATUSES: AlertStatus[] = ['novo', 'em_analise', 'validado', 'falso_positivo', 'resolvido']

export function isValidAlertStatus(value: unknown): value is AlertStatus {
  return typeof value === 'string' && (ALERT_STATUSES as string[]).includes(value)
}
