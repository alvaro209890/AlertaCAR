import { describe, expect, it } from 'vitest'
import {
  normalizeRing,
  normalizePolygonGeometry,
  polygonToWkt,
  parseWfsLayerNamesFromCapabilities,
} from './wfs-intersection.js'

describe('normalizeRing', () => {
  it('fecha um anel aberto repetindo o primeiro ponto', () => {
    const ring = normalizeRing([[0, 0], [1, 0], [1, 1], [0, 1]])
    expect(ring).toEqual([[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]])
  })

  it('mantém um anel já fechado', () => {
    const ring = normalizeRing([[0, 0], [1, 0], [1, 1], [0, 0]])
    expect(ring).toEqual([[0, 0], [1, 0], [1, 1], [0, 0]])
  })

  it('rejeita anel com menos de 3 pontos', () => {
    expect(normalizeRing([[0, 0], [1, 1]])).toBeNull()
  })

  it('rejeita coordenadas não finitas', () => {
    expect(normalizeRing([[0, 0], [1, NaN], [1, 1]])).toBeNull()
  })

  it('rejeita entrada que não é array', () => {
    expect(normalizeRing('not-an-array')).toBeNull()
  })
})

describe('normalizePolygonGeometry', () => {
  const validRing = [[0, 0], [1, 0], [1, 1], [0, 1], [0, 0]]

  it('normaliza um Polygon válido', () => {
    const geom = normalizePolygonGeometry({ type: 'Polygon', coordinates: [validRing] })
    expect(geom?.type).toBe('Polygon')
  })

  it('normaliza um MultiPolygon válido', () => {
    const geom = normalizePolygonGeometry({ type: 'MultiPolygon', coordinates: [[validRing]] })
    expect(geom?.type).toBe('MultiPolygon')
  })

  it('rejeita tipo desconhecido', () => {
    expect(normalizePolygonGeometry({ type: 'Point', coordinates: [0, 0] })).toBeNull()
  })

  it('rejeita geometria nula/indefinida', () => {
    expect(normalizePolygonGeometry(null)).toBeNull()
    expect(normalizePolygonGeometry(undefined)).toBeNull()
  })

  it('rejeita Polygon sem coordinates', () => {
    expect(normalizePolygonGeometry({ type: 'Polygon' })).toBeNull()
  })
})

describe('polygonToWkt', () => {
  it('gera WKT de um Polygon simples', () => {
    const wkt = polygonToWkt({
      type: 'Polygon',
      coordinates: [[[0, 0], [1, 0], [1, 1], [0, 0]]],
    })
    expect(wkt).toBe('POLYGON((0 0,1 0,1 1,0 0))')
  })

  it('gera WKT de um MultiPolygon', () => {
    const wkt = polygonToWkt({
      type: 'MultiPolygon',
      coordinates: [[[[0, 0], [1, 0], [1, 1], [0, 0]]]],
    })
    expect(wkt).toBe('MULTIPOLYGON(((0 0,1 0,1 1,0 0)))')
  })
})

describe('parseWfsLayerNamesFromCapabilities', () => {
  it('extrai nomes de FeatureType do XML de capabilities', () => {
    const xml = `
      <wfs:WFS_Capabilities>
        <FeatureTypeList>
          <FeatureType>
            <Name>Geoportal:CAR_ATP</Name>
            <Title>CAR ATP</Title>
          </FeatureType>
          <FeatureType>
            <Name>Geoportal:AREAS_EMBARGADAS_SEMA</Name>
            <Title>Embargos</Title>
          </FeatureType>
        </FeatureTypeList>
      </wfs:WFS_Capabilities>
    `
    const names = parseWfsLayerNamesFromCapabilities(xml)
    expect(names).toEqual(['Geoportal:CAR_ATP', 'Geoportal:AREAS_EMBARGADAS_SEMA'])
  })

  it('ignora nomes sem namespace (não renderizáveis)', () => {
    const xml = `<FeatureType><Name>SemNamespace</Name></FeatureType>`
    expect(parseWfsLayerNamesFromCapabilities(xml)).toEqual([])
  })

  it('deduplica nomes repetidos', () => {
    const xml = `
      <FeatureType><Name>Geoportal:CAR_ATP</Name></FeatureType>
      <FeatureType><Name>Geoportal:CAR_ATP</Name></FeatureType>
    `
    expect(parseWfsLayerNamesFromCapabilities(xml)).toEqual(['Geoportal:CAR_ATP'])
  })

  it('retorna vazio para XML sem FeatureType', () => {
    expect(parseWfsLayerNamesFromCapabilities('<foo></foo>')).toEqual([])
  })
})
