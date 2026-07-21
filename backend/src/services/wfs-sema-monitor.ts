import { bbox as turfBbox, booleanPointInPolygon as turfBooleanPointInPolygon, multiPolygon as turfMultiPolygon, point as turfPoint, polygon as turfPolygon } from '@turf/turf'
import type { Feature, MultiPolygon, Point, Polygon } from 'geojson'
import { buildWfsUrl, computeIntersectionHectares, fetchIntersectingFeatures, type SupportedPolygonGeometry } from './wfs-intersection.js'

// Fiscalização, licenciamento, autorizações e sobreposições fundiárias — Fase 4 do plano.
// Camadas e campos confirmados ao vivo em 21/07/2026 (ver docs/CAMADAS-SEMA.md).

export interface SemaFinding {
  sourceId: string
  classType: string
  title: string
  description: string
  detectedDate: string | null
  areaHa: number
  geometry: Polygon | MultiPolygon | Point | null
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

/* ─── Datas ─── */

/** "DD/MM/YYYY" → "YYYY-MM-DD". Aceita também ISO (repassa) e valores vazios/"nan". */
export function parseSemaDate(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const raw = String(value).trim()
  if (!raw || raw.toLowerCase() === 'nan') return null

  const brMatch = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})/)
  if (brMatch) {
    const [, dd, mm, yyyy] = brMatch
    return `${yyyy}-${mm}-${dd}`
  }

  const isoMatch = raw.match(/^(\d{4}-\d{2}-\d{2})/)
  if (isoMatch) return isoMatch[1]

  return null
}

export function daysUntil(dateIso: string | null, fromIso?: string): number | null {
  if (!dateIso) return null
  const target = new Date(dateIso + 'T00:00:00Z').getTime()
  if (Number.isNaN(target)) return null
  const from = fromIso ? new Date(fromIso + 'T00:00:00Z').getTime() : Date.now()
  return Math.round((target - from) / (1000 * 60 * 60 * 24))
}

export type LicencaUrgencia = 'vencida' | 'critica_30d' | 'atencao_60d' | 'atencao_90d' | 'ok'

/** Classifica a urgência de uma licença conforme dias restantes até o vencimento. */
export function classificarUrgenciaLicenca(diasRestantes: number | null): LicencaUrgencia {
  if (diasRestantes === null) return 'ok'
  if (diasRestantes < 0) return 'vencida'
  if (diasRestantes <= 30) return 'critica_30d'
  if (diasRestantes <= 60) return 'atencao_60d'
  if (diasRestantes <= 90) return 'atencao_90d'
  return 'ok'
}

/* ─── Camadas poligonais (interseção com o motor genérico) ─── */

const EMBARGOS_LAYER = 'Geoportal:AREAS_EMBARGADAS_SEMA'
const DESEMBARGOS_LAYER = 'Geoportal:AREAS_DESEMBARGADAS_SEMA'
const AUTORIZACAO_DESMATE_LAYER = 'Geoportal:AUTORIZACAO_DESMATE_SEMA'
const AUTEX_PMFS_LAYER = 'Geoportal:AUTEX_PMFS_SEMA'

const SOBREPOSICAO_LAYERS: Array<{ layerName: string; tipo: string }> = [
  { layerName: 'Geoportal:TERRAS_INDIGENAS', tipo: 'TERRA_INDIGENA' },
  { layerName: 'Geoportal:UNIDADES_CONSERVACAO', tipo: 'UNIDADE_CONSERVACAO' },
  { layerName: 'Geoportal:ASSENTAMENTOS_INCRA', tipo: 'ASSENTAMENTO_INCRA' },
  { layerName: 'Geoportal:ASSENTAMENTOS_INTERMAT', tipo: 'ASSENTAMENTO_INTERMAT' },
  { layerName: 'Geoportal:CORREDORES_BIODIVERSIDADE', tipo: 'CORREDOR_BIODIVERSIDADE' },
]

function polygonAreaHaFromProps(properties: Record<string, any>): number {
  const area = properties?.AREA_HA
  return typeof area === 'number' && Number.isFinite(area) ? area : 0
}

export async function fetchEmbargos(polygon: SupportedPolygonGeometry): Promise<SemaFinding[]> {
  const features = await fetchIntersectingFeatures(EMBARGOS_LAYER, polygon)
  return features.map((f) => ({
    sourceId: String(f.properties?.T_EMBARGO || f.properties?.OBJECTID || ''),
    classType: 'EMBARGO',
    title: 'Área embargada',
    description: [f.properties?.PROPRIEDAD, f.properties?.DANO, f.properties?.N_PROCESSO]
      .filter(Boolean)
      .join(' — '),
    detectedDate: parseSemaDate(f.properties?.DAT_LAVRAT),
    areaHa: polygonAreaHaFromProps(f.properties),
    geometry: f.geometry,
  }))
}

