import { useState, useEffect } from 'react'
import { api } from './lib/api'
import { ThemeProvider } from './lib/theme'
import { PrivacyProvider } from './lib/privacy'
import Landing from './components/Landing'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import Dashboard from './components/dashboard/Dashboard'
import AdminPage from './components/admin/AdminPage'
import './dashboard.css'

function readPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(() => !!localStorage.getItem('token'))
  const [path, setPath] = useState(readPath)
  const [page, setPage] = useState(() => {
    if (new URLSearchParams(window.location.search).get('reset')) return 'reset'
    return 'landing'
  })
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '')

  const navigate = (nextPath) => {
    const normalized = nextPath.replace(/\/+$/, '') || '/'
    window.history.pushState({}, '', normalized === '/' ? '/' : nextPath)
    setPath(normalized)
  }

  const goHome = () => {
    setPage('landing')
    navigate('/')
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setPage('landing')
    navigate('/')
  }

  const clearResetUrl = () => { if (window.location.search) window.history.replaceState({}, '', '/') }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) { setAuthChecking(false); return }
    api.get('/auth/me').then((r) => {
      if (r.id) {
        setUser(r)
        localStorage.setItem('user', JSON.stringify(r))
      } else {
        localStorage.removeItem('token')
        localStorage.removeItem('user')
      }
      setAuthChecking(false)
    }).catch(() => {
      localStorage.removeItem('token')
      localStorage.removeItem('user')
      setAuthChecking(false)
    })
  }, [])

  useEffect(() => {
    const onPop = () => setPath(readPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const onLogout = () => { setUser(null); setPage('landing'); navigate('/') }
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  useEffect(() => {
    if (user && path === '/admin' && user.role !== 'admin') {
      navigate('/')
    }
  }, [user, path])

  if (authChecking) return (
    <ThemeProvider>
      <div className="auth-wrap"><div className="auth-card" style={{ textAlign: 'center', width: '320px', maxWidth: '100%' }}>
        <p className="dash-text-muted" style={{ fontSize: '14px' }}>กำลังตรวจสอบบัญชี...</p>
      </div></div>
    </ThemeProvider>
  )

  if (user) {
    if (path === '/admin' && user.role === 'admin') {
      return (
        <ThemeProvider>
          <AdminPage user={user} onBack={() => navigate('/')} onLogout={logout} />
        </ThemeProvider>
      )
    }

    return (
      <ThemeProvider>
        <PrivacyProvider>
          <Dashboard
            user={user}
            onLogout={logout}
            onUserUpdate={(u) => { setUser(u); localStorage.setItem('user', JSON.stringify(u)) }}
            onOpenAdmin={user.role === 'admin' ? () => navigate('/admin') : undefined}
          />
        </PrivacyProvider>
      </ThemeProvider>
    )
  }

  if (page === 'register') return <ThemeProvider><Register onLogin={setUser} onGoLogin={() => setPage('login')} onGoHome={goHome} /></ThemeProvider>
  if (page === 'login') return <ThemeProvider><Login onLogin={setUser} onGoRegister={() => setPage('register')} onGoForgot={() => setPage('forgot')} onGoHome={goHome} /></ThemeProvider>
  if (page === 'forgot') return <ThemeProvider><ForgotPassword onGoLogin={() => setPage('login')} onGoHome={goHome} /></ThemeProvider>
  if (page === 'reset') return <ThemeProvider><ResetPassword token={resetToken} onGoLogin={() => { clearResetUrl(); setPage('login') }} onGoHome={() => { clearResetUrl(); goHome() }} /></ThemeProvider>
  return <ThemeProvider><Landing onLogin={() => setPage('login')} onRegister={() => setPage('register')} /></ThemeProvider>
}
