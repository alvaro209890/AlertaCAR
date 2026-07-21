import config from '../lib/config.js'
import db from '../db/connection.js'

interface CarPolygon {
  carNumberWfs: string
  geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon
  areaHa: number
  municipality: string
  state: string
}

// Converte nº simplificado "271442" → formato WFS "MT271442/2017"
// Tenta adivinhar o ano: procura no WFS, fallback para ano atual
function toWfsFormat(carNumber: string): string[] {
  const cleaned = carNumber.replace(/\D/g, '')
  // Se já está no formato MTXXXXX/YYYY
  const match = carNumber.match(/^MT(\d+)\/(\d{4})$/i)
  if (match) return [`MT${match[1]}/${match[2]}`]
  
  // Tenta anos comuns (2016-2025) — o WFS pode ter múltiplos registros
  const currentYear = new Date().getFullYear()
  const candidates: string[] = []
  for (let year = 2015; year <= currentYear; year++) {
    candidates.push(`MT${cleaned}/${year}`)
  }
  return candidates
}

async function fetchWithRetry(url: string, retries = 3, delay = 2000): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    try {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)

      const response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'AlertaCAR/1.0',
          'Accept': 'application/json',
        },
      })
      
      clearTimeout(timeout)
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }
      
      return response
    } catch (err) {
      if (i === retries - 1) throw err
      console.log(`[wfs-sema] Retry ${i + 1}/${retries} after ${delay}ms: ${(err as Error).message}`)
      await new Promise(r => setTimeout(r, delay))
      delay *= 2
    }
  }
  throw new Error('Unreachable')
}

function reprojectPoint([x, y]: number[]): [number, number] {
  // SIRGAS 2000 (EPSG:4674) é praticamente igual a WGS84 (EPSG:4326)
  // para coordenadas brasileiras. Diferença < 1cm.
  return [x, y]
}

function reprojectPolygon(coords: number[][][]): number[][][] {
  return coords.map(ring => ring.map(reprojectPoint))
}

function calculateAreaHa(geometry: GeoJSON.Polygon | GeoJSON.MultiPolygon): number {
  // Usa o algoritmo de Shoelace para área aproximada em hectares
  // 1 grau ≈ 111,320m no equador
  const DEG_TO_M = 111320
  
  const polygons: GeoJSON.Position[][][] = geometry.type === 'Polygon'
    ? [geometry.coordinates]
    : geometry.coordinates

  let totalAreaM2 = 0

  for (const poly of polygons) {
    const ring = poly[0] // outer ring
    let area = 0
    for (let i = 0; i < ring.length - 1; i++) {
      const [x1, y1] = ring[i]
      const [x2, y2] = ring[i + 1]
      area += (x1 * y2 - x2 * y1)
    }
    // Correção pela latitude média
    const avgLat = ring.reduce((s, p) => s + p[1], 0) / ring.length
    const latRad = (avgLat * Math.PI) / 180
    const correctionX = DEG_TO_M * Math.cos(latRad)
    const correctionY = DEG_TO_M
    totalAreaM2 += Math.abs(area) * 0.5 * correctionX * correctionY
  }
  
  return Math.round(totalAreaM2 / 10000 * 100) / 100 // hectares com 2 casas
}

function extractMunicipality(feature: any): string {
  // Tenta vários campos possíveis do GeoJSON da SEMA
  const props = feature.properties || {}
  // MUNICIPIO_CODIGO é código IBGE — guardamos como string para lookup futuro
  return props.NOMEPROPRIEDADE || props.nomepropriedade || 
         props.MUNICIPIO_CODIGO || ''
}

function extractAreaHa(feature: any): number {
  const props = feature.properties || {}
  const area = props.AREA_HA || props.area_ha
  if (area && typeof area === 'number') return Math.round(area * 100) / 100
  return 0
}

