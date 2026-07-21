import { bbox as turfBbox, booleanPointInPolygon as turfBooleanPointInPolygon, multiPolygon as turfMultiPolygon, point as turfPoint, polygon as turfPolygon } from '@turf/turf'
import type { Feature, MultiPolygon, Polygon } from 'geojson'
import { buildWfsUrl, type SupportedPolygonGeometry } from './wfs-intersection.js'

// Fase 6 — catálogo de satélites/mosaicos WMS da SEMA-MT (verificado ao vivo em 21/07/2026
// contra GetCapabilities). WCS está desabilitado no servidor (WCS GetCapabilities → "Service
// WCS is disabled"), então não há como baixar banda bruta em GeoTIFF — o NDVI real (Fase 6.2)
// é obtido amostrando pixels via WMS GetFeatureInfo (ver computeNdviForYear abaixo), não por
// um "layer NIR" dedicado: o estilo "..._NIR" listado no GetCapabilities existe só como legenda
// e retorna a MESMA imagem RGB do layer base (confirmado comparando hash do PNG com/sem STYLES=
// ..._NIR) — por isso NÃO existe uma aba "falsa-cor NIR" nesta implementação, ao contrário do que
// o plano original presumia antes desta descoberta.

export interface SatelliteDef {
  id: string
  label: string
  years: number[]
  layerForYear: (year: number) => string
}

function range(from: number, to: number, exclude: number[] = []): number[] {
  const out: number[] = []
  for (let y = from; y <= to; y += 1) if (!exclude.includes(y)) out.push(y)
  return out
}

export const SATELLITE_CATALOG: SatelliteDef[] = [
  {
    id: 'landsat5',
    label: 'Landsat 5 (1984–2011)',
    years: range(1984, 2011, [2001, 2002]),
    layerForYear: (year) => `Mosaicos:LANDSAT_5_${year}`,
  },
  {
    id: 'landsat7',
    label: 'Landsat 7 (2002)',
    years: [2002],
    layerForYear: () => 'Mosaicos:LANDSAT_7_2002',
  },
  {
    id: 'landsat8',
    label: 'Landsat 8 (2013–2018)',
    years: range(2013, 2018),
    layerForYear: (year) => `Mosaicos:LANDSAT_8_${year}`,
  },
  {
    id: 'sentinel2',
    label: 'Sentinel-2 (2016–2025)',
    years: range(2016, 2025),
    layerForYear: (year) => `Mosaicos:SENTINEL_2_${year}`,
  },
  {
    id: 'resourcesat',
    label: 'RESOURCESAT (2012)',
    years: [2012],
    layerForYear: () => 'Mosaicos:RESOURCESAT_2012',
  },
  {
    id: 'spot',
    label: 'SPOT/SEPLAN (mosaico estadual)',
    years: [],
    layerForYear: () => 'Mosaicos:MOSAICO_SPOT_SEPLAN',
  },
]

/** Satélite que serve de fonte para NDVI (única com banda NIR confirmada via GetFeatureInfo). */
export const NDVI_SATELLITE_ID = 'sentinel2'
export const NDVI_AVAILABLE_YEARS = SATELLITE_CATALOG.find((s) => s.id === NDVI_SATELLITE_ID)!.years

export function getSatelliteCatalog() {
  return SATELLITE_CATALOG.map((s) => ({ id: s.id, label: s.label, years: s.years }))
}

function toPolygonFeature(geometry: SupportedPolygonGeometry): Feature<Polygon | MultiPolygon> {
  return geometry.type === 'Polygon' ? turfPolygon(geometry.coordinates) : turfMultiPolygon(geometry.coordinates)
}

export function bboxForGeometry(geometry: SupportedPolygonGeometry, paddingRatio = 0.15): [number, number, number, number] {
  const [minX, minY, maxX, maxY] = turfBbox(toPolygonFeature(geometry))
  const padX = (maxX - minX) * paddingRatio || 0.001
  const padY = (maxY - minY) * paddingRatio || 0.001
  return [minX - padX, minY - padY, maxX + padX, maxY + padY]
}

