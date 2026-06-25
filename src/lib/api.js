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

export const api = {
  post: (path, body) =>
    fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  get: (path, params) =>
    fetch(withQuery(`${BASE}${path}`, params), { headers: headers() }).then(r => r.json()),
  put: (path, body) =>
    fetch(`${BASE}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  delete: (path) =>
    fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() }).then(r => r.json()),
  fetch: (path, params) =>
    fetch(withQuery(`${BASE}${path}`, params), { headers: headers() }),
}
