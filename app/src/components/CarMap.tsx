import { useMemo, useState } from 'react'
import { MapContainer, TileLayer, WMSTileLayer, GeoJSON, CircleMarker, Popup, useMap } from 'react-leaflet'
import type { Feature } from 'geojson'
import 'leaflet/dist/leaflet.css'
import { SEMA_BASE_LAYERS, SEMA_OVERLAY_LAYERS, SEMA_WMS_URL, wmsParams } from '../lib/sema-layers'
import type { Alert, Car } from '../lib/types'

const CLASS_COLORS: Record<string, string> = {
  CUT: '#ef4444', MINERAL_EXTRACTION: '#ef4444', DEGRADATION_CHEMICAL_AGENT: '#ef4444', EMBARGO: '#ef4444',
  SELECTIVE_EXTRACTION: '#f97316', DEGRADATION_SELECTIVE_CUT: '#f97316', AUTO_INFRACAO: '#f97316',
  BURN_SCAR: '#eab308', FOCUS_OF_BURN: '#eab308', NOTIFICACAO: '#eab308',
  AIRSTRIP_OPENING: '#f59e0b', ACCESS: '#f59e0b',
}

function classColor(classType: string): string {
  return CLASS_COLORS[classType] || '#94a3b8'
}

function polygonBounds(polygon: GeoJSON.Polygon | GeoJSON.MultiPolygon): [[number, number], [number, number]] | null {
  const rings: number[][][] = polygon.type === 'Polygon' ? polygon.coordinates : polygon.coordinates.flat()
  let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity
  for (const ring of rings) {
    for (const [lng, lat] of ring) {
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
    }
  }
  if (!Number.isFinite(minLat)) return null
  return [[minLat, minLng], [maxLat, maxLng]]
}

function centroidOf(geometry: GeoJSON.Geometry): [number, number] | null {
  if (geometry.type === 'Point') return [geometry.coordinates[1], geometry.coordinates[0]]
  const rings: number[][][] =
    geometry.type === 'Polygon' ? geometry.coordinates
    : geometry.type === 'MultiPolygon' ? geometry.coordinates.flat()
    : []
  if (!rings.length) return null
  let sumLat = 0, sumLng = 0, count = 0
  for (const ring of rings) {
    for (const [lng, lat] of ring) { sumLat += lat; sumLng += lng; count++ }
  }
  if (!count) return null
  return [sumLat / count, sumLng / count]
}

function FitToBounds({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap()
  useMemo(() => { map.fitBounds(bounds, { padding: [24, 24] }) }, [map, bounds])
  return null
}

export default function CarMap({ car, alerts }: { car: Car; alerts: Alert[] }) {
  const [baseKey, setBaseKey] = useState('osm')
  const [activeOverlays, setActiveOverlays] = useState<Set<string>>(
    () => new Set(SEMA_OVERLAY_LAYERS.filter(l => l.defaultOn).map(l => l.key)),
  )
  const [opacity, setOpacity] = useState(0.7)

  const bounds = car.polygon ? polygonBounds(car.polygon) : null
  const base = SEMA_BASE_LAYERS.find(l => l.key === baseKey) || SEMA_BASE_LAYERS[0]

  const toggleOverlay = (key: string) => {
    setActiveOverlays(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  const categorized = useMemo(() => {
    const map = new Map<string, typeof SEMA_OVERLAY_LAYERS>()
    for (const layer of SEMA_OVERLAY_LAYERS) {
      const list = map.get(layer.category) || []
      list.push(layer)
      map.set(layer.category, list)
    }
    return [...map.entries()]
  }, [])

  if (!car.polygon || !bounds) {
    return (
      <div className="glass-card p-8 text-center text-slate-400">
        Este CAR não tem polígono disponível no WFS — o mapa não pode ser exibido.
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-4">
      <div className="glass-card p-4 md:w-64 flex-shrink-0 space-y-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Base</h3>
          <div className="space-y-1">
            {SEMA_BASE_LAYERS.map(l => (
              <label key={l.key} className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer">
                <input type="radio" name="base" checked={baseKey === l.key} onChange={() => setBaseKey(l.key)} />
                {l.label}
              </label>
            ))}
          </div>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Opacidade das camadas</h3>
          <input
            type="range" min={0.1} max={1} step={0.1} value={opacity}
            onChange={e => setOpacity(Number(e.target.value))}
            className="w-full"
          />
        </div>

        {categorized.map(([category, layers]) => (
          <div key={category}>
            <h3 className="text-sm font-semibold text-slate-300 mb-2">{category}</h3>
            <div className="space-y-1">
              {layers.map(l => (
                <label key={l.key} className="flex items-center gap-2 text-xs text-slate-400 cursor-pointer">
                  <input type="checkbox" checked={activeOverlays.has(l.key)} onChange={() => toggleOverlay(l.key)} />
                  {l.label}
                </label>
              ))}
            </div>
          </div>
        ))}

        <div>
          <h3 className="text-sm font-semibold text-slate-300 mb-2">Legenda de alertas</h3>
          <div className="space-y-1 text-xs text-slate-400">
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#ef4444' }} /> Crítico (corte raso, embargo)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#f97316' }} /> Alta (degradação, auto de infração)</div>
            <div className="flex items-center gap-2"><span className="w-2.5 h-2.5 rounded-full" style={{ background: '#eab308' }} /> Média (queimada, notificação)</div>
          </div>
        </div>
      </div>

      <div className="glass-card overflow-hidden flex-1" style={{ height: 500 }}>
        <MapContainer bounds={bounds} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
          <FitToBounds bounds={bounds} />
          {base.layerName === '' ? (
            <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
          ) : (
            <WMSTileLayer url={SEMA_WMS_URL} params={wmsParams(base.layerName) as any} />
          )}

          {SEMA_OVERLAY_LAYERS.filter(l => activeOverlays.has(l.key)).map(l => (
            <WMSTileLayer key={l.key} url={SEMA_WMS_URL} params={{ ...wmsParams(l.layerName), opacity } as any} opacity={opacity} />
          ))}

          <GeoJSON
            data={{ type: 'Feature', properties: {}, geometry: car.polygon } as Feature}
            style={{ color: '#10b981', weight: 2, fillOpacity: 0.15 }}
          />

          {alerts.filter(a => a.geometry).map(a => {
            const centroid = centroidOf(a.geometry!)
            if (!centroid) return null
            return (
              <CircleMarker key={a.id} center={centroid} radius={7} color={classColor(a.classType)} fillOpacity={0.8}>
                <Popup>
                  <div className="text-sm">
                    <strong>{a.title}</strong><br />
                    {a.detectedDate} {a.areaHa ? `• ${a.areaHa.toFixed(2)} ha` : ''}<br />
                    Severidade: {a.severity}
                  </div>
                </Popup>
              </CircleMarker>
            )
          })}
        </MapContainer>
      </div>
    </div>
  )
}
