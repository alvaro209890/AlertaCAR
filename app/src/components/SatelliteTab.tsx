import { useEffect, useMemo, useRef, useState } from 'react'
import { MapContainer, WMSTileLayer, GeoJSON } from 'react-leaflet'
import type { Feature } from 'geojson'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import 'leaflet/dist/leaflet.css'
import { apiFetch } from '../lib/api'
import { SEMA_WMS_URL, wmsParams } from '../lib/sema-layers'
import { layerNameForSatellite } from '../lib/satellite-layers'
import type { Car, NdviTrendResult, SatelliteCapabilities } from '../lib/types'

const CLASSIFICACAO_LABELS: Record<NdviTrendResult['classificacao'], { label: string; className: string }> = {
  recuperando: { label: '🌱 Recuperando vegetação', className: 'text-emerald-400' },
  estavel: { label: '➖ Estável', className: 'text-slate-300' },
  perdendo_vegetacao: { label: '⚠️ Perdendo vegetação', className: 'text-red-400' },
  indeterminado: { label: 'Indeterminado', className: 'text-slate-500' },
}

function SatMap({ bbox, layerName, car }: { bbox: [number, number, number, number]; layerName: string; car: Car }) {
  const bounds: [[number, number], [number, number]] = [
    [bbox[1], bbox[0]],
    [bbox[3], bbox[2]],
  ]
  return (
    <MapContainer bounds={bounds} style={{ height: '100%', width: '100%' }} scrollWheelZoom>
      <WMSTileLayer key={layerName} url={SEMA_WMS_URL} params={wmsParams(layerName) as any} />
      {car.polygon && (
        <GeoJSON
          key={layerName + '-poly'}
          data={{ type: 'Feature', properties: {}, geometry: car.polygon } as Feature}
          style={{ color: '#10b981', weight: 2, fillOpacity: 0.05 }}
        />
      )}
    </MapContainer>
  )
}