export async function fetchDesembargos(polygon: SupportedPolygonGeometry): Promise<SemaFinding[]> {
  const features = await fetchIntersectingFeatures(DESEMBARGOS_LAYER, polygon)
  return features.map((f) => ({
    sourceId: String(f.properties?.T_EMBARGO || f.properties?.OBJECTID || ''),
    classType: 'DESEMBARGO',
    title: 'Área desembargada',
    description: [f.properties?.PROPRIEDAD, f.properties?.N_PROCESSO].filter(Boolean).join(' — '),
    detectedDate: parseSemaDate(f.properties?.DAT_LAVRAT),
    areaHa: polygonAreaHaFromProps(f.properties),
    geometry: f.geometry,
  }))
}

export async function fetchAutorizacoes(polygon: SupportedPolygonGeometry): Promise<SemaFinding[]> {
  const [desmate, pmfs] = await Promise.all([
    fetchIntersectingFeatures(AUTORIZACAO_DESMATE_LAYER, polygon),
    fetchIntersectingFeatures(AUTEX_PMFS_LAYER, polygon),
  ])
  const fromDesmate: SemaFinding[] = desmate.map((f) => ({
    sourceId: String(f.properties?.TITULO_AD || f.properties?.PROCESSO || f.properties?.OBJECTID || ''),
    classType: 'AUTORIZACAO_DESMATE',
    title: 'Autorização de desmate',
    description: [f.properties?.EMPREENDIMENTO, f.properties?.PROCESSO, f.properties?.SITUACAO]
      .filter(Boolean)
      .join(' — '),
    detectedDate: parseSemaDate(f.properties?.ATIVACAO),
    areaHa: polygonAreaHaFromProps(f.properties),
    geometry: f.geometry,
  }))
  const fromPmfs: SemaFinding[] = pmfs.map((f) => ({
    sourceId: String(f.properties?.TITULO || f.properties?.PROCESSO || f.properties?.OBJECTID || ''),
    classType: 'AUTEX_PMFS',
    title: 'Autorização de exploração florestal (PMFS)',
    description: [f.properties?.EMPREENDIMENTO, f.properties?.PROCESSO, f.properties?.SITUACAO]
      .filter(Boolean)
      .join(' — '),
    detectedDate: parseSemaDate(f.properties?.ATIVACAO),
    areaHa: polygonAreaHaFromProps(f.properties),
    geometry: f.geometry,
  }))
  return [...fromDesmate, ...fromPmfs]
}

export interface Sobreposicao {
  tipo: string
  nome: string
  intersectionHa: number
  coveragePercentOfPolygon: number
}

/** % do imóvel sobreposto a TI/UC/Assentamentos/Corredores. */
export async function fetchSobreposicoes(polygon: SupportedPolygonGeometry): Promise<Sobreposicao[]> {
  const layerNames = SOBREPOSICAO_LAYERS.map((l) => l.layerName)
  const results = await computeIntersectionHectares(polygon, layerNames)
  return results
    .filter((r) => r.status === 'ok' && r.intersectionHa > 0)
    .map((r) => {
      const def = SOBREPOSICAO_LAYERS.find((l) => l.layerName === r.layerName)!
      return {
        tipo: def.tipo,
        nome: def.layerName.split(':')[1],
        intersectionHa: r.intersectionHa,
        coveragePercentOfPolygon: r.coveragePercentOfPolygon,
      }
    })
}

/** Um alerta SCCON está dentro de uma autorização vigente? (cruzamento p/ triagem — Fase 5/7). */
export function alertaTemAutorizacao(
  alertGeometry: Polygon | MultiPolygon,
  autorizacoes: SemaFinding[],
): boolean {
  if (!autorizacoes.length) return false
  try {
    const alertFeature: Feature<Polygon | MultiPolygon> =
      alertGeometry.type === 'Polygon' ? turfPolygon(alertGeometry.coordinates) : turfMultiPolygon(alertGeometry.coordinates)
    const alertCentroidCoords = turfBbox(alertFeature)
    const centroid = turfPoint([(alertCentroidCoords[0] + alertCentroidCoords[2]) / 2, (alertCentroidCoords[1] + alertCentroidCoords[3]) / 2])
    return autorizacoes.some((a) => {
      if (!a.geometry || (a.geometry.type !== 'Polygon' && a.geometry.type !== 'MultiPolygon')) return false
      const authFeature: Feature<Polygon | MultiPolygon> =
        a.geometry.type === 'Polygon' ? turfPolygon(a.geometry.coordinates) : turfMultiPolygon(a.geometry.coordinates)
      return turfBooleanPointInPolygon(centroid, authFeature)
    })
  } catch {
    return false
  }
}

/* ─── Camadas pontuais (fiscalização/licenciamento) — BBOX + filtro exato ─── */

const INFRACOES_LAYER = 'Geoportal:TDAD_FISCALIZACAO_AUTO_DE_INFRACAO'
const NOTIFICACOES_LAYER = 'Geoportal:TDAD_FISCALIZACAO_NOTIFICACAO'
const LICENCA_LAYERS: Array<{ layerName: string; tipo: string }> = [
  { layerName: 'Geoportal:SIMLAMGEO_LP_ATIVA', tipo: 'LP' },
  { layerName: 'Geoportal:SIMLAMGEO_LI_ATIVA', tipo: 'LI' },
  { layerName: 'Geoportal:SIMLAMGEO_LO_ATIVA', tipo: 'LO' },
  { layerName: 'Geoportal:SIMLAMGEO_LOP_ATIVA', tipo: 'LOP' },
]

