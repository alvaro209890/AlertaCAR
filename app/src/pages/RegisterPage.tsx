import { useState, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '../lib/auth'

export default function RegisterPage() {
  const { register } = useAuth()
  const [, setLocation] = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (password.length < 6) { setError('Senha deve ter no mínimo 6 caracteres'); return }
    if (!whatsapp.startsWith('+')) { setError('WhatsApp deve começar com +55'); return }
    setSubmitting(true)
    const ok = await register(email, password, name, whatsapp)
    setSubmitting(false)
    if (ok) setLocation('/dashboard')
    else setError('Erro ao cadastrar. Email já existe?')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">Criar conta</h1>
        <p className="text-slate-400 mb-6">Comece a monitorar seus CARs</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Nome</label>
            <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Email</label>
            <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Senha</label>
            <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">WhatsApp (+55...)</label>
            <input type="tel" className="input-field" value={whatsapp} onChange={e => setWhatsapp(e.target.value)} placeholder="+556****9999" required />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Criando conta...' : 'Criar conta'}
          </button>
          <p className="text-center text-sm text-slate-500">
            Já tem conta?{' '}
            <span className="text-emerald-400 cursor-pointer hover:underline" onClick={() => setLocation('/login')}>
              Entrar
            </span>
          </p>
        </form>
      </div>
    </div>
  )
}
