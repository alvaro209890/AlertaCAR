import { describe, expect, it } from 'vitest'
import {
  bboxForGeometry,
  buildFrameUrl,
  buildSampleGrid,
  classifyTrend,
  getSatelliteCatalog,
  ndviFromBands,
  NDVI_AVAILABLE_YEARS,
  parseBandsFromFeatureInfo,
  SATELLITE_CATALOG,
} from './satellite.js'

describe('getSatelliteCatalog', () => {
  it('lista os satélites com anos', () => {
    const catalog = getSatelliteCatalog()
    expect(catalog.find((s) => s.id === 'sentinel2')?.years).toContain(2024)
    expect(catalog.find((s) => s.id === 'landsat5')?.years).toContain(1984)
  })

  it('landsat5 não inclui 2001/2002 (sem cobertura verificada ao vivo)', () => {
    const landsat5 = SATELLITE_CATALOG.find((s) => s.id === 'landsat5')!
    expect(landsat5.years).not.toContain(2001)
    expect(landsat5.years).not.toContain(2002)
  })

  it('NDVI_AVAILABLE_YEARS reflete os anos do sentinel2', () => {
    expect(NDVI_AVAILABLE_YEARS).toEqual(SATELLITE_CATALOG.find((s) => s.id === 'sentinel2')!.years)
  })
})

describe('bboxForGeometry', () => {
  const square = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-56.1, -14.1],
        [-56.0, -14.1],
        [-56.0, -14.0],
        [-56.1, -14.0],
        [-56.1, -14.1],
      ],
    ],
  }

  it('expande o bbox pela margem informada', () => {
    const [minX, minY, maxX, maxY] = bboxForGeometry(square, 0.1)
    expect(minX).toBeLessThan(-56.1)
    expect(maxX).toBeGreaterThan(-56.0)
    expect(minY).toBeLessThan(-14.1)
    expect(maxY).toBeGreaterThan(-14.0)
  })

  it('sem margem retorna o bbox exato do polígono', () => {
    const [minX, minY, maxX, maxY] = bboxForGeometry(square, 0)
    expect(minX).toBeCloseTo(-56.1)
    expect(minY).toBeCloseTo(-14.1)
    expect(maxX).toBeCloseTo(-56.0)
    expect(maxY).toBeCloseTo(-14.0)
  })
})

describe('buildFrameUrl', () => {
  it('monta GetMap com bbox em ordem lat,lon (EPSG:4326)', () => {
    const url = buildFrameUrl('Mosaicos:SENTINEL_2_2024', [-56.1, -14.1, -56.0, -14.0])
    expect(url).toContain('service=WMS')
    expect(url).toContain('request=GetMap')
    expect(url).toContain('layers=Mosaicos%3ASENTINEL_2_2024')
    expect(url).toContain('bbox=-14.1%2C-56.1%2C-14%2C-56')
    expect(url).toContain('authkey=')
  })
})

describe('parseBandsFromFeatureInfo', () => {
  it('extrai bandas por sufixo numérico independente do prefixo', () => {
    const json = {
      features: [
        {
          properties: {
            MOSAICO_SENTINEL2_2016_0: 989,
            MOSAICO_SENTINEL2_2016_1: 978,
            MOSAICO_SENTINEL2_2016_2: 938,
            MOSAICO_SENTINEL2_2016_3: 2338,
          },
        },
      ],
    }
    expect(parseBandsFromFeatureInfo(json)).toEqual([989, 978, 938, 2338])
  })

  it('funciona com prefixo diferente (naming inconsistente por ano confirmado ao vivo)', () => {
    const json = {
      features: [
        {
          properties: {
            MOSAICO_SENTINEL_2_2024_0: 872,
            MOSAICO_SENTINEL_2_2024_1: 1108,
            MOSAICO_SENTINEL_2_2024_2: 1522,
            MOSAICO_SENTINEL_2_2024_3: 2546,
          },
        },
      ],
    }
    expect(parseBandsFromFeatureInfo(json)).toEqual([872, 1108, 1522, 2546])
  })

  it('retorna null sem features', () => {
    expect(parseBandsFromFeatureInfo({ features: [] })).toBeNull()
    expect(parseBandsFromFeatureInfo(null)).toBeNull()
  })
})

describe('ndviFromBands', () => {
  it('calcula NDVI alto para pixel de floresta densa (NIR >> RED)', () => {
    const ndvi = ndviFromBands([989, 978, 938, 2338])
    expect(ndvi).toBeCloseTo((2338 - 938) / (2338 + 938), 5)
    expect(ndvi).toBeGreaterThan(0.3)
  })

  it('calcula NDVI próximo de zero para pixel urbano/bare (bandas próximas)', () => {
    const ndvi = ndviFromBands([1440, 1393, 1521, 1443])
    expect(ndvi).toBeCloseTo((1443 - 1521) / (1443 + 1521), 5)
    expect(ndvi).toBeLessThan(0.1)
  })

  it('retorna null com bandas insuficientes ou soma zero', () => {
    expect(ndviFromBands(null)).toBeNull()
    expect(ndviFromBands([1, 2, 3])).toBeNull()
    expect(ndviFromBands([0, 0, 0, 0])).toBeNull()
  })
})

describe('buildSampleGrid', () => {
  const square = {
    type: 'Polygon' as const,
    coordinates: [
      [
        [-56.1, -14.1],
        [-56.0, -14.1],
        [-56.0, -14.0],
        [-56.1, -14.0],
        [-56.1, -14.1],
      ],
    ],
  }

  it('gera pontos dentro do polígono', () => {
    const points = buildSampleGrid(square, 6, 40)
    expect(points.length).toBeGreaterThan(0)
    for (const [lng, lat] of points) {
      expect(lng).toBeGreaterThanOrEqual(-56.1)
      expect(lng).toBeLessThanOrEqual(-56.0)
      expect(lat).toBeGreaterThanOrEqual(-14.1)
      expect(lat).toBeLessThanOrEqual(-14.0)
    }
  })

  it('respeita o teto de pontos (maxPoints)', () => {
    const points = buildSampleGrid(square, 10, 5)
    expect(points.length).toBeLessThanOrEqual(5)
  })
})

describe('classifyTrend', () => {
  it('classifica recuperando quando delta > 0.05', () => {
    expect(classifyTrend(0.1)).toBe('recuperando')
  })
  it('classifica perdendo_vegetacao quando delta < -0.05', () => {
    expect(classifyTrend(-0.2)).toBe('perdendo_vegetacao')
  })
  it('classifica estavel dentro da margem', () => {
    expect(classifyTrend(0.02)).toBe('estavel')
    expect(classifyTrend(-0.02)).toBe('estavel')
  })
  it('classifica indeterminado sem dado', () => {
    expect(classifyTrend(null)).toBe('indeterminado')
  })
})