export default function SatelliteTab({ car, carId }: { car: Car; carId: string }) {
  const [caps, setCaps] = useState<SatelliteCapabilities | null>(null)
  const [loading, setLoading] = useState(true)
  const [satId, setSatId] = useState('sentinel2')
  const [yearIndex, setYearIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [compareMode, setCompareMode] = useState(false)
  const [compareYearIndex, setCompareYearIndex] = useState(0)
  const [ndvi, setNdvi] = useState<NdviTrendResult | null>(null)
  const [ndviLoading, setNdviLoading] = useState(false)
  const [ndviError, setNdviError] = useState<string | null>(null)
  const playTimer = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    apiFetch(`/cars/${carId}/satellite/capabilities`).then(r => {
      if (r.satellites) {
        setCaps(r as SatelliteCapabilities)
        const sentinel = (r as SatelliteCapabilities).satellites.find(s => s.id === 'sentinel2')
        if (sentinel) {
          setYearIndex(sentinel.years.length - 1)
          setCompareYearIndex(0)
        }
      }
      setLoading(false)
    })
  }, [carId])

  useEffect(() => {
    return () => { if (playTimer.current) clearInterval(playTimer.current) }
  }, [])

  const satellite = caps?.satellites.find(s => s.id === satId)
  const years = satellite?.years ?? []

  const togglePlay = () => {
    if (playing) {
      if (playTimer.current) clearInterval(playTimer.current)
      setPlaying(false)
      return
    }
    setPlaying(true)
    playTimer.current = setInterval(() => {
      setYearIndex(prev => (years.length ? (prev + 1) % years.length : 0))
    }, 900)
  }

  const handleSatChange = (id: string) => {
    if (playTimer.current) { clearInterval(playTimer.current); setPlaying(false) }
    setSatId(id)
    const s = caps?.satellites.find(x => x.id === id)
    setYearIndex(s ? s.years.length - 1 : 0)
  }

  const loadNdviTrend = async () => {
    setNdviLoading(true)
    setNdviError(null)
    const r = await apiFetch(`/cars/${carId}/satellite/ndvi-trend`)
    setNdviLoading(false)
    if (r.points) setNdvi(r as NdviTrendResult)
    else setNdviError(r.error || 'Erro ao calcular NDVI')
  }

  const chartData = useMemo(
    () => (ndvi?.points ?? []).filter(p => p.meanNdvi !== null).map(p => ({ year: p.year, ndvi: p.meanNdvi, pctVegetacao: p.pctVegetacao })),
    [ndvi],
  )

  if (loading) return <div className="glass-card p-8 text-center text-slate-400">Carregando catálogo de satélites...</div>
  if (!caps) return <div className="glass-card p-8 text-center text-slate-400">Não foi possível carregar o catálogo de satélites.</div>
  if (!satellite || !years.length) return <div className="glass-card p-8 text-center text-slate-400">Satélite sem anos disponíveis.</div>

  return (
    <div className="space-y-6">
      <div className="glass-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <select className="input-field w-auto" value={satId} onChange={e => handleSatChange(e.target.value)}>
            {caps.satellites.filter(s => s.years.length > 0).map(s => (
              <option key={s.id} value={s.id}>{s.label}</option>
            ))}
          </select>

          <button className="btn-primary text-sm" onClick={togglePlay}>
            {playing ? '⏸ Pausar' : '▶️ Reproduzir'}
          </button>

          <label className="flex items-center gap-2 text-sm text-slate-400 cursor-pointer ml-auto">
            <input type="checkbox" checked={compareMode} onChange={e => setCompareMode(e.target.checked)} />
            Comparar dois períodos (split-view)
          </label>
        </div>

        <div>
          <div className="flex justify-between text-xs text-slate-500 mb-1">
            <span>{years[0]}</span>
            <span className="text-emerald-400 font-semibold">{years[yearIndex]}</span>
            <span>{years[years.length - 1]}</span>
          </div>
          <input
            type="range" min={0} max={years.length - 1} step={1} value={yearIndex}
            onChange={e => setYearIndex(Number(e.target.value))}
            className="w-full"
          />
        </div>
      </div>

      {!compareMode ? (
        <div className="glass-card overflow-hidden" style={{ height: 480 }}>
          <SatMap bbox={caps.bbox} layerName={layerNameForSatellite(satId, years[yearIndex])} car={car} />
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <p className="text-xs text-slate-500 mb-1">Antes — {years[yearIndex]}</p>
            <div className="glass-card overflow-hidden" style={{ height: 400 }}>
              <SatMap bbox={caps.bbox} layerName={layerNameForSatellite(satId, years[yearIndex])} car={car} />
            </div>
          </div>
          <div>
            <div className="flex justify-between items-center mb-1">
              <p className="text-xs text-slate-500">Depois</p>
              <select className="input-field w-auto text-xs py-1" value={compareYearIndex} onChange={e => setCompareYearIndex(Number(e.target.value))}>
                {years.map((y, i) => <option key={y} value={i}>{y}</option>)}
              </select>
            </div>
            <div className="glass-card overflow-hidden" style={{ height: 400 }}>
              <SatMap bbox={caps.bbox} layerName={layerNameForSatellite(satId, years[compareYearIndex])} car={car} />
            </div>
          </div>
        </div>
      )}

      <div className="glass-card p-5">
        <div className="flex items-center justify-between flex-wrap gap-3 mb-3">
          <h2 className="font-semibold">🌿 Tendência de vegetação (NDVI simplificado)</h2>
          <button className="btn-primary text-sm" onClick={loadNdviTrend} disabled={ndviLoading}>
            {ndviLoading ? '⏳ Calculando (pode levar ~30s)...' : ndvi ? '🔄 Recalcular' : '📈 Calcular tendência'}
          </button>
        </div>

        {ndviError && <p className="text-sm text-red-400">{ndviError}</p>}

        {ndvi && chartData.length > 0 && (
          <>
            <div className="flex flex-wrap gap-6 mb-4 text-sm">
              <div>
                <p className="text-slate-500">Variação (primeiro → último ano)</p>
                <p className={`font-semibold ${(ndvi.deltaNdvi ?? 0) >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                  {ndvi.deltaNdvi !== null ? (ndvi.deltaNdvi >= 0 ? '+' : '') + ndvi.deltaNdvi : '—'}
                </p>
              </div>
              <div>
                <p className="text-slate-500">Classificação</p>
                <p className={`font-semibold ${CLASSIFICACAO_LABELS[ndvi.classificacao].className}`}>
                  {CLASSIFICACAO_LABELS[ndvi.classificacao].label}
                </p>
              </div>
            </div>

            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                <XAxis dataKey="year" stroke="#94a3b8" fontSize={12} />
                <YAxis domain={[-0.2, 1]} stroke="#94a3b8" fontSize={12} />
                <ReferenceLine y={0.3} stroke="#f59e0b" strokeDasharray="4 4" label={{ value: 'limiar vegetação', fill: '#f59e0b', fontSize: 10 }} />
                <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #ffffff20', fontSize: 12 }} />
                <Line type="monotone" dataKey="ndvi" stroke="#10b981" strokeWidth={2} dot={{ r: 4 }} name="NDVI médio" />
              </LineChart>
            </ResponsiveContainer>

            <p className="text-xs text-slate-600 mt-3">
              Amostrado via satélite Sentinel-2 em {ndvi.points[0]?.sampledPoints ?? 0} pontos dentro do imóvel por ano
              (GetFeatureInfo pixel a pixel — o servidor da SEMA não expõe banda bruta via WCS). É um índice
              simplificado e relativo (bom para comparar o MESMO imóvel ao longo do tempo), não um NDVI de
              reflectância calibrada — não compare com valores de outra fonte/sensor.
            </p>
          </>
        )}

        {!ndvi && !ndviLoading && !ndviError && (
          <p className="text-sm text-slate-500">
            Calcula o índice de vegetação (NDVI) de {years[0]} a {years[years.length - 1]} amostrando pixels
            reais do Sentinel-2 dentro do polígono do imóvel — útil pra ver se a vegetação está se recuperando
            ou perdendo área ao longo dos anos.
          </p>
        )}
      </div>
    </div>
  )
}
