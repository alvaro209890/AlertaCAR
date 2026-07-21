import { Router } from 'express'
import { requireAuth, type AuthRequest } from '../middleware/auth.js'
import db from '../db/connection.js'
import { buildExport, type ExportFeature, type ExportFormat, type ExportLayer } from '../services/gis-export.js'
import { CAR_LAYER_DEFS, fetchCarLayerFeatures } from '../services/wfs-car-layers.js'

const router = Router()

router.use(requireAuth)

const VALID_FORMATS: ExportFormat[] = ['geojson', 'kml', 'kmz', 'shp', 'csv', 'gpkg']

function parseFormat(value: unknown): ExportFormat | null {
  const f = String(value ?? 'geojson').toLowerCase()
  return (VALID_FORMATS as string[]).includes(f) ? (f as ExportFormat) : null
}

function flattenProps(props: Record<string, any> | null | undefined): Record<string, string | number | null> {
  const out: Record<string, string | number | null> = {}
  for (const [k, v] of Object.entries(props || {})) {
    if (v === null || v === undefined) out[k] = null
    else if (typeof v === 'number' || typeof v === 'string') out[k] = v
    else out[k] = String(v)
  }
  return out
}

function sendExport(res: import('express').Response, result: { buffer: Buffer; filename: string; contentType: string }) {
  res.setHeader('Content-Type', result.contentType)
  res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
  res.send(result.buffer)
}

// GET /api/cars/:id/export?format=geojson|kml|kmz|shp|csv|gpkg&target=polygon|layers|all
router.get('/cars/:id/export', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.id
    const format = parseFormat(req.query.format)
    if (!format) {
      res.status(400).json({ error: `Formato inválido. Use: ${VALID_FORMATS.join(', ')}` })
      return
    }

    const car = db.prepare('SELECT * FROM cars WHERE id = ? AND user_id = ? AND active = 1').get(carId, userId) as any
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    const target = String(req.query.target || 'polygon')
    const layers: ExportLayer[] = []

    if (target === 'polygon' || target === 'all') {
      if (car.polygon_json) {
        layers.push({
          key: 'car_atp',
          label: 'Polígono do CAR',
          features: [
            {
              geometry: JSON.parse(car.polygon_json),
              properties: {
                carNumber: car.car_number,
                nickname: car.nickname || null,
                municipality: car.municipality || null,
                areaHa: car.area_ha,
                bioma: car.bioma || null,
              },
            },
          ],
        })
      }
    }

    if (target === 'layers' || target === 'all') {
      if (!car.car_number_wfs) {
        res.status(400).json({ error: 'CAR sem número WFS resolvido — não é possível buscar camadas' })
        return
      }
      for (const def of CAR_LAYER_DEFS) {
        try {
          const features = await fetchCarLayerFeatures(def.layerName, car.car_number_wfs)
          const withGeometry = features.filter((f: any) => f.geometry)
          if (withGeometry.length) {
            layers.push({
              key: def.key,
              label: def.label,
              features: withGeometry.map((f: any) => ({ geometry: f.geometry, properties: flattenProps(f.properties) })),
            })
          }
        } catch (err: any) {
          console.error(`[export] Erro ao buscar camada ${def.layerName}:`, err?.message)
        }
      }
    }

    if (!layers.length) {
      res.status(404).json({ error: 'Nada para exportar (sem polígono ou camadas encontradas)' })
      return
    }

    const baseName = String(car.nickname || car.car_number).replace(/\s+/g, '_')
    const result = await buildExport(format, layers, baseName)
    sendExport(res, result)
  } catch (err: any) {
    console.error('[export] cars/:id/export error:', err)
    res.status(500).json({ error: 'Erro ao gerar exportação' })
  }
})

// GET /api/cars/:carId/alerts/export?format=
router.get('/cars/:carId/alerts/export', async (req: AuthRequest, res) => {
  try {
    const userId = req.user!.id
    const carId = req.params.carId
    const format = parseFormat(req.query.format)
    if (!format) {
      res.status(400).json({ error: `Formato inválido. Use: ${VALID_FORMATS.join(', ')}` })
      return
    }

    const car = db
      .prepare('SELECT id, car_number, nickname FROM cars WHERE id = ? AND user_id = ? AND active = 1')
      .get(carId, userId) as any
    if (!car) {
      res.status(404).json({ error: 'CAR não encontrado' })
      return
    }

    const rows = db.prepare('SELECT * FROM alerts WHERE car_id = ? ORDER BY detected_date DESC').all(carId) as any[]

    const features: ExportFeature[] = rows
      .filter((r) => r.geometry_json)
      .map((r) => ({
        geometry: JSON.parse(r.geometry_json),
        properties: {
          source: r.source,
          classType: r.class_type,
          title: r.title,
          detectedDate: r.detected_date,
          areaHa: r.area_ha,
          status: r.status || 'novo',
        },
      }))

    if (!features.length) {
      res.status(404).json({ error: 'Nenhum alerta com geometria para exportar' })
      return
    }

    const baseName = `alertas_${car.nickname || car.car_number}`.replace(/\s+/g, '_')
    const result = await buildExport(format, [{ key: 'alertas', label: 'Alertas', features }], baseName)
    sendExport(res, result)
  } catch (err: any) {
    console.error('[export] alerts/export error:', err)
    res.status(500).json({ error: 'Erro ao gerar exportação de alertas' })
  }
})

export default router
