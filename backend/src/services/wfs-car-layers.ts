import {
  area as turfArea,
  intersect as turfIntersect,
  featureCollection as turfFeatureCollection,
  multiPolygon as turfMultiPolygon,
  polygon as turfPolygon,
} from '@turf/turf'
import type { Feature, FeatureCollection, MultiPolygon, Polygon } from 'geojson'
import { buildWfsUrl, type SupportedPolygonGeometry } from './wfs-intersection.js'

// Camadas do próprio CAR no WFS SEMA-MT (filtradas por NUMERO_CAR, não espacialmente).
// Campos confirmados ao vivo em 21/07/2026 (ver docs/CAMADAS-SEMA.md).

export interface CarLayerDef {
  key: string
  layerName: string
  label: string
}

export const CAR_LAYER_DEFS: CarLayerDef[] = [
  { key: 'ARL', layerName: 'Geoportal:CAR_ARL', label: 'Reserva Legal' },
  { key: 'APP', layerName: 'Geoportal:CAR_APP', label: 'Área de Preservação Permanente' },
  { key: 'APPD', layerName: 'Geoportal:CAR_APPD', label: 'APP Degradada' },
  { key: 'APPRL', layerName: 'Geoportal:CAR_APPRL', label: 'APP de Reserva Legal' },
  { key: 'AVN', layerName: 'Geoportal:CAR_AVN', label: 'Vegetação Nativa' },
  { key: 'AUAS', layerName: 'Geoportal:CAR_AUAS', label: 'Uso Antrópico' },
  { key: 'AU', layerName: 'Geoportal:CAR_AU', label: 'Área Úmida' },
  { key: 'NASCENTE', layerName: 'Geoportal:CAR_NASCENTE', label: 'Nascentes' },
  { key: 'AREA_CONSOLIDADA', layerName: 'Geoportal:SIMCAR_CAR_AREA_CONSOLIDADA', label: 'Área Consolidada' },
]

export interface CarLayerSummary {
  key: string
  label: string
  areaHa: number
  featureCount: number
  /** ano mais recente de abertura declarado (só relevante p/ AUAS) */
  maisRecenteAberturaAno?: number | null
}

const WFS_TIMEOUT_MS = Number(process.env.WFS_TIMEOUT_MS ?? '30000')

async function fetchJson(url: string, retries = 2): Promise<any> {
  let lastError: any = null
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), WFS_TIMEOUT_MS)
    try {
      const res = await fetch(url, { signal: controller.signal })
      if (!res.ok) {
        const text = await res.text().catch(() => '')
        throw new Error(`WFS ${res.status}: ${text.slice(0, 200)}`)
      }
      return await res.json()
    } catch (err) {
      lastError = err
      if (attempt < retries) await new Promise((r) => setTimeout(r, 1000 * attempt))
    } finally {
      clearTimeout(timer)
    }
  }
  throw lastError
}

function extractAreaHa(properties: Record<string, any>): number {
  const area = properties?.AREA_HA
  if (typeof area === 'number' && Number.isFinite(area)) return area
  return 0
}

