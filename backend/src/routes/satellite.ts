import { Router } from 'express'
import { v4 as uuid } from 'uuid'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'
import type { SupportedPolygonGeometry } from '../services/wfs-intersection.js'
import {
  bboxForGeometry,
  buildFrameUrl,
  classifyTrend,
  getSatelliteCatalog,
  NDVI_AVAILABLE_YEARS,
  sampleNdviForYear,
  SATELLITE_CATALOG,
  type NdviTrendPoint,
} from '../services/satellite.js'

const router = Router()

router.use(requireAuth)

function loadOwnedCar(carId: string, userId: string) {
  return db.prepare('SELECT id, polygon_json FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId) as
    | { id: string; polygon_json: string | null }
    | undefined
}

function parseGeometry(polygonJson: string | null): SupportedPolygonGeometry | null {
  if (!polygonJson) return null
  try {
    const geometry = JSON.parse(polygonJson)
    if (geometry?.type === 'Polygon' || geometry?.type === 'MultiPolygon') return geometry
    return null
  } catch {
    return null
  }
}

// GET /api/cars/:id/satellite/capabilities — catálogo + bbox do imóvel para o front montar o mapa
router.get('/cars/:carId/satellite/capabilities', (req: AuthRequest, res) => {
  try {
    const car = loadOwnedCar(req.params.carId, req.user!.id)
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }
    const geometry = parseGeometry(car.polygon_json)
    if (!geometry) {
      res.status(422).json({ error: 'CAR sem polígono conhecido — não é possível montar o mapa de satélite' })
      return
    }
    res.json({
      bbox: bboxForGeometry(geometry),
      satellites: getSatelliteCatalog(),
      ndviSatelliteId: 'sentinel2',
      ndviAvailableYears: NDVI_AVAILABLE_YEARS,
    })
  } catch (err: any) {
    console.error('[satellite] capabilities error:', err)
    res.status(500).json({ error: 'Erro ao montar capacidades de satélite' })
  }
})

// GET /api/cars/:id/satellite/frame?sat=&year= — URL do WMS GetMap recortado no bbox do CAR
router.get('/cars/:carId/satellite/frame', (req: AuthRequest, res) => {
  try {
    const car = loadOwnedCar(req.params.carId, req.user!.id)
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }
    const geometry = parseGeometry(car.polygon_json)
    if (!geometry) {
      res.status(422).json({ error: 'CAR sem polígono conhecido' })
      return
    }
    const satId = String(req.query.sat || '')
    const year = Number(req.query.year)
    const satellite = SATELLITE_CATALOG.find((s) => s.id === satId)
    if (!satellite) {
      res.status(400).json({ error: 'Satélite inválido' })
      return
    }
    if (satellite.years.length && !satellite.years.includes(year)) {
      res.status(400).json({ error: `Ano inválido para ${satellite.label}` })
      return
    }
    const layerName = satellite.layerForYear(year)
    const bbox = bboxForGeometry(geometry)
    res.json({ layerName, bbox, frameUrl: buildFrameUrl(layerName, bbox) })
  } catch (err: any) {
    console.error('[satellite] frame error:', err)
    res.status(500).json({ error: 'Erro ao montar frame de satélite' })
  }
})

// GET /api/cars/:id/satellite/ndvi?year=&force= — estatística NDVI de um ano (com cache)
router.get('/cars/:carId/satellite/ndvi', async (req: AuthRequest, res) => {
  try {
    const car = loadOwnedCar(req.params.carId, req.user!.id)
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }
    const geometry = parseGeometry(car.polygon_json)
    if (!geometry) {
      res.status(422).json({ error: 'CAR sem polígono conhecido' })
      return
    }
    const year = Number(req.query.year)
    if (!NDVI_AVAILABLE_YEARS.includes(year)) {
      res.status(400).json({ error: `Ano sem cobertura Sentinel-2 (disponível: ${NDVI_AVAILABLE_YEARS.join(', ')})` })
      return
    }
    const force = req.query.force === 'true'
    const result = await computeNdviCached(car.id, geometry, year, force)
    res.json(result)
  } catch (err: any) {
    console.error('[satellite] ndvi error:', err)
    res.status(500).json({ error: 'Erro ao calcular NDVI' })
  }
})

