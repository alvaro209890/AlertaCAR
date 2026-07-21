import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiFetch } from '../lib/api'
import type { Alert, AlertStatus, Severity } from '../lib/types'

const STATUS_LABELS: Record<AlertStatus, string> = {
  novo: 'Novo',
  em_analise: 'Em análise',
  validado: 'Validado',
  falso_positivo: 'Falso positivo',
  resolvido: 'Resolvido',
}

const SEVERITY_STYLES: Record<Severity, string> = {
  critica: 'bg-red-500/10 text-red-400 border-red-500/30',
  alta: 'bg-orange-500/10 text-orange-400 border-orange-500/30',
  media: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30',
  baixa: 'bg-slate-500/10 text-slate-400 border-slate-500/30',
}

const SOURCE_LABELS: Record<string, string> = {
  sccon: 'SCCON (desmatamento)',
  sema_embargo: 'Embargo',
  sema_desembargo: 'Desembargo',
  sema_infracao: 'Auto de infração',
  sema_notificacao: 'Notificação',
  sema_autorizacao: 'Autorização',
  sema_licenca: 'Licenciamento',
  fundiario: 'Sobreposição fundiária',
}

export default function AlertsPanel({ carId }: { carId: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [sourceFilter, setSourceFilter] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [expanded, setExpanded] = useState<string | null>(null)
  const [savingId, setSavingId] = useState<string | null>(null)

  const load = () => {
    setLoading(true)
    const params = new URLSearchParams({ limit: '100' })
    if (sourceFilter) params.set('source', sourceFilter)
    if (statusFilter) params.set('status', statusFilter)
    apiFetch(`/cars/${carId}/alerts?${params.toString()}`)
      .then(r => {
        if (r.alerts) { setAlerts(r.alerts); setTotal(r.total) }
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [carId, sourceFilter, statusFilter])

  const updateAlert = async (id: string, patch: { status?: AlertStatus; notes?: string }) => {
    setSavingId(id)
    const r = await apiFetch(`/alerts/${id}`, { method: 'PATCH', body: JSON.stringify(patch) })
    setSavingId(null)
    if (r.alert) {
      setAlerts(prev => prev.map(a => a.id === id ? r.alert : a))
      toast.success('Alerta atualizado')
    } else {
      toast.error(r.error || 'Erro ao atualizar alerta')
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-3">
        <select className="input-field w-auto" value={sourceFilter} onChange={e => setSourceFilter(e.target.value)}>
          <option value="">Todas as fontes</option>
          {Object.entries(SOURCE_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <select className="input-field w-auto" value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
          <option value="">Todos os status</option>
          {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        <span className="text-sm text-slate-500 self-center">{total} alerta{total !== 1 ? 's' : ''}</span>
      </div>

      {loading ? (
        <div className="text-center py-8 text-slate-400">Carregando...</div>
      ) : alerts.length === 0 ? (
        <div className="glass-card p-8 text-center text-slate-400">Nenhum alerta encontrado com esses filtros.</div>
      ) : (
        <div className="space-y-2">
          {alerts.map(a => (
            <div key={a.id} className="glass-card p-4">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-xs font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full border ${SEVERITY_STYLES[a.severity]}`}>
                      {a.severity}
                    </span>
                    <span className="text-xs text-slate-500">{SOURCE_LABELS[a.source] || a.source}</span>
                    <h4 className="font-medium">{a.title}</h4>
                  </div>
                  <div className="text-sm text-slate-400 flex gap-3 flex-wrap">
                    <span>{new Date(a.detectedDate).toLocaleDateString('pt-BR')}</span>
                    {!!a.areaHa && <span>{a.areaHa.toFixed(2)} ha</span>}
                    {a.description && <span className="text-slate-500">{a.description}</span>}
                  </div>
                </div>
                <select
                  className="input-field w-auto text-xs py-1"
                  value={a.status}
                  disabled={savingId === a.id}
                  onChange={e => updateAlert(a.id, { status: e.target.value as AlertStatus })}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <button
                  className="text-xs text-slate-400 hover:text-white px-2 py-1"
                  onClick={() => setExpanded(expanded === a.id ? null : a.id)}
                >
                  {expanded === a.id ? 'Ocultar notas' : '📝 Notas'}
                </button>
              </div>
              {expanded === a.id && (
                <div className="mt-3 border-t border-white/5 pt-3">
                  <textarea
                    className="input-field text-sm"
                    rows={2}
                    defaultValue={a.notes || ''}
                    placeholder="Anotações de campo, parecer, etc."
                    onBlur={e => {
                      if (e.target.value !== (a.notes || '')) updateAlert(a.id, { notes: e.target.value })
                    }}
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
