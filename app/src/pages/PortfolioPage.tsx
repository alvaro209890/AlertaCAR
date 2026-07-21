import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { MapContainer, TileLayer, GeoJSON, useMap } from 'react-leaflet'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import 'leaflet/dist/leaflet.css'
import { apiDownload, apiFetch } from '../lib/api'
import type { BulkImportResult, Car, ExportFormat, PortfolioAnalytics } from '../lib/types'

type SortKey = 'nome' | 'municipio' | 'area' | 'alertas' | 'risco' | 'check'
type TabKey = 'tabela' | 'mapa' | 'analytics'

const RISK_COLOR: Record<string, string> = { critico: '#ef4444', alto: '#fb923c', medio: '#facc15', baixo: '#34d399' }

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

function FitAll({ bounds }: { bounds: [[number, number], [number, number]] }) {
  const map = useMap()
  useEffect(() => { map.fitBounds(bounds, { padding: [24, 24] }) }, [map, bounds])
  return null
}

export default function PortfolioPage() {
  const [, setLocation] = useLocation()
  const [tab, setTab] = useState<TabKey>('tabela')
  const [cars, setCars] = useState<Car[]>([])
  const [riskByCar, setRiskByCar] = useState<Record<string, { score: number; band: string }>>({})
  const [analytics, setAnalytics] = useState<PortfolioAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [sortKey, setSortKey] = useState<SortKey>('risco')
  const [sortDir, setSortDir] = useState<1 | -1>(-1)
  const [search, setSearch] = useState('')
  const [exportFormat, setExportFormat] = useState<ExportFormat>('geojson')
  const [busy, setBusy] = useState<string | null>(null)
  const [msg, setMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [pasteList, setPasteList] = useState('')
  const [csvText, setCsvText] = useState('')
  const [importing, setImporting] = useState(false)
  const [importResults, setImportResults] = useState<BulkImportResult[] | null>(null)

  const loadAll = () => {
    setLoading(true)
    Promise.all([apiFetch('/cars'), apiFetch('/ai/risk-scores'), apiFetch('/portfolio/analytics')])
      .then(([carsRes, riskRes, analyticsRes]) => {
        if (carsRes.cars) setCars(carsRes.cars)
        if (Array.isArray(riskRes.scores)) {
          setRiskByCar(Object.fromEntries(riskRes.scores.map((r: { carId: string; score: number; band: string }) => [r.carId, r])))
        }
        if (analyticsRes && !analyticsRes.error) setAnalytics(analyticsRes)
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { loadAll() }, [])

  const flash = (type: 'ok' | 'err', text: string) => {
    setMsg({ type, text })
    setTimeout(() => setMsg(null), 6000)
  }

  const normalizedSearch = search.trim().toLocaleLowerCase('pt-BR')
  const filteredCars = cars.filter((car) => {
    if (!normalizedSearch) return true
    const haystack = [car.nickname, car.carNumber, car.municipality, car.client?.name, ...car.tags.map((t) => t.name)].filter(Boolean).join(' ')
    return haystack.toLocaleLowerCase('pt-BR').includes(normalizedSearch)
  })

  const sortedCars = useMemo(() => {
    const list = [...filteredCars]
    list.sort((a, b) => {
      let diff = 0
      if (sortKey === 'nome') diff = (a.nickname || a.carNumber).localeCompare(b.nickname || b.carNumber)
      else if (sortKey === 'municipio') diff = (a.municipality || '').localeCompare(b.municipality || '')
      else if (sortKey === 'area') diff = (a.areaHa || 0) - (b.areaHa || 0)
      else if (sortKey === 'alertas') diff = a.alertCount - b.alertCount
      else if (sortKey === 'risco') diff = (riskByCar[a.id]?.score || 0) - (riskByCar[b.id]?.score || 0)
      else if (sortKey === 'check') diff = (a.lastCheckAt || '').localeCompare(b.lastCheckAt || '')
      return diff * sortDir
    })
    return list
  }, [filteredCars, sortKey, sortDir, riskByCar])

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) setSortDir((d) => (d === 1 ? -1 : 1))
    else { setSortKey(key); setSortDir(-1) }
  }

  const toggleSelected = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const toggleSelectAll = () => {
    setSelected((prev) => (prev.size === sortedCars.length ? new Set() : new Set(sortedCars.map((c) => c.id))))
  }

  const handleBulkCheck = async () => {
    if (!selected.size) return
    setBusy('check')
    const r = await apiFetch('/portfolio/bulk-check', { method: 'POST', body: JSON.stringify({ carIds: [...selected] }) })
    setBusy(null)
    if (r.error) { flash('err', r.error); return }
    const totalNew = (r.results || []).reduce((sum: number, x: { alertsNew?: number; semaNewAlerts?: number }) => sum + (x.alertsNew || 0) + (x.semaNewAlerts || 0), 0)
    flash('ok', `Verificação concluída: ${totalNew} alerta(s) novo(s) em ${selected.size} imóve(is)`)
    loadAll()
  }

  const handleBulkExport = async () => {
    setBusy('export')
    const carIdsParam = selected.size ? `&carIds=${[...selected].join(',')}` : ''
    const r = await apiDownload(`/portfolio/export?format=${exportFormat}${carIdsParam}`, `carteira.${exportFormat}`)
    setBusy(null)
    if (r.error) flash('err', r.error)
  }

  const handlePortfolioReport = async () => {
    setBusy('report')
    const r = await apiDownload('/portfolio/report.pdf', 'relatorio_carteira.pdf')
    setBusy(null)
    if (r.error) flash('err', r.error)
  }

  const handlePasteImport = async (e: FormEvent) => {
    e.preventDefault()
    if (!pasteList.trim()) return
    setImporting(true)
    setImportResults(null)
    const r = await apiFetch('/cars/bulk-import', { method: 'POST', body: JSON.stringify({ carNumbers: pasteList }) })
    setImporting(false)
    if (r.error) { flash('err', r.error); return }
    setImportResults(r.results)
    setPasteList('')
    loadAll()
  }

  const handleCsvImport = async (e: FormEvent) => {
    e.preventDefault()
    if (!csvText.trim()) return
    setImporting(true)
    setImportResults(null)
    const r = await apiFetch('/cars/bulk-import-csv', { method: 'POST', body: JSON.stringify({ csv: csvText }) })
    setImporting(false)
    if (r.error) { flash('err', r.error); return }
    setImportResults(r.results)
    setCsvText('')
    loadAll()
  }

  const carsWithPolygon = cars.filter((c) => c.polygon)
  const allBounds = useMemo(() => {
    const boxes = carsWithPolygon.map((c) => polygonBounds(c.polygon!)).filter(Boolean) as Array<[[number, number], [number, number]]>
    if (!boxes.length) return null
    let minLat = Infinity, minLng = Infinity, maxLat = -Infinity, maxLng = -Infinity
    for (const [[la1, lo1], [la2, lo2]] of boxes) {
      minLat = Math.min(minLat, la1, la2); maxLat = Math.max(maxLat, la1, la2)
      minLng = Math.min(minLng, lo1, lo2); maxLng = Math.max(maxLng, lo1, lo2)
    }
    return [[minLat, minLng], [maxLat, maxLng]] as [[number, number], [number, number]]
  }, [carsWithPolygon])

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">📂 Carteira</h1>
            <p className="text-sm text-slate-400">{cars.length} imóve{cars.length !== 1 ? 'is' : 'l'} monitorado{cars.length !== 1 ? 's' : ''}</p>
          </div>
          <button onClick={() => setLocation('/dashboard')} className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1 rounded-lg hover:bg-slate-800">
            ← Dashboard
          </button>
        </div>

        {msg && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${msg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-red-500/10 text-red-400 border border-red-500/20'}`}>
            {msg.type === 'ok' ? '✅ ' : '❌ '}{msg.text}
          </div>
        )}

        <div className="flex gap-2 mb-4 border-b border-white/10">
          {(['tabela', 'mapa', 'analytics'] as TabKey[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${tab === t ? 'border-emerald-500 text-white' : 'border-transparent text-slate-400 hover:text-white'}`}
            >
              {t === 'tabela' ? '📋 Tabela' : t === 'mapa' ? '🗺️ Mapa' : '📊 Analytics'}
            </button>
          ))}
        </div>

        <div className="glass-card p-4 mb-4">
          <button className="text-sm font-semibold text-slate-300 hover:text-white" onClick={() => setShowImport((v) => !v)}>
            {showImport ? '▾' : '▸'} Importação em massa
          </button>
          {showImport && (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <form onSubmit={handlePasteImport}>
                <label className="text-xs text-slate-400">Colar lista de nº de CAR (um por linha, máx. 50)</label>
                <textarea className="input-field w-full mt-1 h-24 font-mono text-xs" value={pasteList} onChange={(e) => setPasteList(e.target.value)}
                  placeholder={'MT271442/2017\nMT8019/2017\n...'} disabled={importing} />
                <button type="submit" className="btn-primary text-sm mt-2" disabled={importing || !pasteList.trim()}>
                  {importing ? 'Importando...' : 'Importar lista'}
                </button>
              </form>
              <form onSubmit={handleCsvImport}>
                <label className="text-xs text-slate-400">Colar CSV: nºCAR,apelido,cliente,tag1;tag2 (máx. 50 linhas)</label>
                <textarea className="input-field w-full mt-1 h-24 font-mono text-xs" value={csvText} onChange={(e) => setCsvText(e.target.value)}
                  placeholder={'MT271442/2017,Fazenda X,Cliente Y,prioritario;norte'} disabled={importing} />
                <button type="submit" className="btn-primary text-sm mt-2" disabled={importing || !csvText.trim()}>
                  {importing ? 'Importando...' : 'Importar CSV'}
                </button>
              </form>
              {importResults && (
                <div className="md:col-span-2 mt-2">
                  <p className="text-xs text-slate-400 mb-2">
                    {importResults.filter((r) => r.success).length} de {importResults.length} importado(s)
                  </p>
                  <div className="max-h-40 overflow-y-auto text-xs space-y-1">
                    {importResults.map((r) => (
                      <div key={r.carNumber} className={`px-2 py-1 rounded ${r.success ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'}`}>
                        {r.success ? '✅' : '❌'} {r.carNumber} {r.success ? (r.polygonFound ? '— polígono encontrado' : '— sem polígono no WFS') : `— ${r.error}`}
                      </div>
                    ))}
                  </div>
                </div>
              )}
              <p className="md:col-span-2 text-xs text-slate-500">
                Upload de Shapefile/KML/GeoJSON com múltiplos polígonos ainda não implementado nesta rodada — por ora, a importação em massa busca o polígono via WFS pelo número do CAR.
              </p>
            </div>
          )}
        </div>

        {loading ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : cars.length === 0 ? (
          <div className="glass-card p-12 text-center text-slate-400">Nenhum imóvel na carteira ainda.</div>
        ) : (
          <>
            {tab === 'tabela' && (
              <div className="glass-card p-4">
                <div className="flex flex-wrap items-center gap-3 mb-3">
                  <input className="input-field flex-1 min-w-[200px] py-2" placeholder="Buscar..." value={search} onChange={(e) => setSearch(e.target.value)} />
                  <select className="input-field w-auto py-2" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
                    {(['geojson', 'shp', 'kml', 'kmz', 'csv', 'gpkg'] as ExportFormat[]).map((f) => <option key={f} value={f}>{f.toUpperCase()}</option>)}
                  </select>
                  <button className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300" disabled={busy === 'export'} onClick={handleBulkExport}>
                    {busy === 'export' ? '⏳' : '📥'} Exportar {selected.size ? `(${selected.size})` : '(todos)'}
                  </button>
                  <button className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-40" disabled={!selected.size || busy === 'check'} onClick={handleBulkCheck}>
                    {busy === 'check' ? '⏳' : '🔍'} Verificar selecionados
                  </button>
                  <button className="text-xs px-3 py-2 rounded bg-slate-800 hover:bg-slate-700 text-slate-300" disabled={busy === 'report'} onClick={handlePortfolioReport}>
                    {busy === 'report' ? '⏳' : '📄'} Relatório da carteira (PDF)
                  </button>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-slate-400 border-b border-white/10">
                        <th className="py-2 pr-2"><input type="checkbox" checked={selected.size === sortedCars.length && sortedCars.length > 0} onChange={toggleSelectAll} /></th>
                        <SortableTh label="Imóvel" k="nome" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                        <th className="py-2 px-2">Cliente</th>
                        <SortableTh label="Município" k="municipio" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                        <SortableTh label="Área" k="area" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                        <SortableTh label="Alertas" k="alertas" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                        <SortableTh label="Score" k="risco" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                        <SortableTh label="Último check" k="check" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} />
                      </tr>
                    </thead>
                    <tbody>
                      {sortedCars.map((car) => (
                        <tr key={car.id} className="border-b border-white/5 hover:bg-white/5 cursor-pointer" onClick={() => setLocation(`/dashboard/cars/${car.id}`)}>
                          <td className="py-2 pr-2" onClick={(e) => e.stopPropagation()}>
                            <input type="checkbox" checked={selected.has(car.id)} onChange={() => toggleSelected(car.id)} />
                          </td>
                          <td className="py-2 px-2 font-medium">{car.nickname || car.carNumber}</td>
                          <td className="py-2 px-2 text-slate-400">{car.client?.name || '—'}</td>
                          <td className="py-2 px-2 text-slate-400">{car.municipality || '—'}</td>
                          <td className="py-2 px-2 text-slate-400">{car.areaHa ? `${car.areaHa.toLocaleString('pt-BR')} ha` : '—'}</td>
                          <td className="py-2 px-2 text-slate-400">{car.alertCount}</td>
                          <td className="py-2 px-2">
                            {riskByCar[car.id] ? (
                              <span className="px-2 py-0.5 rounded text-xs border" style={{ color: RISK_COLOR[riskByCar[car.id].band], borderColor: RISK_COLOR[riskByCar[car.id].band] }}>
                                {riskByCar[car.id].score}
                              </span>
                            ) : '—'}
                          </td>
                          <td className="py-2 px-2 text-slate-400">{car.lastCheckAt ? new Date(car.lastCheckAt).toLocaleDateString('pt-BR') : 'nunca'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {tab === 'mapa' && (
              <div className="glass-card p-2 overflow-hidden" style={{ height: 560 }}>
                {allBounds ? (
                  <MapContainer bounds={allBounds} style={{ height: '100%', width: '100%', borderRadius: 8 }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
                    <FitAll bounds={allBounds} />
                    {carsWithPolygon.map((car) => (
                      <GeoJSON
                        key={car.id}
                        data={car.polygon as GeoJSON.Geometry}
                        style={{ color: RISK_COLOR[riskByCar[car.id]?.band] || '#10b981', weight: 2, fillOpacity: 0.2 }}
                        eventHandlers={{ click: () => setLocation(`/dashboard/cars/${car.id}`) }}
                      />
                    ))}
                  </MapContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-slate-400">Nenhum imóvel com polígono para exibir no mapa.</div>
                )}
              </div>
            )}

            {tab === 'analytics' && analytics && (
              <div className="space-y-4">
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {[
                    { label: 'Imóveis', value: analytics.totalImoveis, icon: '🌿' },
                    { label: 'Área total', value: `${analytics.totalAreaHa.toLocaleString('pt-BR')} ha`, icon: '📐' },
                    { label: 'Alertas (classes)', value: analytics.alertsByClass.reduce((s, c) => s + c.count, 0), icon: '🔔' },
                    { label: 'Municípios', value: analytics.alertsByMunicipality.length, icon: '📍' },
                  ].map((s) => (
                    <div key={s.label} className="glass-card p-4">
                      <div className="flex items-center gap-2 mb-1"><span>{s.icon}</span><span className="text-sm text-slate-400">{s.label}</span></div>
                      <p className="text-xl font-bold">{s.value}</p>
                    </div>
                  ))}
                </div>

                <div className="glass-card p-4">
                  <h3 className="text-sm font-semibold text-slate-300 mb-2">Tendência de alertas (12 meses)</h3>
                  {analytics.monthlyTrend.length ? (
                    <ResponsiveContainer width="100%" height={220}>
                      <LineChart data={analytics.monthlyTrend}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                        <XAxis dataKey="month" stroke="#94a3b8" fontSize={11} />
                        <YAxis stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                        <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #ffffff20', fontSize: 12 }} />
                        <Line type="monotone" dataKey="count" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Alertas" />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : <p className="text-sm text-slate-500">Sem alertas no período.</p>}
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Alertas por classe</h3>
                    {analytics.alertsByClass.length ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.alertsByClass} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                          <YAxis type="category" dataKey="classType" stroke="#94a3b8" fontSize={10} width={110} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #ffffff20', fontSize: 12 }} />
                          <Bar dataKey="count" fill="#10b981" name="Alertas" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-sm text-slate-500">Sem alertas.</p>}
                  </div>
                  <div className="glass-card p-4">
                    <h3 className="text-sm font-semibold text-slate-300 mb-2">Alertas por município</h3>
                    {analytics.alertsByMunicipality.length ? (
                      <ResponsiveContainer width="100%" height={220}>
                        <BarChart data={analytics.alertsByMunicipality} layout="vertical">
                          <CartesianGrid strokeDasharray="3 3" stroke="#ffffff10" />
                          <XAxis type="number" stroke="#94a3b8" fontSize={11} allowDecimals={false} />
                          <YAxis type="category" dataKey="municipality" stroke="#94a3b8" fontSize={10} width={110} />
                          <Tooltip contentStyle={{ background: '#0f172a', border: '1px solid #ffffff20', fontSize: 12 }} />
                          <Bar dataKey="count" fill="#f59e0b" name="Alertas" />
                        </BarChart>
                      </ResponsiveContainer>
                    ) : <p className="text-sm text-slate-500">Sem alertas.</p>}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

function SortableTh({ label, k, sortKey, sortDir, onClick }: { label: string; k: SortKey; sortKey: SortKey; sortDir: 1 | -1; onClick: (k: SortKey) => void }) {
  return (
    <th className="py-2 px-2 cursor-pointer select-none hover:text-white" onClick={() => onClick(k)}>
      {label} {sortKey === k ? (sortDir === 1 ? '▲' : '▼') : ''}
    </th>
  )
}
