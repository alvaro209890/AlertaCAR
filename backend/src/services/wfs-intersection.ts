import {
  area as turfArea,
  featureCollection as turfFeatureCollection,
  intersect as turfIntersect,
  multiPolygon as turfMultiPolygon,
  polygon as turfPolygon,
  union as turfUnion,
} from '@turf/turf'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'
import config from '../lib/config.js'

// Motor genérico de interseção espacial com o WFS da SEMA-MT.
// Adaptado do GeoForest-IA (backend/wfs-intersection.ts) — mesmo padrão,
// sem billing/Firebase. Ver docs/CAMADAS-SEMA.md e REUSO-GEOFOREST.md.

export type PolygonGeometry = { type: 'Polygon'; coordinates: number[][][] }
export type MultiPolygonGeometry = { type: 'MultiPolygon'; coordinates: number[][][][] }
export type SupportedPolygonGeometry = PolygonGeometry | MultiPolygonGeometry

export type IntersectionStatus = 'ok' | 'not_in_wfs' | 'no_intersection' | 'invalid_layer' | 'error'

export interface IntersectionResult {
  layerName: string
  status: IntersectionStatus
  matchedFeatures: number
  intersectionHa: number
  coveragePercentOfPolygon: number
  warnings: string[]
}

interface LayerFetchPage {
  features: Array<{ geometry?: Geometry | null; properties?: Record<string, any> }>
}

const WFS_TIMEOUT_MS = Number(process.env.WFS_TIMEOUT_MS ?? '30000')
const WFS_PAGE_SIZE = Number(process.env.WFS_PAGE_SIZE ?? '2000')
const WFS_MAX_FEATURES_PER_LAYER = Number(process.env.WFS_MAX_FEATURES_PER_LAYER ?? '20000')
const CAPABILITIES_TTL_MS = 10 * 60 * 1000
const DESCRIBE_TTL_MS = 30 * 60 * 1000

let capabilitiesCache: { expiresAt: number; layerNames: Set<string> } | null = null
const describeCache = new Map<string, { expiresAt: number; geometryField: string }>()

function nowMs() {
  return Date.now()
}

export function buildWfsUrl(params: Record<string, string | number | undefined>): string {
  const url = new URL(config.wfs.baseUrl)
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue
    url.searchParams.set(key, String(value))
  }
  if (config.wfs.authkey) url.searchParams.set('authkey', config.wfs.authkey)
  return url.toString()
}

function sleepMs(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function fetchWithTimeout(url: string, timeoutMs: number): Promise<Response> {
  let lastError: any = null
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeoutMs)
    try {
      return await fetch(url, { signal: controller.signal })
    } catch (error: any) {
      lastError = error
      if (attempt < 2) await sleepMs(500)
    } finally {
      clearTimeout(timer)
    }
  }
  throw new Error(String(lastError?.message || 'falha de rede WFS'))
}

async function fetchTextWithTimeout(url: string, timeoutMs: number): Promise<string> {
  const response = await fetchWithTimeout(url, timeoutMs)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`WFS ${response.status}: ${text.slice(0, 220)}`)
  }
  return response.text()
}

async function fetchJsonWithTimeout<T>(url: string, timeoutMs: number): Promise<T> {
  const response = await fetchWithTimeout(url, timeoutMs)
  if (!response.ok) {
    const text = await response.text().catch(() => '')
    throw new Error(`WFS ${response.status}: ${text.slice(0, 220)}`)
  }
  return response.json() as Promise<T>
}

export function parseWfsLayerNamesFromCapabilities(xml: string): string[] {
  const names: string[] = []
  const regex = /<FeatureType\b[\s\S]*?<Name>\s*([^<]+)\s*<\/Name>[\s\S]*?<\/FeatureType>/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(xml)) !== null) {
    const name = String(match[1] || '').trim()
    if (!name || !name.includes(':')) continue
    names.push(name)
  }
  return [...new Set(names)]
}