const WMS_TIMEOUT_MS = Number(process.env.WFS_TIMEOUT_MS ?? '30000')

async function fetchWithRetry(url: string, retries = 2): Promise<Response> {
  let lastError: any = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WMS_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: controller.signal })
      return res
    } catch (err) {
      lastError = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, 800 * attempt))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

/** GetMap cropped ao bbox informado — usado pelo front para exibir o CAR sobre um ano/satélite. */
export function buildFrameUrl(layerName: string, bbox: [number, number, number, number], width = 512, height = 512): string {
  const [minX, minY, maxX, maxY] = bbox
  return buildWfsUrl({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetMap',
    layers: layerName,
    crs: 'EPSG:4326',
    bbox: `${minY},${minX},${maxY},${maxX}`,
    width,
    height,
    format: 'image/png',
  })
}

/** Extrai valores de banda de um GetFeatureInfo — a chave real varia por ano (ex.: MOSAICO_SENTINEL2_2016_3
 *  vs MOSAICO_SENTINEL_2_2024_3), então casamos pelo sufixo numérico "_N" em vez do prefixo. */
export function parseBandsFromFeatureInfo(json: any): number[] | null {
  const props = json?.features?.[0]?.properties
  if (!props || typeof props !== 'object') return null
  const bands: number[] = []
  for (const [key, value] of Object.entries(props)) {
    const match = /_(\d+)$/.exec(key)
    if (!match) continue
    const idx = Number(match[1])
    const num = Number(value)
    if (Number.isFinite(num)) bands[idx] = num
  }
  return bands.length ? bands : null
}

async function fetchPixelBands(layerName: string, lng: number, lat: number): Promise<number[] | null> {
  const delta = 0.0003
  const bbox = `${lat - delta},${lng - delta},${lat + delta},${lng + delta}`
  const url = buildWfsUrl({
    service: 'WMS',
    version: '1.3.0',
    request: 'GetFeatureInfo',
    layers: layerName,
    query_layers: layerName,
    crs: 'EPSG:4326',
    bbox,
    width: 3,
    height: 3,
    i: 1,
    j: 1,
    info_format: 'application/json',
  })
  try {
    const res = await fetchWithRetry(url)
    if (!res.ok) return null
    const json = await res.json()
    return parseBandsFromFeatureInfo(json)
  } catch {
    return null
  }
}

/** NDVI simplificado: (NIR−RED)/(NIR+RED) usando banda 3 = NIR e banda 2 = RED, confirmado ao vivo
 *  amostrando um pixel de floresta densa (banda 3 muito acima das demais) e um pixel urbano (bandas
 *  próximas). Não é NDVI de reflectância calibrada (o mosaico é um produto 8/16-bit já processado
 *  pela SEMA) — serve para COMPARAÇÃO relativa (tendência ano a ano no mesmo imóvel), não para
 *  comparar com NDVI de outra fonte/sensor. */
export function ndviFromBands(bands: number[] | null): number | null {
  if (!bands || bands.length < 4) return null
  const nir = bands[3]
  const red = bands[2]
  if (!Number.isFinite(nir) || !Number.isFinite(red)) return null
  const denom = nir + red
  if (denom === 0) return null
  return (nir - red) / denom
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, worker: (item: T) => Promise<R>): Promise<R[]> {
  if (!items.length) return []
  const out = new Array<R>(items.length)
  let cursor = 0
  const workerCount = Math.max(1, Math.min(limit, items.length))
  const runners = Array.from({ length: workerCount }, async () => {
    while (true) {
      const index = cursor
      cursor += 1
      if (index >= items.length) break
      out[index] = await worker(items[index])
    }
  })
  await Promise.all(runners)
  return out
}

