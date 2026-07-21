import { useEffect, useState } from 'react'
import { useLocation, useParams } from 'wouter'
import toast from 'react-hot-toast'
import { apiFetch } from '../lib/api'
import type { CarDetail } from '../lib/types'
import CarMap from '../components/CarMap'
import AlertsPanel from '../components/AlertsPanel'

type Tab = 'visao-geral' | 'alertas' | 'mapa' | 'camadas' | 'config'

const TABS: Array<{ key: Tab; label: string; icon: string }> = [
  { key: 'visao-geral', label: 'Visão Geral', icon: '📊' },
  { key: 'alertas', label: 'Alertas', icon: '🔔' },
  { key: 'mapa', label: 'Mapa', icon: '🗺️' },
  { key: 'camadas', label: 'Camadas', icon: '📐' },
  { key: 'config', label: 'Config', icon: '⚙️' },
]

const URGENCIA_LABELS: Record<string, string> = {
  ok: 'Em dia', atencao_90d: 'Atenção (90d)', atencao_60d: 'Atenção (60d)', critica_30d: 'Crítica (30d)', vencida: 'Vencida',
}

export default function CarDetailPage() {
  const params = useParams<{ id: string }>()
  const [, setLocation] = useLocation()
  const carId = params.id!
  const [detail, setDetail] = useState<CarDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('visao-geral')
  const [checking, setChecking] = useState(false)

  const load = () => {
    apiFetch(`/cars/${carId}`).then(r => {
      if (r.car) setDetail(r as CarDetail)
      else toast.error(r.error || 'CAR não encontrado')
    }).finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [carId])

  const handleCheck = async () => {
    setChecking(true)
    const [sccon, sema] = await Promise.all([
      apiFetch(`/sccon/check/${carId}`, { method: 'POST' }),
      apiFetch(`/sema-monitor/check/${carId}`, { method: 'POST' }),
    ])
    setChecking(false)
    if (sccon.error && sema.error) {
      toast.error('Erro ao verificar fontes')
    } else {
      toast.success('Verificação concluída — dados atualizados')
      load()
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center text-slate-400">Carregando...</div>
  if (!detail) return <div className="min-h-screen flex items-center justify-center text-slate-400">CAR não encontrado.</div>

  const { car, alerts, layers, licenses, sobreposicoes, conformidade } = detail
  const urgentLicenses = licenses.filter(l => l.urgencia !== 'ok')
  const alertsByClass = alerts.reduce<Record<string, number>>((acc, a) => { acc[a.severity] = (acc[a.severity] || 0) + 1; return acc }, {})

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto">
        <button className="text-sm text-slate-400 hover:text-white mb-4" onClick={() => setLocation('/dashboard')}>
          ← Voltar
        </button>

        <div className="flex items-start justify-between flex-wrap gap-3 mb-6">
          <div>
            <h1 className="text-xl font-bold">🏷️ {car.nickname || car.carNumber}</h1>
            {car.nickname && <p className="text-sm text-slate-500">{car.carNumber}</p>}
            <p className="text-sm text-slate-400 mt-1">
              {car.municipality && <>📍 {car.municipality} • </>}
              {car.areaHa && <>📐 {car.areaHa.toLocaleString('pt-BR')} ha • </>}
              🔔 {alerts.length} alertas recentes
            </p>
          </div>
          <button className="btn-primary text-sm" onClick={handleCheck} disabled={checking}>
            {checking ? '⏳ Verificando...' : '🔄 Forçar verificação'}
          </button>
        </div>

        <div className="flex gap-1 border-b border-white/5 mb-6 overflow-x-auto">
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-2 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                tab === t.key ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-white'
              }`}
            >
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {tab === 'visao-geral' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="glass-card p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Críticos</p>
                <p className="text-2xl font-bold text-red-400">{alertsByClass.critica || 0}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Altos</p>
                <p className="text-2xl font-bold text-orange-400">{alertsByClass.alta || 0}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Médios</p>
                <p className="text-2xl font-bold text-yellow-400">{alertsByClass.media || 0}</p>
              </div>
              <div className="glass-card p-4">
                <p className="text-xs text-slate-500 uppercase tracking-wider">Licenças a vencer</p>
                <p className="text-2xl font-bold text-amber-400">{urgentLicenses.length}</p>
              </div>
            </div>

            <div className="glass-card p-5">
              <h2 className="font-semibold mb-3">Conformidade de Reserva Legal</h2>
              {conformidade.bioma ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div><p className="text-slate-500">Bioma</p><p className="font-medium">{conformidade.bioma}</p></div>
                  <div><p className="text-slate-500">ARL exigida</p><p className="font-medium">{conformidade.arlExigidaPercent}% ({conformidade.arlExigidaHa?.toFixed(2)} ha)</p></div>
                  <div><p className="text-slate-500">ARL declarada</p><p className="font-medium">{conformidade.arlDeclaradaHa?.toFixed(2)} ha</p></div>
                  <div>
                    <p className="text-slate-500">Déficit</p>
                    <p className={`font-medium ${(conformidade.deficitArlHa || 0) > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                      {(conformidade.deficitArlHa || 0) > 0 ? `${conformidade.deficitArlHa?.toFixed(2)} ha` : 'Sem déficit ✅'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-sm text-slate-500">Ainda não calculada — clique em "Forçar verificação".</p>
              )}
              <p className="text-xs text-slate-600 mt-3">
                ⚠️ Cálculo simplificado (Art. 12, Lei 12.651/2012) — não considera exceções. Confirme com o RT.
              </p>
            </div>

            {sobreposicoes.length > 0 && (
              <div className="glass-card p-5">
                <h2 className="font-semibold mb-3">⚠️ Sobreposições fundiárias</h2>
                <div className="space-y-2">
                  {sobreposicoes.map(s => (
                    <div key={`${s.tipo}-${s.nome}`} className="flex justify-between text-sm">
                      <span>{s.nome}</span>
                      <span className="text-amber-400">{s.coveragePercent.toFixed(2)}% ({s.intersectionHa.toFixed(2)} ha)</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="glass-card p-5">
              <h2 className="font-semibold mb-3">Status das integrações</h2>
              <div className="text-sm text-slate-400 space-y-1">
                <p>✅ SCCON — último check: {car.lastCheckAt ? new Date(car.lastCheckAt).toLocaleString('pt-BR') : 'nunca'}</p>
                <p>✅ Camadas SEMA — atualizado: {conformidade.layersUpdatedAt ? new Date(conformidade.layersUpdatedAt).toLocaleString('pt-BR') : 'nunca'}</p>
              </div>
            </div>
          </div>
        )}

        {tab === 'alertas' && <AlertsPanel carId={carId} />}

        {tab === 'mapa' && <CarMap car={car} alerts={alerts} />}

        {tab === 'camadas' && (
          <div className="glass-card overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500 border-b border-white/5">
                  <th className="p-3">Camada</th>
                  <th className="p-3">Área (ha)</th>
                  <th className="p-3">Feições</th>
                </tr>
              </thead>
              <tbody>
                {layers.map(l => (
                  <tr key={l.key} className="border-b border-white/5 last:border-0">
                    <td className="p-3">{l.label}</td>
                    <td className="p-3 font-mono">{l.areaHa.toLocaleString('pt-BR')}</td>
                    <td className="p-3 text-slate-500">{l.featureCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {licenses.length > 0 && (
              <div className="p-4 border-t border-white/5">
                <h3 className="font-semibold mb-2 text-sm">Licenças ambientais</h3>
                <div className="space-y-1 text-sm">
                  {licenses.map(l => (
                    <div key={`${l.tipo}-${l.numeroTitulo}`} className="flex justify-between">
                      <span>{l.tipo} — {l.numeroTitulo}</span>
                      <span className={l.urgencia === 'ok' ? 'text-emerald-400' : 'text-amber-400'}>
                        {URGENCIA_LABELS[l.urgencia]}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'config' && <ConfigTab car={car} onUpdated={load} />}
      </div>
    </div>
  )
}

function ConfigTab({ car, onUpdated }: { car: CarDetail['car']; onUpdated: () => void }) {
  const [, setLocation] = useLocation()
  const [nickname, setNickname] = useState(car.nickname || '')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    const r = await apiFetch(`/cars/${car.id}`, { method: 'PATCH', body: JSON.stringify({ nickname }) })
    setSaving(false)
    if (r.car) { toast.success('Apelido salvo'); onUpdated() }
    else toast.error(r.error || 'Erro ao salvar')
  }

  const handleDelete = async () => {
    if (!confirm('Remover este CAR do monitoramento? Esta ação não pode ser desfeita.')) return
    setDeleting(true)
    await apiFetch(`/cars/${car.id}`, { method: 'DELETE' })
    setDeleting(false)
    toast.success('CAR removido')
    setLocation('/dashboard')
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="glass-card p-5">
        <label className="text-sm text-slate-400 block mb-1">Apelido</label>
        <div className="flex gap-2">
          <input className="input-field" value={nickname} onChange={e => setNickname(e.target.value)} placeholder="Ex: Fazenda São João" />
          <button className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Salvando...' : 'Salvar'}</button>
        </div>
      </div>

      <div className="glass-card p-5 border border-red-500/20">
        <h3 className="font-semibold text-red-400 mb-2">⚠️ Zona de perigo</h3>
        <p className="text-sm text-slate-400 mb-3">Remover este CAR do monitoramento. Esta ação não pode ser desfeita.</p>
        <button className="text-sm text-red-400 hover:text-red-300 border border-red-500/30 rounded-lg px-3 py-1.5" onClick={handleDelete} disabled={deleting}>
          {deleting ? 'Removendo...' : '🗑️ Remover este CAR'}
        </button>
      </div>
    </div>
  )
}
