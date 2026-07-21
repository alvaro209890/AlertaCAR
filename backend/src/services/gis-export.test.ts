import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import Database from 'better-sqlite3'
import { describe, expect, it } from 'vitest'
import { buildExport, geometryToWkt, type ExportLayer } from './gis-export.js'

const squarePolygon = {
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

const polygonLayer: ExportLayer[] = [
  {
    key: 'car_atp',
    label: 'Polígono do CAR',
    features: [{ geometry: squarePolygon, properties: { carNumber: 'MT271442/2017', areaHa: 123.456 } }],
  },
]

const pointLayer: ExportLayer[] = [
  {
    key: 'alerts',
    label: 'Alertas',
    features: [
      { geometry: { type: 'Point', coordinates: [-55.1, -11.5] }, properties: { classe: 'DESMATAMENTO_CR', areaHa: 2.1 } },
      { geometry: { type: 'Point', coordinates: [-55.2, -11.6] }, properties: { classe: 'QUEIMADA', areaHa: 0.5 } },
    ],
  },
]

describe('geometryToWkt', () => {
  it('escreve POINT', () => {
    expect(geometryToWkt({ type: 'Point', coordinates: [-55, -11] })).toBe('POINT (-55 -11)')
  })

  it('escreve POLYGON com anéis', () => {
    const wkt = geometryToWkt(squarePolygon)
    expect(wkt.startsWith('POLYGON ((')).toBe(true)
    expect(wkt).toContain('-55 -12')
  })
})

describe('buildExport geojson', () => {
  it('gera FeatureCollection válido para uma camada', async () => {
    const result = await buildExport('geojson', polygonLayer, 'car_MT271442')
    expect(result.filename).toBe('car_MT271442.geojson')
    const parsed = JSON.parse(result.buffer.toString('utf-8'))
    expect(parsed.type).toBe('FeatureCollection')
    expect(parsed.features).toHaveLength(1)
    expect(parsed.features[0].properties.carNumber).toBe('MT271442/2017')
  })

  it('zipa múltiplas camadas em arquivos separados', async () => {
    const result = await buildExport('geojson', [...polygonLayer, ...pointLayer], 'carteira')
    expect(result.filename).toBe('carteira_geojson.zip')
    expect(result.buffer.subarray(0, 2).toString('ascii')).toBe('PK')
  })
})

describe('buildExport csv', () => {
  it('inclui coluna wkt_geom', async () => {
    const result = await buildExport('csv', polygonLayer, 'car')
    const csv = result.buffer.toString('utf-8')
    expect(csv).toContain('wkt_geom')
    expect(csv).toContain('POLYGON')
  })
})

describe('buildExport kml/kmz', () => {
  it('kml contém Placemark com coordenadas', async () => {
    const result = await buildExport('kml', pointLayer, 'alertas')
    const kml = result.buffer.toString('utf-8')
    expect(kml).toContain('<Placemark>')
    expect(kml).toContain('<Point><coordinates>-55.1,-11.5,0</coordinates></Point>')
  })

  it('kmz é um zip válido contendo doc.kml', async () => {
    const result = await buildExport('kmz', pointLayer, 'alertas')
    expect(result.buffer.subarray(0, 2).toString('ascii')).toBe('PK')
  })
})

describe('buildExport shp', () => {
  it('gera zip com .shp/.shx/.dbf/.prj para polígono', async () => {
    const result = await buildExport('shp', polygonLayer, 'car')
    expect(result.buffer.subarray(0, 2).toString('ascii')).toBe('PK')
    expect(result.filename).toBe('car_shp.zip')
  })

  it('separa pontos e polígonos quando a camada mistura tipos', async () => {
    const mixed: ExportLayer[] = [
      {
        key: 'misto',
        label: 'Misto',
        features: [...polygonLayer[0].features, ...pointLayer[0].features],
      },
    ]
    const result = await buildExport('shp', mixed, 'misto')
    expect(result.buffer.length).toBeGreaterThan(0)
  })
})

describe('buildExport gpkg', () => {
  it('gera um GeoPackage válido e legível pelo better-sqlite3', async () => {
    const result = await buildExport('gpkg', [...polygonLayer, ...pointLayer], 'carteira')

    const dir = mkdtempSync(path.join(tmpdir(), 'gpkg-test-'))
    const file = path.join(dir, 'out.gpkg')
    writeFileSync(file, result.buffer)

    const db = new Database(file, { readonly: true })
    const appId = db.pragma('application_id', { simple: true }) as number
    expect(appId).toBe(1196444487)

    const contents = db.prepare('SELECT table_name FROM gpkg_contents ORDER BY table_name').all() as Array<{ table_name: string }>
    expect(contents.map((c) => c.table_name).sort()).toEqual(['alerts', 'car_atp'])

    const rows = db.prepare('SELECT * FROM car_atp').all() as Array<{ geom: Buffer }>
    expect(rows).toHaveLength(1)
    expect(rows[0].geom.subarray(0, 2).toString('ascii')).toBe('GP')

    db.close()
    rmSync(dir, { recursive: true, force: true })
  })
})
