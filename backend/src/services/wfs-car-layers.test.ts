import { describe, expect, it } from 'vitest'
import { arlPercentForBioma, calcularConformidade, summarizeCarLayerFeatures, CAR_LAYER_DEFS } from './wfs-car-layers.js'

describe('arlPercentForBioma', () => {
  it('retorna 80% para Amazônia', () => {
    expect(arlPercentForBioma('Amazônia')).toBe(80)
  })

  it('retorna 35% para Cerrado', () => {
    expect(arlPercentForBioma('Cerrado')).toBe(35)
  })

  it('retorna 20% para Pantanal', () => {
    expect(arlPercentForBioma('Pantanal')).toBe(20)
  })

  it('retorna null para bioma desconhecido', () => {
    expect(arlPercentForBioma('Mata Atlântica')).toBeNull()
  })

  it('retorna null quando bioma é null', () => {
    expect(arlPercentForBioma(null)).toBeNull()
  })
})

describe('calcularConformidade', () => {
  it('calcula déficit de ARL quando declarada é menor que a exigida', () => {
    const result = calcularConformidade({ areaTotalHa: 1000, arlDeclaradaHa: 200, bioma: 'Amazônia' })
    expect(result.arlExigidaPercent).toBe(80)
    expect(result.arlExigidaHa).toBe(800)
    expect(result.deficitArlHa).toBe(600)
  })

  it('déficit é zero quando declarada supera a exigida', () => {
    const result = calcularConformidade({ areaTotalHa: 1000, arlDeclaradaHa: 900, bioma: 'Cerrado' })
    expect(result.arlExigidaHa).toBe(350)
    expect(result.deficitArlHa).toBe(0)
  })

  it('retorna nulos quando bioma é desconhecido (sem regra aplicável)', () => {
    const result = calcularConformidade({ areaTotalHa: 1000, arlDeclaradaHa: 200, bioma: null })
    expect(result.arlExigidaPercent).toBeNull()
    expect(result.arlExigidaHa).toBeNull()
    expect(result.deficitArlHa).toBeNull()
  })
})

describe('summarizeCarLayerFeatures', () => {
  const arlDef = CAR_LAYER_DEFS.find((d) => d.key === 'ARL')!
  const auasDef = CAR_LAYER_DEFS.find((d) => d.key === 'AUAS')!

  it('soma AREA_HA de todas as feições', () => {
    const features = [
      { properties: { AREA_HA: 1.5 } },
      { properties: { AREA_HA: 2.25 } },
    ]
    const summary = summarizeCarLayerFeatures(arlDef, features)
    expect(summary.areaHa).toBe(3.75)
    expect(summary.featureCount).toBe(2)
  })

  it('trata feições sem AREA_HA como zero', () => {
    const features = [{ properties: {} }]
    const summary = summarizeCarLayerFeatures(arlDef, features)
    expect(summary.areaHa).toBe(0)
  })

  it('retorna zero para lista vazia', () => {
    const summary = summarizeCarLayerFeatures(arlDef, [])
    expect(summary.areaHa).toBe(0)
    expect(summary.featureCount).toBe(0)
  })

  it('rastreia o ano de abertura mais recente só para AUAS', () => {
    const features = [
      { properties: { AREA_HA: 1, ABERTURA: '2015-01-01' } },
      { properties: { AREA_HA: 1, ABERTURA: '2020-06-01' } },
      { properties: { AREA_HA: 1, ABERTURA: null } },
    ]
    const summary = summarizeCarLayerFeatures(auasDef, features)
    expect(summary.maisRecenteAberturaAno).toBe(2020)
  })

  it('não inclui maisRecenteAberturaAno para camadas que não são AUAS', () => {
    const features = [{ properties: { AREA_HA: 1 } }]
    const summary = summarizeCarLayerFeatures(arlDef, features)
    expect(summary.maisRecenteAberturaAno).toBeUndefined()
  })
})
