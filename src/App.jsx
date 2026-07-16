import { useState, useEffect } from 'react'
import { api } from './lib/api'
import { ThemeProvider } from './lib/theme'
import { PrivacyProvider } from './lib/privacy'
import {
  authPath,
  pathForApp,
  readNextApp,
  readPath,
  resolveAuthPage,
  resolveLoggedInView,
} from './lib/appRoutes'
import Landing from './components/Landing'
import AppHub from './components/AppHub'
import TripApp from './components/trip/TripApp'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import Dashboard from './components/dashboard/Dashboard'
import AdminPage from './components/admin/AdminPage'
import './dashboard.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(() => !!localStorage.getItem('token'))
  const [path, setPath] = useState(readPath)
  const [page, setPage] = useState(() => resolveAuthPage(readPath(), window.location.search) || 'landing')
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '')
  const [pendingNext, setPendingNext] = useState(() => readNextApp())

  const navigate = (nextPath) => {
    const normalized = (nextPath.split('?')[0] || '/').replace(/\/+$/, '') || '/'
    const full = nextPath.startsWith('/') ? nextPath : `/${nextPath}`
    window.history.pushState({}, '', normalized === '/' && !full.includes('?') ? '/' : full)
    setPath(normalized)
  }

  const goHome = () => {
    setPage('landing')
    setPendingNext(null)
    navigate('/')
  }

  const openAuth = (authPage, nextApp = null) => {
    if (nextApp) setPendingNext(nextApp)
    setPage(authPage)
    navigate(authPath(authPage, nextApp))
  }

  const afterAuth = (u, nextOverride = null) => {
    setUser(u)
    localStorage.setItem('user', JSON.stringify(u))
    const next = nextOverride || pendingNext || readNextApp() || 'hub'
    setPendingNext(null)
    setPage('landing')
    navigate(pathForApp(next === 'stock' || next === 'trip' ? next : 'hub'))
  }

  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setPage('landing')
    setPendingNext(null)
    navigate('/')
  }

  const clearResetUrl = () => {
    if (window.location.search) window.history.replaceState({}, '', path || '/')
  }

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      setAuthChecking(false)
      return
    }
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
    const onPop = () => {
      const p = readPath()
      setPath(p)
      const auth = resolveAuthPage(p, window.location.search)
      if (auth) setPage(auth)
      else if (!localStorage.getItem('token')) setPage('landing')
      setPendingNext(readNextApp())
    }
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  useEffect(() => {
    const onLogout = () => {
      setUser(null)
      setPage('landing')
      setPendingNext(null)
      navigate('/')
    }
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  useEffect(() => {
    if (!user || authChecking) return
    const view = resolveLoggedInView(path)
    if (view === 'hub-redirect') navigate('/hub')
    if (path === '/admin' && user.role !== 'admin') navigate('/hub')
  }, [user, path, authChecking])

  useEffect(() => {
    if (user || authChecking) return
    if (path === '/app' || path.startsWith('/app/')) {
      openAuth('login', 'stock')
      return
    }
    if (path === '/trip' || path.startsWith('/trip/')) {
      openAuth('login', 'trip')
      return
    }
    if (path === '/hub') {
      openAuth('login', 'hub')
    }
  }, [user, path, authChecking])

  if (authChecking) {
    return (
      <ThemeProvider>
        <div className="auth-wrap">
          <div className="auth-card" style={{ textAlign: 'center', width: '320px', maxWidth: '100%' }}>
            <p className="dash-text-muted" style={{ fontSize: '14px' }}>กำลังตรวจสอบบัญชี...</p>
          </div>
        </div>
      </ThemeProvider>
    )
  }

  if (user) {
    const view = resolveLoggedInView(path)

    if (view === 'admin' && user.role === 'admin') {
      return (
        <ThemeProvider>
          <AdminPage user={user} onBack={() => navigate('/hub')} onLogout={logout} />
        </ThemeProvider>
      )
    }

    if (view === 'trip') {
      return (
        <ThemeProvider>
          <TripApp
            user={user}
            path={path}
            navigate={navigate}
            onBackHub={() => navigate('/hub')}
            onOpenStock={() => navigate('/app')}
            onLogout={logout}
          />
        </ThemeProvider>
      )
    }

    if (view === 'hub' || view === 'hub-redirect') {
      return (
        <ThemeProvider>
          <AppHub
            user={user}
            onOpenStock={() => navigate('/app')}
            onOpenTrip={() => navigate('/trip')}
            onOpenSubscription={() => navigate('/app?tab=subscription')}
            onLogout={logout}
            onOpenAdmin={user.role === 'admin' ? () => navigate('/admin') : undefined}
          />
        </ThemeProvider>
      )
    }

    return (
      <ThemeProvider>
        <PrivacyProvider>
          <Dashboard
            user={user}
            onLogout={logout}
            onUserUpdate={(u) => {
              setUser(u)
              localStorage.setItem('user', JSON.stringify(u))
            }}
            onOpenAdmin={user.role === 'admin' ? () => navigate('/admin') : undefined}
            onGoHub={() => navigate('/hub')}
          />
        </PrivacyProvider>
      </ThemeProvider>
    )
  }

  if (page === 'register') {
    return (
      <ThemeProvider>
        <Register
          onLogin={(u) => afterAuth(u)}
          onGoLogin={() => openAuth('login', pendingNext)}
          onGoHome={goHome}
        />
      </ThemeProvider>
    )
  }
  if (page === 'login') {
    return (
      <ThemeProvider>
        <Login
          onLogin={(u) => afterAuth(u)}
          onGoRegister={() => openAuth('register', pendingNext)}
          onGoForgot={() => openAuth('forgot', pendingNext)}
          onGoHome={goHome}
        />
      </ThemeProvider>
    )
  }
  if (page === 'forgot') {
    return (
      <ThemeProvider>
        <ForgotPassword onGoLogin={() => openAuth('login', pendingNext)} onGoHome={goHome} />
      </ThemeProvider>
    )
  }
  if (page === 'reset') {
    return (
      <ThemeProvider>
        <ResetPassword
          token={resetToken}
          onGoLogin={() => {
            clearResetUrl()
            openAuth('login')
          }}
          onGoHome={() => {
            clearResetUrl()
            goHome()
          }}
        />
      </ThemeProvider>
    )
  }

  return (
    <ThemeProvider>
      <Landing
        onLogin={(next) => openAuth('login', next || null)}
        onRegister={(next) => openAuth('register', next || null)}
        onChooseStock={() => openAuth('login', 'stock')}
        onChooseTrip={() => openAuth('login', 'trip')}
      />
    </ThemeProvider>
  )
}
