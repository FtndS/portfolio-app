/** Suite routing helpers — Stock (/app) · Trip (/trip) · Hub (/hub) */

export function readPath() {
  return window.location.pathname.replace(/\/+$/, '') || '/'
}

export function readNextApp() {
  const next = new URLSearchParams(window.location.search).get('next')
  if (next === 'stock' || next === 'trip' || next === 'hub') return next
  return null
}

export function pathForApp(app) {
  if (app === 'stock') return '/app'
  if (app === 'trip') return '/trip'
  return '/hub'
}

export function resolveLoggedInView(path) {
  if (path === '/admin') return 'admin'
  if (path === '/app' || path.startsWith('/app/')) return 'stock'
  if (path === '/trip' || path.startsWith('/trip/')) return 'trip'
  if (path === '/hub') return 'hub'
  if (path === '/') return 'hub-redirect'
  return 'hub-redirect'
}

export function readTripId(path) {
  const m = /^\/trip\/(\d+)$/.exec(path)
  if (!m) return null
  const id = Number(m[1])
  return Number.isFinite(id) ? id : null
}

export function resolveAuthPage(path, search = window.location.search) {
  if (new URLSearchParams(search).get('reset')) return 'reset'
  if (path === '/login') return 'login'
  if (path === '/register') return 'register'
  if (path === '/forgot') return 'forgot'
  return null
}

export function authPath(page, nextApp = null) {
  const base =
    page === 'login' ? '/login'
      : page === 'register' ? '/register'
        : page === 'forgot' ? '/forgot'
          : '/'
  if (!nextApp || base === '/') return base
  return `${base}?next=${encodeURIComponent(nextApp)}`
}
