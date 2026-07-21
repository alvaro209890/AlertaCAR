import { useState, useEffect, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '../lib/auth'
import { apiFetch } from '../lib/api'
import type { Car } from '../lib/types'
import PortfolioAssistant from '../components/PortfolioAssistant'

export default function DashboardPage() {
  const { user, logout } = useAuth()
  const [, setLocation] = useLocation()
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [carInput, setCarInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [checking, setChecking] = useState<string | null>(null)
  const [checkMsg, setCheckMsg] = useState<{ carId: string; text: string; type: 'ok' | 'err' } | null>(null)

  const loadCars = () => {
    apiFetch('/cars').then(r => {
      if (r.cars) setCars(r.cars)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadCars() }, [])

  const handleAdd = async (e: FormEvent) => {
    e.preventDefault()
    if (!carInput.trim() || carInput.trim().length < 3) return
    setAdding(true)
    setAddMsg(null)
    const r = await apiFetch('/cars', { method: 'POST', body: JSON.stringify({ carNumber: carInput.trim() }) })
    setAdding(false)
    if (r.car) {
      setCarInput('')
      setShowAdd(false)
      setAddMsg({ type: 'ok', text: r.message })
      loadCars()
      setTimeout(() => setAddMsg(null), 5000)
    } else {
      setAddMsg({ type: 'err', text: r.error || 'Erro ao adicionar CAR' })
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Remover este CAR do monitoramento?')) return
    setDeleting(id)
    await apiFetch(`/cars/${id}`, { method: 'DELETE' })
    setDeleting(null)
    loadCars()
  }

  const handleCheck = async (carId: string) => {
    setChecking(carId)
    setCheckMsg(null)
    const [sccon] = await Promise.all([
      apiFetch(`/sccon/check/${carId}`, { method: 'POST' }),
      apiFetch(`/sema-monitor/check/${carId}`, { method: 'POST' }),
    ])
    setChecking(null)
    if (sccon.error) {
      setCheckMsg({ carId, text: sccon.error, type: 'err' })
    } else {
      setCheckMsg({ carId, text: `${sccon.alertsNew} novos de ${sccon.alertsFound} encontrados (SCCON)`, type: 'ok' })
      loadCars()
    }
    setTimeout(() => setCheckMsg(null), 8000)
  }

  const totalArea = cars.reduce((sum, c) => sum + (c.areaHa || 0), 0)
  const totalAlerts = cars.reduce((sum, c) => sum + c.alertCount, 0)

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold">👋 {user?.name}</h1>
            <p className="text-sm text-slate-400">
              {cars.length} CAR{cars.length !== 1 ? 's' : ''} monitorado{cars.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-2">
            <button onClick={logout} className="text-sm text-slate-400 hover:text-white transition-colors px-3 py-1 rounded-lg hover:bg-slate-800">
              Sair
            </button>
          </div>
        </div>

        {cars.length > 0 && (
          <>
            <div className="grid grid-cols-3 gap-4 mb-6">
              {[
                { label: 'CARs Ativos', value: cars.length, icon: '🌿' },
                { label: 'Área Total', value: `${totalArea.toLocaleString('pt-BR')} ha`, icon: '📐' },
                { label: 'Alertas', value: totalAlerts, icon: '🔔' },
              ].map(s => (
                <div key={s.label} className="glass-card p-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-lg">{s.icon}</span>
                    <span className="text-sm text-slate-400">{s.label}</span>
                  </div>
                  <p className="text-xl font-bold">{s.value}</p>
                </div>
              ))}
            </div>
            <PortfolioAssistant />
          </>
        )}

        {addMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            addMsg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {addMsg.type === 'ok' ? '✅ ' : '❌ '}{addMsg.text}
          </div>
        )}

        {showAdd && (
          <div className="glass-card p-6 mb-6 animate-fadeIn">
            <h2 className="text-lg font-semibold mb-4">Adicionar CAR</h2>
            <form onSubmit={handleAdd} className="flex gap-3">
              <input
                type="text"
                className="input-field flex-1"
                placeholder="Ex: MT271442/2017 ou 271442"
                value={carInput}
                onChange={e => setCarInput(e.target.value)}
                autoFocus
                disabled={adding}
              />
              <button type="submit" className="btn-primary" disabled={adding || carInput.trim().length < 3}>
                {adding ? 'Buscando...' : 'Adicionar'}
              </button>
              <button type="button" className="px-4 py-2 text-sm text-slate-400 hover:text-white" onClick={() => setShowAdd(false)}>
                Cancelar
              </button>
            </form>
            <p className="text-xs text-slate-500 mt-2">
              Número do CAR no formato MTXXXXX/YYYY ou apenas o número (ex: 26095)
            </p>
          </div>
        )}

        {loading ? (
          <div className="text-center py-12 text-slate-400">Carregando...</div>
        ) : cars.length === 0 ? (
          <div className="glass-card p-12 text-center">
            <p className="text-4xl mb-4">🌿</p>
            <h2 className="text-lg font-semibold mb-2">Nenhum CAR monitorado</h2>
            <p className="text-slate-400 mb-6">Adicione seu primeiro CAR para começar a receber alertas de desmatamento</p>
            <button className="btn-primary" onClick={() => setShowAdd(true)}>
              + Adicionar CAR
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-lg font-semibold">Seus CARs</h2>
              <button className="btn-primary text-sm" onClick={() => setShowAdd(true)}>
                + Adicionar
              </button>
            </div>
            {cars.map(car => (
              <div
                key={car.id}
                className="glass-card p-5 hover:bg-slate-800/30 transition-colors group cursor-pointer"
                onClick={() => setLocation(`/dashboard/cars/${car.id}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{car.nickname || car.carNumber}</h3>
                      {car.nickname && <span className="text-xs text-slate-500">{car.carNumber}</span>}
                      {car.polygon && (
                        <span className="text-xs bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded border border-emerald-500/20">
                          Polígono WFS
                        </span>
                      )}
                      {!car.polygon && (
                        <span className="text-xs bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">
                          Sem polígono
                        </span>
                      )}
                      {car.alertCount > 0 && (
                        <span className="text-xs bg-red-500/10 text-red-400 px-2 py-0.5 rounded border border-red-500/20">
                          {car.alertCount} alerta{car.alertCount !== 1 ? 's' : ''}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-4 text-sm text-slate-400">
                      {car.municipality && <span>📍 {car.municipality}</span>}
                      {car.areaHa && <span>📐 {car.areaHa.toLocaleString('pt-BR')} ha</span>}
                      {car.lastPolygonFetch && (
                        <span>🕐 Atualizado {new Date(car.lastPolygonFetch).toLocaleDateString('pt-BR')}</span>
                      )}
                    </div>

                    {checkMsg && checkMsg.carId === car.id && (
                      <div className={`mt-3 text-xs px-3 py-1.5 rounded ${
                        checkMsg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                        {checkMsg.type === 'ok' ? '✅ ' : '❌ '}{checkMsg.text}
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col gap-1 ml-3" onClick={e => e.stopPropagation()}>
                    <button
                      onClick={() => handleCheck(car.id)}
                      disabled={checking === car.id}
                      className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
                      title="Verificar todas as fontes"
                    >
                      {checking === car.id ? '⏳ Verificando...' : '🔍 Verificar'}
                    </button>
                    <button
                      onClick={() => setLocation(`/dashboard/cars/${car.id}`)}
                      className="text-xs px-2 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors opacity-0 group-hover:opacity-100 whitespace-nowrap"
                    >
                      📋 Detalhes
                    </button>
                    <button
                      onClick={() => handleDelete(car.id)}
                      disabled={deleting === car.id}
                      className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 p-1"
                      title="Remover"
                    >
                      {deleting === car.id ? '⏳' : '✕'}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