/** Busca as feições de uma camada do CAR filtrando por NUMERO_CAR (com fallback sem SITUACAO). */
export async function fetchCarLayerFeatures(layerName: string, carNumberWfs: string): Promise<any[]> {
  const escaped = carNumberWfs.replace(/'/g, "''")
  // ⚠️ O WFS da SEMA derruba a conexão com "AND" sem parênteses ao redor de
  // cada condição (confirmado ao vivo em 21/07/2026) — sempre usar (a)AND(b).
  const withSituacao = buildWfsUrl({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: layerName,
    outputFormat: 'application/json',
    CQL_FILTER: `(NUMERO_CAR='${escaped}')AND(SITUACAO='ATIVO')`,
  })
  try {
    const data = await fetchJson(withSituacao)
    return Array.isArray(data.features) ? data.features : []
  } catch (err: any) {
    // Fallback: a camada pode não ter o campo SITUACAO
    const message = String(err?.message || '')
    if (!/400|attribute|column/i.test(message)) throw err
    const withoutSituacao = buildWfsUrl({
      service: 'WFS',
      version: '2.0.0',
      request: 'GetFeature',
      typeNames: layerName,
      outputFormat: 'application/json',
      CQL_FILTER: `NUMERO_CAR='${escaped}'`,
    })
    const data = await fetchJson(withoutSituacao)
    return Array.isArray(data.features) ? data.features : []
  }
}

export function summarizeCarLayerFeatures(def: CarLayerDef, features: any[]): CarLayerSummary {
  let areaHa = 0
  let maisRecenteAberturaAno: number | null = null
  for (const feature of features) {
    areaHa += extractAreaHa(feature.properties || {})
    const abertura = feature.properties?.ABERTURA
    if (abertura) {
      const year = Number(String(abertura).slice(0, 4))
      if (Number.isFinite(year) && (maisRecenteAberturaAno === null || year > maisRecenteAberturaAno)) {
        maisRecenteAberturaAno = year
      }
    }
  }
  return {
    key: def.key,
    label: def.label,
    areaHa: Number(areaHa.toFixed(4)),
    featureCount: features.length,
    ...(def.key === 'AUAS' ? { maisRecenteAberturaAno } : {}),
  }
}

/** Busca todas as camadas do CAR (ARL/APP/AVN/AUAS/...) e resume área total por camada. */
export async function fetchAllCarLayers(carNumberWfs: string): Promise<CarLayerSummary[]> {
  const results: CarLayerSummary[] = []
  for (const def of CAR_LAYER_DEFS) {
    try {
      const features = await fetchCarLayerFeatures(def.layerName, carNumberWfs)
      results.push(summarizeCarLayerFeatures(def, features))
    } catch (err: any) {
      console.error(`[wfs-car-layers] Erro ao buscar ${def.layerName} para ${carNumberWfs}:`, err?.message)
      results.push({ key: def.key, label: def.label, areaHa: 0, featureCount: 0 })
    }
  }
  return results
}

/* ─── Bioma (para % de Reserva Legal exigida) ─── */

const BIOMAS_LAYER = 'Geoportal:BIOMAS_MT'

/**
 * Determina o bioma predominante do imóvel por interseção com Geoportal:BIOMAS_MT
 * (3 feições estaduais: Amazônia, Cerrado, Pantanal — confirmado ao vivo em 21/07/2026).
 */
export async function detectBioma(polygonGeometry: SupportedPolygonGeometry): Promise<string | null> {
  const url = buildWfsUrl({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: BIOMAS_LAYER,
    outputFormat: 'application/json',
  })
  const data = await fetchJson(url)
  const features = Array.isArray(data.features) ? data.features : []
  if (!features.length) return null

  const propertyGeom: Feature<Polygon | MultiPolygon> =
    polygonGeometry.type === 'Polygon'
      ? turfPolygon(polygonGeometry.coordinates)
      : turfMultiPolygon(polygonGeometry.coordinates)

  let bestBioma: string | null = null
  let bestAreaHa = 0
  for (const feature of features) {
    if (!feature.geometry) continue
    try {
      const fc = turfFeatureCollection([propertyGeom, feature]) as FeatureCollection<Polygon | MultiPolygon>
      const intersection = turfIntersect(fc)
      if (!intersection) continue
      const areaHa = turfArea(intersection) / 10000
      if (areaHa > bestAreaHa) {
        bestAreaHa = areaHa
        bestBioma = feature.properties?.BIOMA || null
      }
    } catch {
      continue
    }
  }
  return bestBioma
}

/**
 * % mínimo de Reserva Legal por bioma (Art. 12, Lei 12.651/2012 — Código Florestal),
 * considerando que Mato Grosso está integralmente na Amazônia Legal.
 *
 * ⚠️ Simplificação: casos de transição/campos gerais e exceções (pequena propriedade,
 * posse de boa-fé, etc.) NÃO são considerados. Sempre confirmar com o RT.
 */
export const ARL_PERCENT_BY_BIOMA: Record<string, number> = {
  'Amazônia': 80,
  'Cerrado': 35,
  'Pantanal': 20,
}

export function arlPercentForBioma(bioma: string | null): number | null {
  if (!bioma) return null
  return ARL_PERCENT_BY_BIOMA[bioma] ?? null
}

export interface ConformidadeResult {
  bioma: string | null
  arlExigidaPercent: number | null
  arlExigidaHa: number | null
  arlDeclaradaHa: number
  deficitArlHa: number | null
  areaTotalHa: number
}

/** Calcula déficit de Reserva Legal: (área total × % exigido pelo bioma) − ARL declarada. */
export function calcularConformidade(args: {
  areaTotalHa: number
  arlDeclaradaHa: number
  bioma: string | null
}): ConformidadeResult {
  const { areaTotalHa, arlDeclaradaHa, bioma } = args
  const arlExigidaPercent = arlPercentForBioma(bioma)
  if (arlExigidaPercent === null) {
    return { bioma, arlExigidaPercent: null, arlExigidaHa: null, arlDeclaradaHa, deficitArlHa: null, areaTotalHa }
  }
  const arlExigidaHa = Number(((areaTotalHa * arlExigidaPercent) / 100).toFixed(4))
  const deficitArlHa = Number(Math.max(0, arlExigidaHa - arlDeclaradaHa).toFixed(4))
  return { bioma, arlExigidaPercent, arlExigidaHa, arlDeclaradaHa, deficitArlHa, areaTotalHa }
}
