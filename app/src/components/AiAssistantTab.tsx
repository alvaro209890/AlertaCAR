import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiFetch, apiStream } from '../lib/api'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type Risk = { score: number; band: string; explanation: string; cached: boolean }
type Laudo = { id: string; contentMd: string; status: 'rascunho' | 'final'; updatedAt: string }

const BAND_STYLE: Record<string, string> = {
  baixo: 'text-emerald-300 bg-emerald-500/10 border-emerald-500/20',
  medio: 'text-yellow-300 bg-yellow-500/10 border-yellow-500/20',
  alto: 'text-orange-300 bg-orange-500/10 border-orange-500/20',
  critico: 'text-red-300 bg-red-500/10 border-red-500/20',
}

export default function AiAssistantTab({ carId }: { carId: string }) {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [risk, setRisk] = useState<Risk | null>(null)
  const [output, setOutput] = useState('')
  const [laudoId, setLaudoId] = useState<string | null>(null)
  const [laudos, setLaudos] = useState<Laudo[]>([])
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([apiFetch('/ai/status'), apiFetch(`/cars/${carId}/risk-score`), apiFetch(`/cars/${carId}/ai/laudos`)]).then(([status, score, drafts]) => {
      setConfigured(Boolean(status.configured))
      if (score.score !== undefined) setRisk(score)
      if (Array.isArray(drafts.laudos)) setLaudos(drafts.laudos)
    })
  }, [carId])

  const runAction = async (action: 'summary' | 'recommendations' | 'laudo') => {
    setLoadingAction(action)
    const response = await apiFetch(`/cars/${carId}/ai/${action}`, { method: 'POST' })
    setLoadingAction(null)
    const text = response.summary || response.recommendations || response.laudo?.contentMd
    if (text) {
      setOutput(text)
      if (typeof response.laudo?.id === 'string') {
        setLaudoId(response.laudo.id)
        setLaudos((current) => [response.laudo, ...current.filter((draft) => draft.id !== response.laudo.id)])
      } else setLaudoId(null)
    }
    else toast.error(response.error || 'Não foi possível gerar a análise')
  }

  const saveLaudo = async () => {
    if (!laudoId || !output.trim()) return
    setLoadingAction('save-laudo')
    const response = await apiFetch(`/ai/laudos/${laudoId}`, { method: 'PATCH', body: JSON.stringify({ contentMd: output }) })
    setLoadingAction(null)
    if (response.laudo) {
      setLaudos((current) => current.map((draft) => draft.id === response.laudo.id ? response.laudo : draft))
      toast.success('Rascunho salvo')
    }
    else toast.error(response.error || 'Não foi possível salvar o laudo')
  }

  const sendQuestion = async (event: React.FormEvent) => {
    event.preventDefault()
    const message = question.trim()
    if (!message || loadingAction) return
    setQuestion('')
    setMessages((current) => [...current, { role: 'user', content: message }, { role: 'assistant', content: '' }])
    setLoadingAction('chat')
    const response = await apiStream('/ai/chat/stream', { method: 'POST', body: JSON.stringify({ scope: 'car', carId, threadId, message }) }, (event) => {
      if (event.type !== 'delta' || typeof event.content !== 'string') return
      setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, content: item.content + event.content } : item))
    })
    setLoadingAction(null)
    if (typeof response.threadId === 'string') {
      setThreadId(response.threadId)
    } else {
      setMessages((current) => current.slice(0, -1))
      toast.error(typeof response.error === 'string' ? response.error : 'Não foi possível responder')
    }
  }

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)]">
      <div className="space-y-5">
        <section className="glass-card p-5">
          <div className="flex items-center justify-between gap-3 mb-4">
            <h2 className="font-semibold">Assistente técnico</h2>
            {configured === false && <span className="text-xs text-amber-300">IA não configurada</span>}
          </div>
          {risk ? (
            <>
              <div className="flex items-center gap-3 mb-3">
                <span className={`rounded-md border px-2.5 py-1 text-sm font-semibold ${BAND_STYLE[risk.band] || 'text-slate-300 border-white/10'}`}>
                  Risco {risk.score}/100
                </span>
                <span className="text-sm capitalize text-slate-400">{risk.band}</span>
              </div>
              <p className="text-sm leading-6 text-slate-400 whitespace-pre-wrap">{risk.explanation}</p>
            </>
          ) : <p className="text-sm text-slate-500">Calculando score de risco...</p>}
        </section>

        <section className="glass-card p-5">
          <h2 className="font-semibold mb-3">Análises</h2>
          <div className="grid gap-2 sm:grid-cols-3">
            <button className="btn-primary text-sm px-3 py-2" disabled={loadingAction !== null || configured === false} onClick={() => runAction('summary')}>
              {loadingAction === 'summary' ? 'Gerando...' : 'Resumo'}
            </button>
            <button className="btn-primary text-sm px-3 py-2" disabled={loadingAction !== null || configured === false} onClick={() => runAction('recommendations')}>
              {loadingAction === 'recommendations' ? 'Gerando...' : 'Próximos passos'}
            </button>
            <button className="btn-primary text-sm px-3 py-2" disabled={loadingAction !== null || configured === false} onClick={() => runAction('laudo')}>
              {loadingAction === 'laudo' ? 'Gerando...' : 'Minuta de laudo'}
            </button>
          </div>
          {laudos.length > 0 && (
            <label className="mt-4 block text-sm text-slate-400">
              Rascunhos salvos
              <select className="input-field mt-1 py-2" value={laudoId || ''} onChange={(event) => {
                const draft = laudos.find((item) => item.id === event.target.value)
                if (draft) { setLaudoId(draft.id); setOutput(draft.contentMd) }
              }}>
                <option value="">Selecione um rascunho</option>
                {laudos.map((draft) => <option key={draft.id} value={draft.id}>{new Date(draft.updatedAt).toLocaleString('pt-BR')} - {draft.status}</option>)}
              </select>
            </label>
          )}
          {output && (laudoId ? (
            <div className="mt-4 space-y-2">
              <textarea className="input-field min-h-80 resize-y font-mono text-sm leading-6" value={output} onChange={(event) => setOutput(event.target.value)} disabled={loadingAction !== null} aria-label="Minuta de laudo editável" />
              <div className="flex justify-end">
                <button className="btn-primary px-3 py-2 text-sm" onClick={saveLaudo} disabled={loadingAction !== null || !output.trim()}>{loadingAction === 'save-laudo' ? 'Salvando...' : 'Salvar rascunho'}</button>
              </div>
            </div>
          ) : <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-white/5 bg-black/15 p-3 font-sans text-sm leading-6 text-slate-300">{output}</pre>)}
        </section>
      </div>

      <section className="glass-card flex min-h-[30rem] flex-col p-5">
        <h2 className="font-semibold mb-4">Conversa sobre este imóvel</h2>
        <div className="flex-1 space-y-3 overflow-y-auto pr-1">
          {messages.length === 0 && <p className="text-sm text-slate-500">Pergunte sobre alertas, tendência de NDVI, sobreposições ou autorizações registradas.</p>}
          {messages.map((message, index) => (
            <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-md px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${message.role === 'user' ? 'ml-auto bg-emerald-500/15 text-emerald-50' : 'bg-white/5 text-slate-300'}`}>
              {message.content}
            </div>
          ))}
          {loadingAction === 'chat' && <p className="text-sm text-slate-500">Analisando dados...</p>}
        </div>
        <form className="mt-4 flex gap-2" onSubmit={sendQuestion}>
          <input className="input-field min-w-0 py-2" value={question} onChange={(event) => setQuestion(event.target.value)} disabled={configured === false || loadingAction !== null} placeholder="Faça uma pergunta" maxLength={2000} />
          <button className="btn-primary shrink-0 px-4 py-2 text-sm" type="submit" disabled={configured === false || loadingAction !== null || !question.trim()}>Enviar</button>
        </form>
      </section>
    </div>
  )
}
