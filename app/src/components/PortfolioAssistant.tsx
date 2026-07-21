import { useEffect, useState, type FormEvent } from 'react'
import { apiFetch, apiStream } from '../lib/api'

type Message = { role: 'user' | 'assistant'; content: string }

export default function PortfolioAssistant() {
  const [configured, setConfigured] = useState<boolean | null>(null)
  const [digest, setDigest] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const [question, setQuestion] = useState('')
  const [threadId, setThreadId] = useState<string | null>(null)
  const [loading, setLoading] = useState<'digest' | 'chat' | null>(null)
  const [error, setError] = useState('')

  useEffect(() => { apiFetch('/ai/status').then((status) => setConfigured(Boolean(status.configured))) }, [])

  const generateDigest = async () => {
    setLoading('digest')
    setError('')
    const response = await apiFetch('/ai/portfolio-digest', { method: 'POST' })
    setLoading(null)
    if (response.digest) setDigest(response.digest)
    else setError(response.error || 'Não foi possível gerar o digest')
  }

  const ask = async (event: FormEvent) => {
    event.preventDefault()
    const message = question.trim()
    if (!message || loading) return
    setQuestion('')
    setError('')
    setMessages((current) => [...current, { role: 'user', content: message }, { role: 'assistant', content: '' }])
    setLoading('chat')
    const result = await apiStream('/ai/chat/stream', { method: 'POST', body: JSON.stringify({ scope: 'portfolio', threadId, message }) }, (streamEvent) => {
      if (streamEvent.type !== 'delta' || typeof streamEvent.content !== 'string') return
      setMessages((current) => current.map((item, index) => index === current.length - 1 ? { ...item, content: item.content + streamEvent.content } : item))
    })
    setLoading(null)
    if (typeof result.threadId === 'string') setThreadId(result.threadId)
    else {
      setMessages((current) => current.slice(0, -1))
      setError(typeof result.error === 'string' ? result.error : 'Não foi possível responder')
    }
  }

  return (
    <section className="glass-card mb-6 p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-semibold">Assistente da carteira</h2>
          <p className="mt-1 text-sm text-slate-400">Priorize imóveis e acompanhe pendências em um só lugar.</p>
        </div>
        <button className="btn-primary px-3 py-2 text-sm" onClick={generateDigest} disabled={configured === false || loading !== null}>
          {loading === 'digest' ? 'Gerando...' : 'Gerar digest'}
        </button>
      </div>
      {configured === false && <p className="mt-3 text-sm text-amber-300">IA não configurada neste ambiente.</p>}
      {error && <p className="mt-3 text-sm text-red-300">{error}</p>}
      {digest && <pre className="mt-4 max-h-64 overflow-auto whitespace-pre-wrap rounded-md border border-white/5 bg-black/15 p-3 font-sans text-sm leading-6 text-slate-300">{digest}</pre>}
      <div className="mt-4 space-y-3">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`max-w-[90%] rounded-md px-3 py-2 text-sm leading-6 whitespace-pre-wrap ${message.role === 'user' ? 'ml-auto bg-emerald-500/15 text-emerald-50' : 'bg-white/5 text-slate-300'}`}>
            {message.content || (loading === 'chat' ? 'Analisando carteira...' : '')}
          </div>
        ))}
      </div>
      <form className="mt-4 flex gap-2" onSubmit={ask}>
        <input className="input-field min-w-0 py-2" value={question} onChange={(event) => setQuestion(event.target.value)} disabled={configured === false || loading !== null} placeholder="Pergunte sobre sua carteira" maxLength={2000} />
        <button className="btn-primary shrink-0 px-4 py-2 text-sm" type="submit" disabled={configured === false || loading !== null || !question.trim()}>Enviar</button>
      </form>
    </section>
  )
}
