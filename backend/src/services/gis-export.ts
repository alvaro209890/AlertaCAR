/**
 * Fase 9.2 — Exportações GIS: converte camadas de feições (CAR, alertas, camadas do imóvel)
 * para os formatos que um consultor abre direto no QGIS/ArcGIS: SHP (.zip), GeoJSON, KML, KMZ,
 * CSV (com WKT) e GeoPackage (.gpkg).
 *
 * Sem lib externa para os formatos binários (SHP reaproveita o writer portado do GeoForest,
 * GPKG é escrito à mão sobre better-sqlite3 seguindo o padrão OGC GeoPackage 1.3).
 */
import archiver from 'archiver'
import Database from 'better-sqlite3'
import type { MultiPolygon, Point, Polygon } from 'geojson'
import {
  buildDbfBuffer,
  buildPointShpAndShx,
  buildShpAndShx,
  geojsonToShpRecords,
  type DbfFieldDef,
} from './shapefile-writer.js'

export type ExportGeometry = Point | Polygon | MultiPolygon

export interface ExportFeature {
  geometry: ExportGeometry | null
  properties: Record<string, string | number | null>
}

export interface ExportLayer {
  /** Identificador curto (vira nome de arquivo/tabela) — só [a-zA-Z0-9_]. */
  key: string
  label: string
  features: ExportFeature[]
}

export type ExportFormat = 'geojson' | 'kml' | 'kmz' | 'shp' | 'csv' | 'gpkg'

export interface ExportResult {
  buffer: Buffer
  filename: string
  contentType: string
}

const CONTENT_TYPES: Record<ExportFormat, string> = {
  geojson: 'application/geo+json',
  kml: 'application/vnd.google-earth.kml+xml',
  kmz: 'application/vnd.google-earth.kmz',
  shp: 'application/zip',
  csv: 'text/csv',
  gpkg: 'application/geopackage+sqlite3',
}

const WGS84_WKT =
  'GEOGCS["WGS 84",DATUM["WGS_1984",SPHEROID["WGS 84",6378137,298.257223563]],' +
  'PRIMEM["Greenwich",0],UNIT["degree",0.0174532925199433],AUTHORITY["EPSG","4326"]]'

function sanitizeKey(key: string): string {
  const cleaned = key.replace(/[^a-zA-Z0-9_]/g, '_').replace(/^(\d)/, '_$1')
  return cleaned || 'layer'
}

export async function buildExport(
  format: ExportFormat,
  layers: ExportLayer[],
  baseName: string,
): Promise<ExportResult> {
  const safeBaseName = sanitizeKey(baseName)
  const nonEmptyLayers = layers.filter((l) => l.features.length > 0)

  switch (format) {
    case 'geojson':
      return buildGeoJsonExport(nonEmptyLayers, safeBaseName)
    case 'csv':
      return buildCsvExport(nonEmptyLayers, safeBaseName)
    case 'kml':
      return buildKmlExport(nonEmptyLayers, safeBaseName, false)
    case 'kmz':
      return buildKmlExport(nonEmptyLayers, safeBaseName, true)
    case 'shp':
      return buildShapefileExport(nonEmptyLayers, safeBaseName)
    case 'gpkg':
      return buildGeoPackageExport(nonEmptyLayers, safeBaseName)
    default:
      throw new Error(`Formato de export não suportado: ${format}`)
  }
}

/* ─── GeoJSON ────────────────────────────────────────────────── */

function featureToGeoJson(feature: ExportFeature) {
  return { type: 'Feature', geometry: feature.geometry, properties: feature.properties }
}

async function buildGeoJsonExport(layers: ExportLayer[], baseName: string): Promise<ExportResult> {
  if (layers.length <= 1) {
    const features = layers[0]?.features ?? []
    const fc = { type: 'FeatureCollection', features: features.map(featureToGeoJson) }
    return {
      buffer: Buffer.from(JSON.stringify(fc)),
      filename: `${baseName}.geojson`,
      contentType: CONTENT_TYPES.geojson,
    }
  }

  const zipEntries = layers.map((layer) => ({
    name: `${sanitizeKey(layer.key)}.geojson`,
    content: Buffer.from(
      JSON.stringify({ type: 'FeatureCollection', features: layer.features.map(featureToGeoJson) }),
    ),
  }))
  const buffer = await zipBuffers(zipEntries)
  return { buffer, filename: `${baseName}_geojson.zip`, contentType: 'application/zip' }
}

/* ─── CSV (com coluna WKT) ───────────────────────────────────── */