export function buildSampleGrid(geometry: SupportedPolygonGeometry, gridSize: number, maxPoints: number): Array<[number, number]> {
  const [minX, minY, maxX, maxY] = bboxForGeometry(geometry, 0)
  const feature = toPolygonFeature(geometry)
  const points: Array<[number, number]> = []
  for (let ix = 0; ix < gridSize; ix += 1) {
    for (let iy = 0; iy < gridSize; iy += 1) {
      const lng = minX + ((ix + 0.5) / gridSize) * (maxX - minX)
      const lat = minY + ((iy + 0.5) / gridSize) * (maxY - minY)
      try {
        if (turfBooleanPointInPolygon(turfPoint([lng, lat]), feature)) points.push([lng, lat])
      } catch {
        continue
      }
    }
  }
  if (points.length <= maxPoints) return points
  // Reduz mantendo espalhamento (pega 1 a cada N em vez de só os primeiros).
  const step = points.length / maxPoints
  const sampled: Array<[number, number]> = []
  for (let i = 0; i < maxPoints; i += 1) sampled.push(points[Math.floor(i * step)])
  return sampled
}

export interface NdviSampleResult {
  year: number
  meanNdvi: number | null
  minNdvi: number | null
  maxNdvi: number | null
  pctVegetacao: number | null
  sampledPoints: number
  attemptedPoints: number
}

const VEGETACAO_NDVI_THRESHOLD = 0.3

/** Amostra NDVI para um ano do Sentinel-2 dentro do polígono do CAR via grade de pontos + GetFeatureInfo. */
export async function sampleNdviForYear(
  geometry: SupportedPolygonGeometry,
  year: number,
  opts: { gridSize?: number; maxPoints?: number; concurrency?: number } = {},
): Promise<NdviSampleResult> {
  const satellite = SATELLITE_CATALOG.find((s) => s.id === NDVI_SATELLITE_ID)!
  const layerName = satellite.layerForYear(year)
  const gridSize = opts.gridSize ?? 8
  const maxPoints = opts.maxPoints ?? 40
  const concurrency = opts.concurrency ?? 5

  const points = buildSampleGrid(geometry, gridSize, maxPoints)
  const ndviValues = await mapWithConcurrency(points, concurrency, async ([lng, lat]) => {
    const bands = await fetchPixelBands(layerName, lng, lat)
    return ndviFromBands(bands)
  })

  const valid = ndviValues.filter((v): v is number => v !== null && Number.isFinite(v))
  if (!valid.length) {
    return {
      year,
      meanNdvi: null,
      minNdvi: null,
      maxNdvi: null,
      pctVegetacao: null,
      sampledPoints: 0,
      attemptedPoints: points.length,
    }
  }

  const mean = valid.reduce((a, b) => a + b, 0) / valid.length
  const vegCount = valid.filter((v) => v > VEGETACAO_NDVI_THRESHOLD).length

  return {
    year,
    meanNdvi: Number(mean.toFixed(4)),
    minNdvi: Number(Math.min(...valid).toFixed(4)),
    maxNdvi: Number(Math.max(...valid).toFixed(4)),
    pctVegetacao: Number(((vegCount / valid.length) * 100).toFixed(1)),
    sampledPoints: valid.length,
    attemptedPoints: points.length,
  }
}

export interface NdviTrendPoint extends NdviSampleResult {
  cached: boolean
}

export interface NdviTrendSummary {
  points: NdviTrendPoint[]
  deltaNdvi: number | null
  classificacao: 'recuperando' | 'estavel' | 'perdendo_vegetacao' | 'indeterminado'
}

export function classifyTrend(deltaNdvi: number | null): NdviTrendSummary['classificacao'] {
  if (deltaNdvi === null) return 'indeterminado'
  if (deltaNdvi > 0.05) return 'recuperando'
  if (deltaNdvi < -0.05) return 'perdendo_vegetacao'
  return 'estavel'
}
