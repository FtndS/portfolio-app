let warnedMissingKey = false

const OMISE_API_BASE = 'https://api.omise.co'

function getSecretKey() {
  return process.env.OMISE_SECRET_KEY?.trim() || ''
}

export function isOmiseConfigured() {
  return process.env.OMISE_ENABLED === 'true' && !!getSecretKey()
}

function authHeader() {
  const key = getSecretKey()
  return `Basic ${Buffer.from(`${key}:`).toString('base64')}`
}

async function parseOmiseResponse(res) {
  let data = null
  try {
    data = await res.json()
  } catch {
    data = null
  }

  if (res.ok) return data
  const msg = data?.message || data?.object || `Omise API error (${res.status})`
  throw new Error(msg)
}

async function request(path, method = 'GET', body) {
  if (!isOmiseConfigured()) {
    if (!warnedMissingKey) {
      warnedMissingKey = true
      console.warn('[omise] OMISE_ENABLED/OMISE_SECRET_KEY not configured')
    }
    throw new Error('Omise is not configured')
  }

  const res = await fetch(`${OMISE_API_BASE}${path}`, {
    method,
    headers: {
      Authorization: authHeader(),
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
  return parseOmiseResponse(res)
}

export function createOmiseSource(params) {
  return request('/sources', 'POST', params)
}

export function createOmiseCharge(params) {
  return request('/charges', 'POST', params)
}

export function getOmiseCharge(chargeId) {
  return request(`/charges/${encodeURIComponent(chargeId)}`)
}

export function createOmiseCustomer(params) {
  return request('/customers', 'POST', params)
}

export function updateOmiseCustomer(customerId, params) {
  return request(`/customers/${encodeURIComponent(customerId)}`, 'PATCH', params)
}

export function getOmiseCustomer(customerId) {
  return request(`/customers/${encodeURIComponent(customerId)}`)
}

export function createOmiseSchedule(params) {
  return request('/schedules', 'POST', params)
}

export function getOmiseSchedule(scheduleId) {
  return request(`/schedules/${encodeURIComponent(scheduleId)}`)
}

export function cancelOmiseSchedule(scheduleId) {
  return request(`/schedules/${encodeURIComponent(scheduleId)}`, 'DELETE')
}
