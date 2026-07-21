import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { Route, Switch, useLocation } from 'wouter'

// --------------- Types ---------------
interface User {
  id: string; email: string; name: string; whatsapp_number: string; role: string;
}

interface AuthContextType {
  user: User | null
  token: string | null
  loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name: string, whatsapp: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)
const API = import.meta.env.VITE_API_URL || '/api'

function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

// --------------- API helpers ---------------
async function api(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('alertacar_token')
  const res = await fetch(`${API}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  })
  return res.json()
}

// --------------- Auth Provider ---------------
function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [token, setToken] = useState<string | null>(localStorage.getItem('alertacar_token'))
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (token) {
      api('/auth/me').then(r => {
        if (r.user) setUser(r.user)
        else { localStorage.removeItem('alertacar_token'); setToken(null) }
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (r.token) {
      localStorage.setItem('alertacar_token', r.token)
      setToken(r.token)
      setUser(r.user)
      return true
    }
    return false
  }

  const register = async (email: string, password: string, name: string, whatsapp: string) => {
    const r = await api('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, whatsapp }) })
    if (r.token) {
      localStorage.setItem('alertacar_token', r.token)
      setToken(r.token)
      setUser(r.user)
      return true
    }
    return false
  }

  const logout = () => {
    localStorage.removeItem('alertacar_token')
    setToken(null)
    setUser(null)
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

// --------------- Login Page ---------------
function LoginPage() {
  const { login } = useAuth()
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
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

// --------------- Register Page ---------------
function RegisterPage() {
  const { register } = useAuth()
  const [, setLocation] = useLocation()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [whatsapp, setWhatsapp] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
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

// --------------- Dashboard (placeholder) ---------------
function DashboardPage() {
  const { user, logout } = useAuth()
  return (
    <div className="min-h-screen p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-bold">👋 Bem-vindo, {user?.name}</h1>
          <button onClick={logout} className="text-sm text-slate-400 hover:text-white transition-colors">
            Sair
          </button>
        </div>
        <div className="glass-card p-12 text-center">
          <p className="text-4xl mb-4">🌿</p>
          <h2 className="text-lg font-semibold mb-2">Você ainda não monitora nenhum CAR</h2>
          <p className="text-slate-400 mb-6">Adicione seu primeiro CAR para começar a receber alertas</p>
          <button className="btn-primary opacity-50 cursor-not-allowed" disabled>
            Adicionar CAR (em breve)
          </button>
        </div>
      </div>
    </div>
  )
}

// --------------- App ---------------
function ProtectedRoute({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth()
  const [, setLocation] = useLocation()

  if (loading) return <div className="min-h-screen flex items-center justify-center"><p className="text-slate-400">Carregando...</p></div>
  if (!user) { setLocation('/login'); return null }
  return <>{children}</>
}

export default function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/login" component={LoginPage} />
        <Route path="/register" component={RegisterPage} />
        <Route path="/dashboard">
          <ProtectedRoute><DashboardPage /></ProtectedRoute>
        </Route>
        <Route path="/">
          <LoginPage />
        </Route>
      </Switch>
    </AuthProvider>
  )
}
