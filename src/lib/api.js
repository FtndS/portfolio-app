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
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (res.status === 401 && path !== '/auth/login' && path !== '/auth/register') {
    clearAuth()
  }

  if (!res.ok) {
    const err =
      data && typeof data === 'object' && !Array.isArray(data)
        ? data
        : { error: res.statusText || 'Request failed' }
    return { ...err, ok: false, status: res.status }
  }

  // Keep backward compatibility: return raw JSON (arrays included)
  return data
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
  patch: (path, body) => request('PATCH', path, body),
  delete: (path, body) => request('DELETE', path, body),
  fetch: (path, params) =>
    fetch(withQuery(`${BASE}${path}`, params), { headers: headers() }),
}