async function fetchPointFeaturesInPolygon(
  layerName: string,
  polygon: SupportedPolygonGeometry,
): Promise<Array<{ properties: Record<string, any>; geometry: Point }>> {
  const polygonFeature: Feature<Polygon | MultiPolygon> =
    polygon.type === 'Polygon' ? turfPolygon(polygon.coordinates) : turfMultiPolygon(polygon.coordinates)
  const [minX, minY, maxX, maxY] = turfBbox(polygonFeature)

  const url = buildWfsUrl({
    service: 'WFS',
    version: '2.0.0',
    request: 'GetFeature',
    typeNames: layerName,
    outputFormat: 'application/json',
    srsName: 'EPSG:4326',
    bbox: `${minY},${minX},${maxY},${maxX},EPSG:4326`,
  })
  const data = await fetchJson(url)
  const features = Array.isArray(data.features) ? data.features : []

  const matched: Array<{ properties: Record<string, any>; geometry: Point }> = []
  for (const f of features) {
    if (!f.geometry || f.geometry.type !== 'Point') continue
    try {
      if (turfBooleanPointInPolygon(turfPoint(f.geometry.coordinates), polygonFeature)) {
        matched.push({ properties: f.properties || {}, geometry: f.geometry })
      }
    } catch {
      continue
    }
  }
  return matched
}

export async function fetchInfracoes(polygon: SupportedPolygonGeometry): Promise<SemaFinding[]> {
  const features = await fetchPointFeaturesInPolygon(INFRACOES_LAYER, polygon)
  return features.map((f) => ({
    sourceId: String(f.properties?.ID ?? f.properties?.NUMERO_DOCUMENTO ?? ''),
    classType: 'AUTO_INFRACAO',
    title: `Auto de infração ${f.properties?.NUMERO_DOCUMENTO || ''}`.trim(),
    description: [f.properties?.ATIVIDADE, f.properties?.NIVEL_IMPACTO].filter(Boolean).join(' — '),
    detectedDate: parseSemaDate(f.properties?.DATA_DOCUMENTO || f.properties?.DATA_LANCAMENTO),
    areaHa: 0,
    geometry: f.geometry,
  }))
}

export async function fetchNotificacoes(polygon: SupportedPolygonGeometry): Promise<SemaFinding[]> {
  const features = await fetchPointFeaturesInPolygon(NOTIFICACOES_LAYER, polygon)
  return features.map((f) => ({
    sourceId: String(f.properties?.ID ?? f.properties?.NUMERO_DOCUMENTO ?? ''),
    classType: 'NOTIFICACAO',
    title: `Notificação ${f.properties?.NUMERO_DOCUMENTO || ''}`.trim(),
    description: [f.properties?.ATIVIDADE, f.properties?.STATUS].filter(Boolean).join(' — '),
    detectedDate: parseSemaDate(f.properties?.DATA_DOCUMENTO || f.properties?.DATA_LANCAMENTO),
    areaHa: 0,
    geometry: f.geometry,
  }))
}

export interface LicencaFinding extends SemaFinding {
  tipo: string
  dataVencimento: string | null
  diasRestantes: number | null
  urgencia: LicencaUrgencia
}

/** Licenças ativas no imóvel (LP/LI/LO/LOP), com classificação de urgência de vencimento. */
export async function fetchLicenciamento(polygon: SupportedPolygonGeometry): Promise<LicencaFinding[]> {
  const out: LicencaFinding[] = []
  for (const def of LICENCA_LAYERS) {
    try {
      const features = await fetchPointFeaturesInPolygon(def.layerName, polygon)
      for (const f of features) {
        const dataVencimento = parseSemaDate(f.properties?.DATA_VENCIMENTO)
        const diasRestantes = daysUntil(dataVencimento)
        out.push({
          sourceId: String(f.properties?.ID_TITULO ?? f.properties?.PROTOCOLO_NUMERO ?? ''),
          classType: `LICENCA_${def.tipo}`,
          tipo: def.tipo,
          title: `Licença ${def.tipo} — ${f.properties?.TITULO_NUMERO || ''}`.trim(),
          description: [f.properties?.RAZAO_SOCIAL, f.properties?.ATIVIDADE_LICENCIADA].filter(Boolean).join(' — '),
          detectedDate: parseSemaDate(f.properties?.DATA_APROVACAO),
          dataVencimento,
          diasRestantes,
          urgencia: classificarUrgenciaLicenca(diasRestantes),
          areaHa: 0,
          geometry: f.geometry,
        })
      }
    } catch (err: any) {
      console.error(`[wfs-sema-monitor] Erro ao buscar licenças ${def.tipo}:`, err?.message)
    }
  }
  return out
}
