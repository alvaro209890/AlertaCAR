import { describe, expect, it } from 'vitest'
import { computeSeverity, isValidAlertStatus } from './severity.js'

describe('computeSeverity', () => {
  it('usa a severidade base para classe crítica sem ajuste de área', () => {
    expect(computeSeverity('CUT', 0)).toBe('critica')
  })

  it('mantém crítica no teto mesmo com área grande', () => {
    expect(computeSeverity('CUT', 50)).toBe('critica')
  })

  it('sobe um nível quando a área é ≥10 ha', () => {
    expect(computeSeverity('BURN_SCAR', 12)).toBe('alta')
  })

  it('desce um nível quando a área é <0,5 ha', () => {
    expect(computeSeverity('BURN_SCAR', 0.2)).toBe('baixa')
  })

  it('não ajusta por área quando a área é zero (achado pontual)', () => {
    expect(computeSeverity('AUTO_INFRACAO', 0)).toBe('alta')
  })

  it('usa média como fallback para classe desconhecida', () => {
    expect(computeSeverity('CLASSE_INEXISTENTE', 0)).toBe('media')
  })

  it('não desce abaixo de baixa', () => {
    expect(computeSeverity('DESEMBARGO', 0.1)).toBe('baixa')
  })

  it('classifica sobreposição a terra indígena como alta', () => {
    expect(computeSeverity('TERRA_INDIGENA', 0)).toBe('alta')
  })
})

describe('isValidAlertStatus', () => {
  it('aceita todos os status válidos', () => {
    expect(isValidAlertStatus('novo')).toBe(true)
    expect(isValidAlertStatus('em_analise')).toBe(true)
    expect(isValidAlertStatus('validado')).toBe(true)
    expect(isValidAlertStatus('falso_positivo')).toBe(true)
    expect(isValidAlertStatus('resolvido')).toBe(true)
  })

  it('rejeita status inválido', () => {
    expect(isValidAlertStatus('inventado')).toBe(false)
  })

  it('rejeita valores não-string', () => {
    expect(isValidAlertStatus(null)).toBe(false)
    expect(isValidAlertStatus(42)).toBe(false)
  })
})
