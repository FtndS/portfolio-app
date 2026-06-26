const BASE = '/api'

const headers = () => ({
  'Content-Type': 'application/json',
  ...(localStorage.getItem('token')
    ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
    : {}),
})

const withQuery = (path, params) => {
  if (!params) return path
  const qs = new URLSearchParams(
    Object.entries(params).filter(([, v]) => v != null && v !== '')
  ).toString()
  return qs ? `${path}?${qs}` : path
}

function clearAuth() {
  localStorage.removeItem('token')
  localStorage.removeItem('user')
  window.dispatchEvent(new Event('auth:logout'))
}

async function parseResponse(res, path) {
  let data = {}
  try {
    data = await res.json()
  } catch {
    data = {}
  }
  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
    clearAuth()
  }
  return { ...data, ok: res.ok, status: res.status }
}

async function request(method, path, body, params) {
  const res = await fetch(withQuery(`${BASE}${path}`, params), {
    method,
    headers: headers(),
    ...(body != null ? { body: JSON.stringify(body) } : {}),
  })
  return parseResponse(res, path)
}

export const api = {
  post: (path, body) => request('POST', path, body),
  get: (path, params) => request('GET', path, null, params),
  put: (path, body) => request('PUT', path, body),
  delete: (path) => request('DELETE', path),
  fetch: (path, params) =>
    fetch(withQuery(`${BASE}${path}`, params), { headers: headers() }),
}
