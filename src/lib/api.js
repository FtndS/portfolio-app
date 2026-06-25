const BASE = '/api'

const headers = () => ({
  'Content-Type': 'application/json',
  ...(localStorage.getItem('token')
    ? { Authorization: `Bearer ${localStorage.getItem('token')}` }
    : {}),
})

export const api = {
  post: (path, body) =>
    fetch(`${BASE}${path}`, { method: 'POST', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  get: (path) =>
    fetch(`${BASE}${path}`, { headers: headers() }).then(r => r.json()),
  put: (path, body) =>
    fetch(`${BASE}${path}`, { method: 'PUT', headers: headers(), body: JSON.stringify(body) }).then(r => r.json()),
  delete: (path) =>
    fetch(`${BASE}${path}`, { method: 'DELETE', headers: headers() }).then(r => r.json()),
}
