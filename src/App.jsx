import { useState, useEffect } from 'react'
import { api } from './lib/api'
import Landing from './components/Landing'
import Login from './components/auth/Login'
import Register from './components/auth/Register'
import ForgotPassword from './components/auth/ForgotPassword'
import ResetPassword from './components/auth/ResetPassword'
import Dashboard from './components/dashboard/Dashboard'
import './dashboard.css'

export default function App() {
  const [user, setUser] = useState(null)
  const [authChecking, setAuthChecking] = useState(() => !!localStorage.getItem('token'))
  const [page, setPage] = useState(() => {
    if (new URLSearchParams(window.location.search).get('reset')) return 'reset'
    return 'landing'
  })
  const [resetToken] = useState(() => new URLSearchParams(window.location.search).get('reset') || '')

  const goHome = () => setPage('landing')
  const logout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
    setPage('landing')
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
    const onLogout = () => { setUser(null); setPage('landing') }
    window.addEventListener('auth:logout', onLogout)
    return () => window.removeEventListener('auth:logout', onLogout)
  }, [])

  if (authChecking) return (
    <div className="auth-wrap"><div className="auth-card" style={{ textAlign: 'center', width: '320px', maxWidth: '100%' }}>
      <p style={{ color: '#888', fontSize: '14px' }}>กำลังตรวจสอบบัญชี...</p>
    </div></div>
  )

  if (user) return <Dashboard user={user} onLogout={logout} onUserUpdate={(u) => { setUser(u); localStorage.setItem('user', JSON.stringify(u)) }} />
  if (page === 'register') return <Register onLogin={setUser} onGoLogin={() => setPage('login')} onGoHome={goHome} />
  if (page === 'login') return <Login onLogin={setUser} onGoRegister={() => setPage('register')} onGoForgot={() => setPage('forgot')} onGoHome={goHome} />
  if (page === 'forgot') return <ForgotPassword onGoLogin={() => setPage('login')} onGoHome={goHome} />
  if (page === 'reset') return <ResetPassword token={resetToken} onGoLogin={() => { clearResetUrl(); setPage('login') }} onGoHome={() => { clearResetUrl(); goHome() }} />
  return <Landing onLogin={() => setPage('login')} onRegister={() => setPage('register')} />
}
