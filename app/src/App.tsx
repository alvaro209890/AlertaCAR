import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { Route, Switch, useLocation } from 'wouter'

// --------------- Types ---------------
interface User {
  id: string; email: string; name: string; whatsapp_number: string; role: string;
}

interface Car {
  id: string; carNumber: string; carNumberWfs: string | null
  polygon: any; areaHa: number | null; municipality: string | null
  alertCount: number; unreadAlerts: number
  lastPolygonFetch: string | null; createdAt: string
}

interface AuthContextType {
  user: User | null; token: string | null; loading: boolean
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
async function apiFetch(endpoint: string, options: RequestInit = {}) {
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
      apiFetch('/auth/me').then(r => {
        if (r.user) setUser(r.user)
        else { localStorage.removeItem('alertacar_token'); setToken(null) }
      }).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [token])

  const login = async (email: string, password: string) => {
    const r = await apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (r.token) {
      localStorage.setItem('alertacar_token', r.token)
      setToken(r.token)
      setUser(r.user)
      return true
    }
    return false
  }

  const register = async (email: string, password: string, name: string, whatsapp: string) => {
    const r = await apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, name, whatsapp }) })
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

// --------------- Dashboard ---------------
function DashboardPage() {
  const { user, logout } = useAuth()
  const [cars, setCars] = useState<Car[]>([])
  const [loading, setLoading] = useState(true)
  const [showAdd, setShowAdd] = useState(false)
  const [carInput, setCarInput] = useState('')
  const [adding, setAdding] = useState(false)
  const [addMsg, setAddMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null)
  const [deleting, setDeleting] = useState<string | null>(null)

  const loadCars = () => {
    apiFetch('/cars').then(r => {
      if (r.cars) setCars(r.cars)
    }).finally(() => setLoading(false))
  }

  useEffect(() => { loadCars() }, [])

  const handleAdd = async (e: React.FormEvent) => {
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

  const totalArea = cars.reduce((sum, c) => sum + (c.areaHa || 0), 0)
  const totalAlerts = cars.reduce((sum, c) => sum + c.alertCount, 0)

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
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

        {/* Stats Cards */}
        {cars.length > 0 && (
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
        )}

        {/* Add Message */}
        {addMsg && (
          <div className={`mb-4 p-3 rounded-lg text-sm ${
            addMsg.type === 'ok' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
            'bg-red-500/10 text-red-400 border border-red-500/20'
          }`}>
            {addMsg.type === 'ok' ? '✅ ' : '❌ '}{addMsg.text}
          </div>
        )}

        {/* Add CAR Form */}
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

        {/* CARs List */}
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
              <div key={car.id} className="glass-card p-5 hover:bg-slate-800/30 transition-colors group">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h3 className="font-semibold text-lg">{car.carNumber}</h3>
                      {car.carNumberWfs && car.carNumberWfs !== car.carNumber && (
                        <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded">{car.carNumberWfs}</span>
                      )}
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
                  </div>
                  <button
                    onClick={() => handleDelete(car.id)}
                    disabled={deleting === car.id}
                    className="text-slate-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100 ml-3 p-1"
                    title="Remover"
                  >
                    {deleting === car.id ? '⏳' : '✕'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
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
