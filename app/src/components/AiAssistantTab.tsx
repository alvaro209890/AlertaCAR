import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { apiFetch } from '../lib/api'

type ChatMessage = { role: 'user' | 'assistant'; content: string }
type Risk = { score: number; band: string; explanation: string; cached: boolean }

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
  const [loadingAction, setLoadingAction] = useState<string | null>(null)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [question, setQuestion] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)

  useEffect(() => {
    Promise.all([apiFetch('/ai/status'), apiFetch(`/cars/${carId}/risk-score`)]).then(([status, score]) => {
      setConfigured(Boolean(status.configured))
      if (score.score !== undefined) setRisk(score)
    })
  }, [carId])

  const runAction = async (action: 'summary' | 'recommendations' | 'laudo') => {
    setLoadingAction(action)
    const response = await apiFetch(`/cars/${carId}/ai/${action}`, { method: 'POST' })
    setLoadingAction(null)
    const text = response.summary || response.recommendations || response.laudo?.contentMd
    if (text) setOutput(text)
    else toast.error(response.error || 'Não foi possível gerar a análise')
  }

  const sendQuestion = async (event: React.FormEvent) => {
    event.preventDefault()
    const message = question.trim()
    if (!message || loadingAction) return
    setQuestion('')
    setMessages((current) => [...current, { role: 'user', content: message }])
    setLoadingAction('chat')
    const response = await apiFetch('/ai/chat', { method: 'POST', body: JSON.stringify({ scope: 'car', carId, threadId, message }) })
    setLoadingAction(null)
    if (response.message?.content) {
      setThreadId(response.threadId)
      setMessages((current) => [...current, response.message])
    } else {
      toast.error(response.error || 'Não foi possível responder')
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
          {output && <pre className="mt-4 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-white/5 bg-black/15 p-3 font-sans text-sm leading-6 text-slate-300">{output}</pre>}
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
