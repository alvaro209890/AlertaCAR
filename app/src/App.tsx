import { type ReactNode } from 'react'
import { Route, Switch, useLocation } from 'wouter'
import { AuthProvider, useAuth } from './lib/auth'
import LoginPage from './pages/LoginPage'
import RegisterPage from './pages/RegisterPage'
import DashboardPage from './pages/DashboardPage'
import CarDetailPage from './pages/CarDetailPage'

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
        <Route path="/dashboard/cars/:id">
          <ProtectedRoute><CarDetailPage /></ProtectedRoute>
        </Route>
        <Route path="/">
          <LoginPage />
        </Route>
      </Switch>
    </AuthProvider>
  )
}