// Busca do cache SQLite
function getCached(carNumberWfs: string): CarPolygon | null {
  const row = db.prepare(`
    SELECT polygon_json, area_ha, municipality, last_polygon_fetch
    FROM cars 
    WHERE car_number_wfs = ? 
      AND polygon_json IS NOT NULL 
      AND last_polygon_fetch > datetime('now', '-30 days')
    ORDER BY last_polygon_fetch DESC
    LIMIT 1
  `).get(carNumberWfs) as any
  
  if (!row) return null
  
  try {
    const geometry = JSON.parse(row.polygon_json)
    return {
      carNumberWfs,
      geometry,
      areaHa: row.area_ha,
      municipality: row.municipality,
      state: 'MT',
    }
  } catch {
    return null
  }
}

function saveCache(carNumberWfs: string, polygon: CarPolygon): void {
  db.prepare(`
    UPDATE cars 
    SET polygon_json = ?, area_ha = ?, municipality = ?, last_polygon_fetch = datetime('now')
    WHERE car_number_wfs = ?
  `).run(
    JSON.stringify(polygon.geometry),
    polygon.areaHa,
    polygon.municipality,
    carNumberWfs,
  )
}

function validateGeometry(geom: any): geom is GeoJSON.Polygon | GeoJSON.MultiPolygon {
  if (!geom || typeof geom !== 'object') return false
  if (geom.type !== 'Polygon' && geom.type !== 'MultiPolygon') return false
  if (!Array.isArray(geom.coordinates)) return false
  return true
}

export async function fetchCarPolygon(carNumber: string): Promise<CarPolygon | null> {
  const candidates = toWfsFormat(carNumber)
  
  // Tenta cache primeiro para cada candidato
  for (const wfsNum of candidates) {
    const cached = getCached(wfsNum)
    if (cached) {
      console.log(`[wfs-sema] Cache hit: ${wfsNum}`)
      return cached
    }
  }
  
  const baseUrl = config.wfs.baseUrl
  const authkey = config.wfs.authkey
  
  for (const wfsNum of candidates) {
    try {
      console.log(`[wfs-sema] Buscando: ${wfsNum}`)
      
      const params = new URLSearchParams({
        service: 'WFS',
        version: '2.0.0',
        request: 'GetFeature',
        typeNames: 'Geoportal:CAR_ATP',
        outputFormat: 'application/json',
        CQL_FILTER: `NUMEROESTADUAL='${wfsNum}'`,
        authkey,
      })
      
      const url = `${baseUrl}?${params.toString()}`
      const response = await fetchWithRetry(url)
      const data = await response.json()
      
      if (!data.features || data.features.length === 0) {
        console.log(`[wfs-sema] Nenhum resultado para ${wfsNum}`)
        continue
      }
      
      const feature = data.features[0]
      if (!validateGeometry(feature.geometry)) {
        console.log(`[wfs-sema] Geometria inválida para ${wfsNum}`)
        continue
      }
      
      // Reprojetar coordenadas
      const geometry = feature.geometry.type === 'Polygon'
        ? {
            type: 'Polygon' as const,
            coordinates: reprojectPolygon(feature.geometry.coordinates),
          }
        : {
            type: 'MultiPolygon' as const,
            coordinates: feature.geometry.coordinates.map((poly: number[][][]) => reprojectPolygon(poly)),
          }
      
      const areaHa = extractAreaHa(feature)
      const municipality = extractMunicipality(feature)
      
      const result: CarPolygon = {
        carNumberWfs: wfsNum,
        geometry,
        areaHa,
        municipality,
        state: 'MT',
      }
      
      console.log(`[wfs-sema] Encontrado: ${wfsNum} — ${areaHa}ha — ${municipality}`)
      return result
      
    } catch (err) {
      console.error(`[wfs-sema] Erro ao buscar ${wfsNum}:`, (err as Error).message)
      continue
    }
  }
  
  console.log(`[wfs-sema] Nenhum polígono encontrado para ${carNumber} (tentou ${candidates.length} anos)`)
  return null
}