function parseNumberMatched(xml: string): number | null {
  const match = xml.match(/numberMatched="([^"]+)"/i)
  if (!match) return null
  const raw = String(match[1] || '').trim()
  if (!raw || raw.toLowerCase() === 'unknown') return null
  const numeric = Number(raw)
  return Number.isFinite(numeric) ? numeric : null
}

function parseGeometryFieldFromDescribe(xml: string): string {
  const candidates = [...xml.matchAll(/<xsd:element[^>]*name="([^"]+)"[^>]*type="gml:[^"]*PropertyType"/gi)]
    .map((m) => String(m[1] || '').trim())
    .filter(Boolean)
  if (!candidates.length) return 'GEOMETRY'
  const preferred = candidates.find((name) => name.toUpperCase() === 'GEOMETRY')
  return preferred || candidates[0]
}

export async function getCapabilitiesCached(forceRefresh = false) {
  if (!forceRefresh && capabilitiesCache && capabilitiesCache.expiresAt > nowMs()) {
    return capabilitiesCache
  }
  const url = buildWfsUrl({ service: 'WFS', request: 'GetCapabilities', version: '2.0.0' })
  const xml = await fetchTextWithTimeout(url, WFS_TIMEOUT_MS)
  const layerNames = parseWfsLayerNamesFromCapabilities(xml)
  capabilitiesCache = { expiresAt: nowMs() + CAPABILITIES_TTL_MS, layerNames: new Set(layerNames) }
  return capabilitiesCache
}

export async function getGeometryFieldForLayer(layerName: string): Promise<string> {
  const cached = describeCache.get(layerName)
  if (cached && cached.expiresAt > nowMs()) return cached.geometryField
  const url = buildWfsUrl({
    service: 'WFS',
    version: '2.0.0',
    request: 'DescribeFeatureType',
    typeNames: layerName,
  })
  const xml = await fetchTextWithTimeout(url, WFS_TIMEOUT_MS)
  const geometryField = parseGeometryFieldFromDescribe(xml)
  describeCache.set(layerName, { expiresAt: nowMs() + DESCRIBE_TTL_MS, geometryField })
  return geometryField
}

function isFiniteCoordinate(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value)
}

export function normalizeRing(ring: unknown): number[][] | null {
  if (!Array.isArray(ring) || ring.length < 3) return null
  const out: number[][] = []
  for (const point of ring) {
    if (!Array.isArray(point) || point.length < 2) return null
    const x = point[0]
    const y = point[1]
    if (!isFiniteCoordinate(x) || !isFiniteCoordinate(y)) return null
    out.push([x, y])
  }
  if (out.length < 3) return null
  const first = out[0]
  const last = out[out.length - 1]
  if (first[0] !== last[0] || first[1] !== last[1]) out.push([first[0], first[1]])
  return out.length >= 4 ? out : null
}

export function normalizePolygonGeometry(input: unknown): SupportedPolygonGeometry | null {
  if (!input || typeof input !== 'object') return null
  const raw = input as { type?: unknown; coordinates?: unknown }
  if (raw.type === 'Polygon') {
    if (!Array.isArray(raw.coordinates) || raw.coordinates.length === 0) return null
    const rings: number[][][] = []
    for (const ring of raw.coordinates) {
      const normalized = normalizeRing(ring)
      if (!normalized) return null
      rings.push(normalized)
    }
    return { type: 'Polygon', coordinates: rings }
  }
  if (raw.type === 'MultiPolygon') {
    if (!Array.isArray(raw.coordinates) || raw.coordinates.length === 0) return null
    const polygons: number[][][][] = []
    for (const poly of raw.coordinates) {
      if (!Array.isArray(poly) || poly.length === 0) return null
      const rings: number[][][] = []
      for (const ring of poly) {
        const normalized = normalizeRing(ring)
        if (!normalized) return null
        rings.push(normalized)
      }
      polygons.push(rings)
    }
    return { type: 'MultiPolygon', coordinates: polygons }
  }
  return null
}

