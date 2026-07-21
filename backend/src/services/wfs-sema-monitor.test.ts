import { describe, expect, it } from 'vitest'
import { classificarUrgenciaLicenca, daysUntil, parseSemaDate } from './wfs-sema-monitor.js'

describe('parseSemaDate', () => {
  it('converte data brasileira DD/MM/YYYY para ISO', () => {
    expect(parseSemaDate('13/12/2022')).toBe('2022-12-13')
  })

  it('aceita data já em ISO com timestamp', () => {
    expect(parseSemaDate('2031-03-05T04:00:00Z')).toBe('2031-03-05')
  })

  it('retorna null para "nan" (valor ausente da SEMA)', () => {
    expect(parseSemaDate('nan')).toBeNull()
  })

  it('retorna null para vazio/whitespace', () => {
    expect(parseSemaDate('')).toBeNull()
    expect(parseSemaDate('   ')).toBeNull()
  })

  it('retorna null para null/undefined', () => {
    expect(parseSemaDate(null)).toBeNull()
    expect(parseSemaDate(undefined)).toBeNull()
  })

  it('retorna null para formato não reconhecido', () => {
    expect(parseSemaDate('não informado')).toBeNull()
  })
})

describe('daysUntil', () => {
  it('calcula dias positivos para data futura', () => {
    const days = daysUntil('2026-08-20', '2026-07-21')
    expect(days).toBe(30)
  })

  it('calcula dias negativos para data passada (vencida)', () => {
    const days = daysUntil('2026-01-01', '2026-07-21')
    expect(days).toBeLessThan(0)
  })

  it('retorna null quando a data é null', () => {
    expect(daysUntil(null)).toBeNull()
  })

  it('retorna null para data inválida', () => {
    expect(daysUntil('not-a-date')).toBeNull()
  })
})

describe('classificarUrgenciaLicenca', () => {
  it('classifica como vencida quando dias restantes é negativo', () => {
    expect(classificarUrgenciaLicenca(-5)).toBe('vencida')
  })

  it('classifica como crítica dentro de 30 dias', () => {
    expect(classificarUrgenciaLicenca(15)).toBe('critica_30d')
    expect(classificarUrgenciaLicenca(30)).toBe('critica_30d')
  })

  it('classifica como atenção 60d entre 31 e 60 dias', () => {
    expect(classificarUrgenciaLicenca(45)).toBe('atencao_60d')
    expect(classificarUrgenciaLicenca(60)).toBe('atencao_60d')
  })

  it('classifica como atenção 90d entre 61 e 90 dias', () => {
    expect(classificarUrgenciaLicenca(75)).toBe('atencao_90d')
    expect(classificarUrgenciaLicenca(90)).toBe('atencao_90d')
  })

  it('classifica como ok acima de 90 dias', () => {
    expect(classificarUrgenciaLicenca(200)).toBe('ok')
  })

  it('classifica como ok quando não há data de vencimento', () => {
    expect(classificarUrgenciaLicenca(null)).toBe('ok')
  })
})