// GET /api/cars/:id/satellite/ndvi-trend?years=2016,2019,2021,2023,2025 — tendência multi-ano
router.get('/cars/:carId/satellite/ndvi-trend', async (req: AuthRequest, res) => {
  try {
    const car = loadOwnedCar(req.params.carId, req.user!.id)
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }
    const geometry = parseGeometry(car.polygon_json)
    if (!geometry) {
      res.status(422).json({ error: 'CAR sem polígono conhecido' })
      return
    }

    const yearsParam = String(req.query.years || '')
    let years = yearsParam
      .split(',')
      .map((y) => Number(y.trim()))
      .filter((y) => NDVI_AVAILABLE_YEARS.includes(y))
    if (!years.length) {
      // Default: 5 anos espalhados de 2016 a 2025 (evita amostrar os 10 anos toda vez — servidor da SEMA é lento/instável sob carga)
      years = [2016, 2019, 2021, 2023, 2025].filter((y) => NDVI_AVAILABLE_YEARS.includes(y))
    }
    years = Array.from(new Set(years)).sort((a, b) => a - b)

    const points: NdviTrendPoint[] = []
    for (const year of years) {
      points.push(await computeNdviCached(car.id, geometry, year, false))
    }

    const withValue = points.filter((p) => p.meanNdvi !== null)
    const deltaNdvi =
      withValue.length >= 2 ? Number((withValue[withValue.length - 1].meanNdvi! - withValue[0].meanNdvi!).toFixed(4)) : null

    res.json({
      points,
      deltaNdvi,
      classificacao: classifyTrend(deltaNdvi),
    })
  } catch (err: any) {
    console.error('[satellite] ndvi-trend error:', err)
    res.status(500).json({ error: 'Erro ao calcular tendência de NDVI' })
  }
})

async function computeNdviCached(
  carId: string,
  geometry: SupportedPolygonGeometry,
  year: number,
  force: boolean,
): Promise<NdviTrendPoint> {
  if (!force) {
    const cached = db.prepare('SELECT * FROM car_ndvi WHERE car_id = ? AND year = ?').get(carId, year) as any
    if (cached) {
      return {
        year,
        meanNdvi: cached.mean_ndvi,
        minNdvi: cached.min_ndvi,
        maxNdvi: cached.max_ndvi,
        pctVegetacao: cached.pct_vegetacao,
        sampledPoints: cached.sampled_points,
        attemptedPoints: cached.attempted_points,
        cached: true,
      }
    }
  }

  const result = await sampleNdviForYear(geometry, year)

  db.prepare(
    `INSERT INTO car_ndvi (id, car_id, year, mean_ndvi, min_ndvi, max_ndvi, pct_vegetacao, sampled_points, attempted_points, computed_at)
     VALUES (@id, @carId, @year, @meanNdvi, @minNdvi, @maxNdvi, @pctVegetacao, @sampledPoints, @attemptedPoints, datetime('now'))
     ON CONFLICT(car_id, year) DO UPDATE SET
       mean_ndvi = excluded.mean_ndvi,
       min_ndvi = excluded.min_ndvi,
       max_ndvi = excluded.max_ndvi,
       pct_vegetacao = excluded.pct_vegetacao,
       sampled_points = excluded.sampled_points,
       attempted_points = excluded.attempted_points,
       computed_at = datetime('now')`,
  ).run({
    id: uuid(),
    carId,
    year: result.year,
    meanNdvi: result.meanNdvi,
    minNdvi: result.minNdvi,
    maxNdvi: result.maxNdvi,
    pctVegetacao: result.pctVegetacao,
    sampledPoints: result.sampledPoints,
    attemptedPoints: result.attemptedPoints,
  })

  return { ...result, cached: false }
}

export default router