function numberToWkt(value: number) {
  return Number(value.toFixed(8)).toString()
}

function ringToWkt(ring: number[][]) {
  return ring.map(([x, y]) => `${numberToWkt(x)} ${numberToWkt(y)}`).join(',')
}

export function polygonToWkt(geometry: SupportedPolygonGeometry): string {
  if (geometry.type === 'Polygon') {
    return `POLYGON(${geometry.coordinates.map((ring) => `(${ringToWkt(ring)})`).join(',')})`
  }
  return `MULTIPOLYGON(${geometry.coordinates
    .map((poly) => `(${poly.map((ring) => `(${ringToWkt(ring)})`).join(',')})`)
    .join(',')})`
}

function toPolygonFeature(geometry: SupportedPolygonGeometry): Feature<Polygon | MultiPolygon> {
  if (geometry.type === 'Polygon') return turfPolygon(geometry.coordinates)
  return turfMultiPolygon(geometry.coordinates)
}

function toPolygonOrMultiFeature(geometry: Geometry | null | undefined): Feature<Polygon | MultiPolygon> | null {
  if (!geometry) return null
  if (geometry.type === 'Polygon' || geometry.type === 'MultiPolygon') {
    return { type: 'Feature', properties: {}, geometry: geometry as Polygon | MultiPolygon }
  }
  return null
}

async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  if (!items.length) return []
  const out = new Array<R>(items.length)
  let cursor = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))
  const runners = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) break
      out[index] = await worker(items[index], index)
    }
  })
  await Promise.all(runners)
  return out
}

/** Busca as features de uma camada que interceptam o polígono, já recortadas (clip) ao polígono. */
export async function fetchIntersectingFeatures(
  layerName: string,
  polygonGeometry: SupportedPolygonGeometry,
): Promise<Array<{ properties: Record<string, any>; geometry: Polygon | MultiPolygon }>> {
  const polygonFeature = toPolygonFeature(polygonGeometry)
  const polygonWkt = polygonToWkt(polygonGeometry)
  const geometryField = await getGeometryFieldForLayer(layerName)
  const cqlFilter = `INTERSECTS(${geometryField},${polygonWkt})`

  const hitsUrl = buildWfsUrl({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: layerName,
    resultType: 'hits',
    CQL_FILTER: cqlFilter,
  })
  const hitsXml = await fetchTextWithTimeout(hitsUrl, WFS_TIMEOUT_MS)
  const numberMatched = parseNumberMatched(hitsXml)
  if (numberMatched === 0) return []

  let startIndex = 0
  let totalFetched = 0
  const clipped: Array<{ properties: Record<string, any>; geometry: Polygon | MultiPolygon }> = []
  let usedSinglePageFallback = false

  while (true) {
    if (totalFetched >= WFS_MAX_FEATURES_PER_LAYER) break
    const pageSize = Math.min(WFS_PAGE_SIZE, WFS_MAX_FEATURES_PER_LAYER - totalFetched)
    if (pageSize <= 0) break

    const pageUrl = buildWfsUrl({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: layerName,
      outputFormat: 'application/json',
      srsName: 'EPSG:4326',
      startIndex,
      count: pageSize,
      CQL_FILTER: cqlFilter,
    })

    let page: LayerFetchPage
    try {
      page = await fetchJsonWithTimeout<LayerFetchPage>(pageUrl, WFS_TIMEOUT_MS)
    } catch (error: any) {
      const message = String(error?.message || '')
      const requiresManualSorting = /natural order without a primary key/i.test(message)
      const isBadRequest = /\bWFS 400\b/i.test(message)
      const isTimeoutOrNetwork = /timeout|abort|ETIMEDOUT|ECONNRESET|fetch failed/i.test(message)
      if ((!requiresManualSorting && !isBadRequest && !isTimeoutOrNetwork) || usedSinglePageFallback) {
        throw error
      }
      const fallbackCount = Math.min(WFS_MAX_FEATURES_PER_LAYER, Math.max(100, WFS_PAGE_SIZE))
      const fallbackUrl = buildWfsUrl({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: layerName,
        outputFormat: 'application/json',
        srsName: 'EPSG:4326',
        count: fallbackCount,
        CQL_FILTER: cqlFilter,
      })
      page = await fetchJsonWithTimeout<LayerFetchPage>(fallbackUrl, WFS_TIMEOUT_MS)
      usedSinglePageFallback = true
    }

    const features = Array.isArray(page.features) ? page.features : []
    if (!features.length) break

    for (const rawFeature of features) {
      const polygonLike = toPolygonOrMultiFeature(rawFeature.geometry)
      if (!polygonLike) continue
      const fc = turfFeatureCollection([polygonFeature, polygonLike]) as FeatureCollection<Polygon | MultiPolygon>
      const intersection = turfIntersect(fc)
      if (!intersection) continue
      clipped.push({
        properties: rawFeature.properties || {},
        geometry: intersection.geometry as Polygon | MultiPolygon,
      })
    }

    totalFetched += features.length
    startIndex += features.length
    if (usedSinglePageFallback) break
    if (features.length < pageSize) break
    if (numberMatched !== null && startIndex >= numberMatched) break
  }

  return clipped
}

