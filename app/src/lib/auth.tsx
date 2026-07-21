import { useState, useEffect, createContext, useContext, type ReactNode } from 'react'
import { apiFetch } from './api'

export interface User {
  id: string; email: string; name: string; whatsapp_number: string; role: string;
}

interface AuthContextType {
  user: User | null; token: string | null; loading: boolean
  login: (email: string, password: string) => Promise<boolean>
  register: (email: string, password: string, name: string, whatsapp: string) => Promise<boolean>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be inside AuthProvider')
  return ctx
}

export function AuthProvider({ children }: { children: ReactNode }) {
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
