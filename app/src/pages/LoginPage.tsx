import { useState, type FormEvent } from 'react'
import { useLocation } from 'wouter'
import { useAuth } from '../lib/auth'

export default function LoginPage() {
  const { login } = useAuth()
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    setSubmitting(true)
    const ok = await login(email, password)
    setSubmitting(false)
    if (ok) setLocation('/dashboard')
    else setError('Email ou senha inválidos')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 w-full max-w-md">
        <h1 className="text-2xl font-bold mb-2">🌿 AlertaCAR</h1>
        <p className="text-slate-400 mb-6">Monitore seus CARs sem sair do WhatsApp</p>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm text-slate-400 block mb-1">Email</label>
            <input type="email" className="input-field" value={email} onChange={e => setEmail(e.target.value)} required />
          </div>
          <div>
            <label className="text-sm text-slate-400 block mb-1">Senha</label>
            <input type="password" className="input-field" value={password} onChange={e => setPassword(e.target.value)} required minLength={6} />
          </div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button type="submit" className="btn-primary w-full" disabled={submitting}>
            {submitting ? 'Entrando...' : 'Entrar'}
          </button>
          <p className="text-center text-sm text-slate-500">
            Não tem conta?{' '}
            <span className="text-emerald-400 cursor-pointer hover:underline" onClick={() => setLocation('/register')}>
              Cadastre-se
            </span>
          </p>
        </form>
      </div>
    </div>
  )
}