/** Calcula, para uma lista de camadas, quantos ha e % do polígono estão dentro de cada uma. */
export async function computeIntersectionHectares(
  polygonGeometry: SupportedPolygonGeometry,
  layerNames: string[],
): Promise<IntersectionResult[]> {
  const polygonFeature = toPolygonFeature(polygonGeometry)
  const polygonAreaHa = Number((turfArea(polygonFeature) / 10000).toFixed(4))

  const capabilities = await getCapabilitiesCached(false).catch(() => null)
  const available = capabilities?.layerNames ?? null

  return mapWithConcurrency(layerNames, 3, async (layerName): Promise<IntersectionResult> => {
    if (available && !available.has(layerName)) {
      return {
        layerName,
        status: 'not_in_wfs',
        matchedFeatures: 0,
        intersectionHa: 0,
        coveragePercentOfPolygon: 0,
        warnings: ['Camada não encontrada no WFS atual.'],
      }
    }
    try {
      const clipped = await fetchIntersectingFeatures(layerName, polygonGeometry)
      if (!clipped.length) {
        return {
          layerName,
          status: 'no_intersection',
          matchedFeatures: 0,
          intersectionHa: 0,
          coveragePercentOfPolygon: 0,
          warnings: [],
        }
      }
      let merged: Feature<Polygon | MultiPolygon> = {
        type: 'Feature',
        properties: {},
        geometry: clipped[0].geometry,
      }
      const warnings: string[] = []
      for (let i = 1; i < clipped.length; i += 1) {
        const fc = turfFeatureCollection([
          merged,
          { type: 'Feature', properties: {}, geometry: clipped[i].geometry },
        ]) as FeatureCollection<Polygon | MultiPolygon>
        const unioned = turfUnion(fc)
        if (!unioned) {
          warnings.push('Falha ao unir geometrias de interseção; mantendo união parcial.')
          continue
        }
        merged = unioned as Feature<Polygon | MultiPolygon>
      }
      const intersectionHa = Number((turfArea(merged) / 10000).toFixed(4))
      const coveragePercentOfPolygon = polygonAreaHa > 0 ? Number(((intersectionHa / polygonAreaHa) * 100).toFixed(4)) : 0
      return {
        layerName,
        status: 'ok',
        matchedFeatures: clipped.length,
        intersectionHa,
        coveragePercentOfPolygon,
        warnings,
      }
    } catch (error: any) {
      return {
        layerName,
        status: 'error',
        matchedFeatures: 0,
        intersectionHa: 0,
        coveragePercentOfPolygon: 0,
        warnings: [String(error?.message || error || 'Erro interno')],
      }
    }
  })
}