function csvEscape(value: string | number | null): string {
  if (value === null || value === undefined) return ''
  const str = String(value)
  if (/[",\n;]/.test(str)) return `"${str.replace(/"/g, '""')}"`
  return str
}

function layerToCsv(features: ExportFeature[]): string {
  const propKeys = new Set<string>()
  for (const f of features) for (const k of Object.keys(f.properties)) propKeys.add(k)
  const columns = [...propKeys]
  const header = [...columns, 'wkt_geom'].map(csvEscape).join(',')
  const rows = features.map((f) => {
    const values = columns.map((c) => csvEscape(f.properties[c] ?? null))
    values.push(csvEscape(f.geometry ? geometryToWkt(f.geometry) : ''))
    return values.join(',')
  })
  return [header, ...rows].join('\n')
}

async function buildCsvExport(layers: ExportLayer[], baseName: string): Promise<ExportResult> {
  if (layers.length <= 1) {
    const csv = layerToCsv(layers[0]?.features ?? [])
    return { buffer: Buffer.from(csv, 'utf-8'), filename: `${baseName}.csv`, contentType: CONTENT_TYPES.csv }
  }
  const zipEntries = layers.map((layer) => ({
    name: `${sanitizeKey(layer.key)}.csv`,
    content: Buffer.from(layerToCsv(layer.features), 'utf-8'),
  }))
  const buffer = await zipBuffers(zipEntries)
  return { buffer, filename: `${baseName}_csv.zip`, contentType: 'application/zip' }
}

/* ─── WKT ────────────────────────────────────────────────────── */

function ringToWkt(ring: number[][]): string {
  return `(${ring.map(([x, y]) => `${x} ${y}`).join(', ')})`
}

export function geometryToWkt(geometry: ExportGeometry): string {
  if (geometry.type === 'Point') {
    const [x, y] = geometry.coordinates
    return `POINT (${x} ${y})`
  }
  if (geometry.type === 'Polygon') {
    return `POLYGON (${geometry.coordinates.map(ringToWkt).join(', ')})`
  }
  return `MULTIPOLYGON (${geometry.coordinates.map((poly) => `(${poly.map(ringToWkt).join(', ')})`).join(', ')})`
}

/* ─── KML / KMZ ──────────────────────────────────────────────── */

function xmlEscape(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function ringToKmlCoords(ring: number[][]): string {
  return ring.map(([x, y]) => `${x},${y},0`).join(' ')
}

function polygonRingsToKml(rings: number[][][]): string {
  const [outer, ...holes] = rings
  const outerKml = `<outerBoundaryIs><LinearRing><coordinates>${ringToKmlCoords(outer)}</coordinates></LinearRing></outerBoundaryIs>`
  const holesKml = holes
    .map((h) => `<innerBoundaryIs><LinearRing><coordinates>${ringToKmlCoords(h)}</coordinates></LinearRing></innerBoundaryIs>`)
    .join('')
  return `${outerKml}${holesKml}`
}

function geometryToKml(geometry: ExportGeometry): string {
  if (geometry.type === 'Point') {
    const [x, y] = geometry.coordinates
    return `<Point><coordinates>${x},${y},0</coordinates></Point>`
  }
  if (geometry.type === 'Polygon') {
    return `<Polygon>${polygonRingsToKml(geometry.coordinates)}</Polygon>`
  }
  const polys = geometry.coordinates.map((rings) => `<Polygon>${polygonRingsToKml(rings)}</Polygon>`).join('')
  return `<MultiGeometry>${polys}</MultiGeometry>`
}

function featureToKmlPlacemark(feature: ExportFeature): string {
  const name = feature.properties.nome ?? feature.properties.name ?? feature.properties.titulo ?? feature.properties.id ?? ''
  const extendedData = Object.entries(feature.properties)
    .map(([k, v]) => `<Data name="${xmlEscape(k)}"><value>${xmlEscape(String(v ?? ''))}</value></Data>`)
    .join('')
  const geometryKml = feature.geometry ? geometryToKml(feature.geometry) : ''
  return (
    `<Placemark><name>${xmlEscape(String(name))}</name>` +
    `<ExtendedData>${extendedData}</ExtendedData>${geometryKml}</Placemark>`
  )
}

function layerToKmlFolder(layer: ExportLayer): string {
  const placemarks = layer.features.map(featureToKmlPlacemark).join('')
  return `<Folder><name>${xmlEscape(layer.label)}</name>${placemarks}</Folder>`
}

function buildKmlDocument(layers: ExportLayer[], docName: string): string {
  const folders = layers.map(layerToKmlFolder).join('')
  return (
    '<?xml version="1.0" encoding="UTF-8"?>' +
    '<kml xmlns="http://www.opengis.net/kml/2.2">' +
    `<Document><name>${xmlEscape(docName)}</name>${folders}</Document></kml>`
  )
}

async function buildKmlExport(layers: ExportLayer[], baseName: string, kmz: boolean): Promise<ExportResult> {
  const kml = buildKmlDocument(layers, baseName)
  if (!kmz) {
    return { buffer: Buffer.from(kml, 'utf-8'), filename: `${baseName}.kml`, contentType: CONTENT_TYPES.kml }
  }
  const buffer = await zipBuffers([{ name: 'doc.kml', content: Buffer.from(kml, 'utf-8') }])
  return { buffer, filename: `${baseName}.kmz`, contentType: CONTENT_TYPES.kmz }
}

/* ─── Shapefile (.zip com .shp/.shx/.dbf/.prj por camada e tipo de geometria) ── */

function inferDbfFields(features: ExportFeature[]): DbfFieldDef[] {
  const keys = new Set<string>()
  for (const f of features) for (const k of Object.keys(f.properties)) keys.add(k)

  const usedNames = new Set<string>()
  const fields: DbfFieldDef[] = []
  for (const key of keys) {
    let name = key.slice(0, 10).toUpperCase().replace(/[^A-Z0-9_]/g, '_') || 'F'
    let suffix = 1
    while (usedNames.has(name)) {
      const base = name.slice(0, 8)
      name = `${base}${suffix}`
      suffix += 1
    }
    usedNames.add(name)

    const values = features.map((f) => f.properties[key])
    const allNumeric = values.every((v) => v === null || v === undefined || typeof v === 'number')
    if (allNumeric) {
      const hasDecimal = values.some((v) => typeof v === 'number' && !Number.isInteger(v))
      fields.push({ name, type: 'N', length: 18, decimals: hasDecimal ? 4 : 0 })
    } else {
      const maxLen = Math.max(1, ...values.map((v) => String(v ?? '').length))
      fields.push({ name, type: 'C', length: Math.min(254, maxLen), decimals: 0 })
    }
  }
  return fields
}

function buildDbfRows(features: ExportFeature[], fields: DbfFieldDef[], originalKeys: string[]): Array<Record<string, string | number | null>> {
  return features.map((f) => {
    const row: Record<string, string | number | null> = {}
    fields.forEach((field, i) => {
      row[field.name] = f.properties[originalKeys[i]] ?? null
    })
    return row
  })
}

async function buildShapefileExport(layers: ExportLayer[], baseName: string): Promise<ExportResult> {
  const entries: Array<{ name: string; content: Buffer }> = []

  for (const layer of layers) {
    const key = sanitizeKey(layer.key)
    const pointFeatures = layer.features.filter((f) => f.geometry?.type === 'Point')
    const polyFeatures = layer.features.filter((f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')

    if (polyFeatures.length) {
      const originalKeys = [...new Set(polyFeatures.flatMap((f) => Object.keys(f.properties)))]
      const fields = inferDbfFields(polyFeatures)
      const shpRecords = polyFeatures.flatMap((f) =>
        geojsonToShpRecords(f.geometry as Polygon | MultiPolygon, f.properties as Record<string, string | number | null>),
      )
      const { shp, shx } = buildShpAndShx(shpRecords, 5)
      const dbf = buildDbfBuffer(buildDbfRows(polyFeatures, fields, originalKeys), fields)
      entries.push(
        { name: `${key}.shp`, content: shp },
        { name: `${key}.shx`, content: shx },
        { name: `${key}.dbf`, content: dbf },
        { name: `${key}.prj`, content: Buffer.from(WGS84_WKT, 'ascii') },
      )
    }

    if (pointFeatures.length) {
      const originalKeys = [...new Set(pointFeatures.flatMap((f) => Object.keys(f.properties)))]
      const fields = inferDbfFields(pointFeatures)
      const { shp, shx } = buildPointShpAndShx(
        pointFeatures.map((f) => ({
          coordinates: (f.geometry as Point).coordinates as [number, number],
          attributes: f.properties,
        })),
      )
      const dbf = buildDbfBuffer(buildDbfRows(pointFeatures, fields, originalKeys), fields)
      const suffix = polyFeatures.length ? '_pontos' : ''
      entries.push(
        { name: `${key}${suffix}.shp`, content: shp },
        { name: `${key}${suffix}.shx`, content: shx },
        { name: `${key}${suffix}.dbf`, content: dbf },
        { name: `${key}${suffix}.prj`, content: Buffer.from(WGS84_WKT, 'ascii') },
      )
    }
  }

  const buffer = await zipBuffers(entries)
  return { buffer, filename: `${baseName}_shp.zip`, contentType: CONTENT_TYPES.shp }
}

/* ─── GeoPackage (.gpkg) ─────────────────────────────────────── */

function wkbPoint(coords: [number, number]): Buffer {
  const buf = Buffer.alloc(21)
  buf.writeUInt8(1, 0) // little-endian
  buf.writeUInt32LE(1, 1) // wkbPoint
  buf.writeDoubleLE(coords[0], 5)
  buf.writeDoubleLE(coords[1], 13)
  return buf
}

function wkbPolygonBody(rings: number[][][]): Buffer {
  const parts: Buffer[] = []
  const numRingsBuf = Buffer.alloc(4)
  numRingsBuf.writeUInt32LE(rings.length, 0)
  parts.push(numRingsBuf)
  for (const ring of rings) {
    const numPointsBuf = Buffer.alloc(4)
    numPointsBuf.writeUInt32LE(ring.length, 0)
    parts.push(numPointsBuf)
    for (const [x, y] of ring) {
      const pointBuf = Buffer.alloc(16)
      pointBuf.writeDoubleLE(x, 0)
      pointBuf.writeDoubleLE(y, 8)
      parts.push(pointBuf)
    }
  }
  return Buffer.concat(parts)
}

function wkbPolygon(rings: number[][][]): Buffer {
  const header = Buffer.alloc(5)
  header.writeUInt8(1, 0)
  header.writeUInt32LE(3, 1) // wkbPolygon
  return Buffer.concat([header, wkbPolygonBody(rings)])
}

function wkbMultiPolygon(polys: number[][][][]): Buffer {
  const header = Buffer.alloc(5)
  header.writeUInt8(1, 0)
  header.writeUInt32LE(6, 1) // wkbMultiPolygon
  const countBuf = Buffer.alloc(4)
  countBuf.writeUInt32LE(polys.length, 0)
  const polyBufs = polys.map((rings) => wkbPolygon(rings))
  return Buffer.concat([header, countBuf, ...polyBufs])
}

function geometryToWkb(geometry: ExportGeometry): Buffer {
  if (geometry.type === 'Point') return wkbPoint(geometry.coordinates as [number, number])
  if (geometry.type === 'Polygon') return wkbPolygon(geometry.coordinates as number[][][])
  return wkbMultiPolygon(geometry.coordinates as number[][][][])
}

/** Envelope binário GeoPackage: magic "GP" + versão + flags + srs_id + WKB (sem envelope, padrão OGC). */
function geoPackageBlob(geometry: ExportGeometry, srsId = 4326): Buffer {
  const header = Buffer.alloc(8)
  header.write('GP', 0, 'ascii')
  header.writeUInt8(0, 2) // version
  header.writeUInt8(0x01, 3) // flags: little-endian header, no envelope, not empty, standard
  header.writeInt32LE(srsId, 4)
  return Buffer.concat([header, geometryToWkb(geometry)])
}

function gpkgGeometryTypeName(features: ExportFeature[]): string {
  const hasPoly = features.some((f) => f.geometry?.type === 'Polygon' || f.geometry?.type === 'MultiPolygon')
  const hasPoint = features.some((f) => f.geometry?.type === 'Point')
  if (hasPoly && !hasPoint) return 'MULTIPOLYGON'
  if (hasPoint && !hasPoly) return 'POINT'
  return 'GEOMETRY'
}

async function buildGeoPackageExport(layers: ExportLayer[], baseName: string): Promise<ExportResult> {
  const db = new Database(':memory:')
  db.pragma('application_id = 1196444487') // 'GPKG' ascii
  db.pragma('user_version = 10300') // 1.3.0

  db.exec(`
    CREATE TABLE gpkg_spatial_ref_sys (
      srs_name TEXT NOT NULL, srs_id INTEGER NOT NULL PRIMARY KEY,
      organization TEXT NOT NULL, organization_coordsys_id INTEGER NOT NULL,
      definition TEXT NOT NULL, description TEXT
    );
    CREATE TABLE gpkg_contents (
      table_name TEXT NOT NULL PRIMARY KEY, data_type TEXT NOT NULL, identifier TEXT UNIQUE,
      description TEXT DEFAULT '', last_change TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
      min_x DOUBLE, min_y DOUBLE, max_x DOUBLE, max_y DOUBLE, srs_id INTEGER,
      CONSTRAINT fk_gc_r_srs_id FOREIGN KEY (srs_id) REFERENCES gpkg_spatial_ref_sys(srs_id)
    );
    CREATE TABLE gpkg_geometry_columns (
      table_name TEXT NOT NULL, column_name TEXT NOT NULL, geometry_type_name TEXT NOT NULL,
      srs_id INTEGER NOT NULL, z TINYINT NOT NULL, m TINYINT NOT NULL,
      CONSTRAINT pk_geom_cols PRIMARY KEY (table_name, column_name),
      CONSTRAINT fk_gc_tn FOREIGN KEY (table_name) REFERENCES gpkg_contents(table_name)
    );
    INSERT INTO gpkg_spatial_ref_sys VALUES
      ('Undefined cartesian SRS', -1, 'NONE', -1, 'undefined', 'undefined cartesian coordinate reference system'),
      ('Undefined geographic SRS', 0, 'NONE', 0, 'undefined', 'undefined geographic coordinate reference system'),
      ('WGS 84 geodetic', 4326, 'EPSG', 4326, '${WGS84_WKT}', 'longitude/latitude WGS 84');
  `)

  const insertContents = db.prepare(
    `INSERT INTO gpkg_contents (table_name, data_type, identifier, min_x, min_y, max_x, max_y, srs_id) VALUES (?, 'features', ?, ?, ?, ?, ?, 4326)`,
  )
  const insertGeomCol = db.prepare(
    `INSERT INTO gpkg_geometry_columns (table_name, column_name, geometry_type_name, srs_id, z, m) VALUES (?, 'geom', ?, 4326, 0, 0)`,
  )

  for (const layer of layers) {
    const table = sanitizeKey(layer.key)
    const originalKeys = [...new Set(layer.features.flatMap((f) => Object.keys(f.properties)))]
    const columns = originalKeys.map((k, i) => `attr_${i} TEXT`).join(', ')
    db.exec(`CREATE TABLE "${table}" (fid INTEGER PRIMARY KEY AUTOINCREMENT, geom BLOB${columns ? ', ' + columns : ''})`)

    const placeholders = ['geom', ...originalKeys.map((_, i) => `attr_${i}`)].map(() => '?').join(', ')
    const cols = ['geom', ...originalKeys.map((_, i) => `attr_${i}`)].join(', ')
    const insertRow = db.prepare(`INSERT INTO "${table}" (${cols}) VALUES (${placeholders})`)

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
    const insertAll = db.transaction((features: ExportFeature[]) => {
      for (const f of features) {
        if (!f.geometry) continue
        const blob = geoPackageBlob(f.geometry)
        const values = originalKeys.map((k) => {
          const v = f.properties[k]
          return v === null || v === undefined ? null : String(v)
        })
        insertRow.run(blob, ...values)
        for (const [x, y] of collectXY(f.geometry)) {
          if (x < minX) minX = x
          if (y < minY) minY = y
          if (x > maxX) maxX = x
          if (y > maxY) maxY = y
        }
      }
    })
    insertAll(layer.features)

    insertContents.run(
      table,
      layer.label,
      Number.isFinite(minX) ? minX : null,
      Number.isFinite(minY) ? minY : null,
      Number.isFinite(maxX) ? maxX : null,
      Number.isFinite(maxY) ? maxY : null,
    )
    insertGeomCol.run(table, gpkgGeometryTypeName(layer.features))
  }

  const buffer = db.serialize() as Buffer
  db.close()
  return { buffer, filename: `${baseName}.gpkg`, contentType: CONTENT_TYPES.gpkg }
}

function collectXY(geometry: ExportGeometry): Array<[number, number]> {
  if (geometry.type === 'Point') return [geometry.coordinates as [number, number]]
  if (geometry.type === 'Polygon') return geometry.coordinates.flat() as Array<[number, number]>
  return geometry.coordinates.flat(2) as unknown as Array<[number, number]>
}

/* ─── ZIP helper (archiver → Buffer) ─────────────────────────── */

function zipBuffers(entries: Array<{ name: string; content: Buffer }>): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const archive = archiver('zip', { zlib: { level: 9 } })
    const chunks: Buffer[] = []
    archive.on('data', (chunk: Buffer) => chunks.push(chunk))
    archive.on('error', reject)
    archive.on('end', () => resolve(Buffer.concat(chunks)))
    for (const entry of entries) archive.append(entry.content, { name: entry.name })
    archive.finalize()
  })
}
