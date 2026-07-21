import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { Route, Switch, useLocation } from 'wouter'

interface User { id: string; email: string; name: string; role: string }
interface AuthCtx { user: User | null; loading: boolean; login(e: string, p: string): Promise<boolean>; logout(): void }

const AuthContext = createContext<AuthCtx | null>(null)
const API = import.meta.env.VITE_API_URL || '/api'

function useAuth() { return useContext(AuthContext)! }

async function api(endpoint: string, options: RequestInit = {}) {
  const token = localStorage.getItem('alertacar_token')
  return fetch(`${API}${endpoint}`, {
    ...options,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...options.headers },
  }).then(r => r.json())
}

function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const token = localStorage.getItem('alertacar_token')
    if (token) {
      api('/auth/me').then(r => {
        if (r.user && r.user.role === 'admin') setUser(r.user)
        else { localStorage.removeItem('alertacar_token') }
      }).finally(() => setLoading(false))
    } else setLoading(false)
  }, [])

  const login = async (email: string, password: string) => {
    const r = await api('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    if (r.token && r.user?.role === 'admin') {
      localStorage.setItem('alertacar_token', r.token)
      setUser(r.user)
      return true
    }
    if (r.token && r.user?.role !== 'admin') return false
    return false
  }

  const logout = () => { localStorage.removeItem('alertacar_token'); setUser(null) }

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>
}

// Login
function LoginPage() {
  const { login } = useAuth()
  const [, setLocation] = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')

  const handle = async (e: React.FormEvent) => {
    e.preventDefault(); setError('')
    const ok = await login(email, password)
    if (ok) setLocation('/dashboard')
    else setError('Acesso restrito a administradores')
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass-card p-8 w-full max-w-sm">
        <h1 className="text-xl font-bold mb-1">🌿 AlertaCAR</h1>
        <p className="text-slate-400 text-sm mb-6">Painel Administrativo</p>
        <form onSubmit={handle} className="space-y-4">
          <div><input type="email" className="input-field" placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} required /></div>
          <div><input type="password" className="input-field" placeholder="Senha" value={password} onChange={e => setPassword(e.target.value)} required /></div>
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button className="btn-primary w-full">Entrar</button>
        </form>
      </div>
    </div>
  )
}

// Dashboard Admin
function DashboardPage() {
  const { user, logout } = useAuth()
  const [stats, setStats] = useState<any>(null)

  useEffect(() => {
    api('/admin/stats').then(setStats).catch(() => setStats({ error: true }))
  }, [])

  return (
    <div className="min-h-screen flex">
      {/* Sidebar */}
      <aside className="w-56 bg-slate-900/50 border-r border-white/5 p-4 flex flex-col">
        <h2 className="font-bold text-emerald-400 mb-8">🌿 AlertaCAR</h2>
        <nav className="space-y-1 flex-1">
          <a className="block px-3 py-2 rounded-lg bg-slate-800 text-white text-sm">📊 Dashboard</a>
          <a className="block px-3 py-2 rounded-lg text-slate-400 text-sm hover:bg-slate-800/50">💬 WhatsApp</a>
          <a className="block px-3 py-2 rounded-lg text-slate-400 text-sm hover:bg-slate-800/50">👥 Usuários</a>
          <a className="block px-3 py-2 rounded-lg text-slate-400 text-sm hover:bg-slate-800/50">🌿 CARs</a>
          <a className="block px-3 py-2 rounded-lg text-slate-400 text-sm hover:bg-slate-800/50">📨 Notificações</a>
          <a className="block px-3 py-2 rounded-lg text-slate-400 text-sm hover:bg-slate-800/50">⚙️ Configurações</a>
        </nav>
        <div className="border-t border-white/5 pt-4">
          <p className="text-sm text-slate-300">{user?.name}</p>
          <button onClick={logout} className="text-xs text-slate-500 hover:text-white mt-1">Sair</button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 p-8">
        <h1 className="text-2xl font-bold mb-6">Dashboard</h1>
        <div className="grid grid-cols-4 gap-4 mb-8">
          {[
            { label: 'Usuários', value: stats?.users ?? '—', icon: '👥' },
            { label: 'CARs Ativos', value: stats?.cars ?? '—', icon: '🌿' },
            { label: 'Alertas', value: stats?.alerts ?? '—', icon: '🔔' },
            { label: 'WhatsApp', value: stats?.whatsapp ?? '—', icon: '💬' },
          ].map(card => (
            <div key={card.label} className="glass-card p-5">
              <p className="text-3xl mb-1">{card.icon}</p>
              <p className="text-2xl font-bold">{card.value}</p>
              <p className="text-sm text-slate-400">{card.label}</p>
            </div>
          ))}
        </div>

        {/* Funcionalidades */}
        <div className="glass-card p-6">
          <h2 className="text-lg font-semibold mb-4">Status das Funcionalidades</h2>
          <ul className="space-y-2 text-sm">
            <li className="text-emerald-400">✅ Auth local (bcrypt + JWT) — Fase 1</li>
            <li className="text-emerald-400">✅ Login admin — Fase 1</li>
            <li className="text-emerald-400">✅ CRUD de CARs + WFS SEMA — Fase 2</li>
            <li className="text-emerald-400">✅ Monitoramento SCCON — Fase 3</li>
            <li className="text-slate-400">⏳ SEMA multicamada (embargos, infrações) — Fase 4</li>
            <li className="text-slate-400">⏳ WhatsApp Connect (QR Code) — Fase 5</li>
            <li className="text-slate-400">⏳ Deploy Cloudflare + Systemd — Fase 6</li>
          </ul>
        </div>
      </main>
    </div>
  )
}

export default function App() {
  return (
    <AuthProvider>
      <Switch>
        <Route path="/dashboard" component={DashboardPage} />
        <Route path="/" component={LoginPage} />
      </Switch>
    </AuthProvider>
  )
}
