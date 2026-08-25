/**
 * Google Flights quotes via SerpAPI (near-live prices for display; booking stays on partner sites).
 * Env: SERPAPI_API_KEY
 */

import { extractIataToken } from './flightInput.js'

const CACHE_TTL_MS = 45 * 60 * 1000
const cache = new Map()

export function isSerpFlightsConfigured() {
  return Boolean(String(process.env.SERPAPI_API_KEY || '').trim())
}

export function iataFromEndpoint(value) {
  if (!value) return null
  if (typeof value === 'object') {
    const code = String(value.code || value.query || '').trim().toUpperCase()
    if (/^[A-Z]{3}$/.test(code)) return code
    return extractIataToken(value.label || value.query || value.code || '')
  }
  const s = String(value).trim().toUpperCase()
  if (/^[A-Z]{3}$/.test(s)) return s
  return extractIataToken(s)
}

function cacheKey(params) {
  return [
    params.origin,
    params.destination,
    params.outboundDate,
    params.returnDate || '',
    params.adults || 1,
    params.currency || 'THB',
    params.cabin || 'economy',
  ].join('|')
}

function travelClassParam(cabin) {
  const c = String(cabin || 'economy').toLowerCase()
  // SerpAPI: 1 Economy, 2 Premium economy, 3 Business, 4 First
  if (c.includes('premium')) return '2'
  if (c.includes('business') || c.includes('ธุรกิจ')) return '3'
  if (c.includes('first') || c.includes('เฟิร์ส')) return '4'
  return '1'
}

function isoDateOnly(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10)
  }
  const s = String(value).trim()
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  const d = new Date(s)
  if (!Number.isNaN(d.getTime()) && /^\d{4}/.test(s)) return d.toISOString().slice(0, 10)
  return ''
}

function normalizeOffer(row, currency) {
  if (!row || row.price == null) return null
  const price = Number(row.price)
  if (!Number.isFinite(price) || price <= 0) return null
  const flights = Array.isArray(row.flights) ? row.flights : []
  const first = flights[0] || {}
  const last = flights[flights.length - 1] || first
  const airline = first.airline || first.airline_name || null
  const flightNumber = [first.airline, first.flight_number].filter(Boolean).join('') || null
  return {
    price,
    currency: String(currency || 'THB').toUpperCase(),
    totalDurationMinutes: row.total_duration != null ? Number(row.total_duration) : null,
    stops: Math.max(0, flights.length - 1),
    airline,
    flightNumber,
    departTime: first.departure_airport?.time || null,
    arriveTime: last.arrival_airport?.time || null,
    bookingToken: row.booking_token || null,
    source: 'google_flights',
    provider: 'serpapi',
  }
}

export function pickBestFlightOffers(payload, currency = 'THB', { limit = 5 } = {}) {
  const buckets = [
    ...(Array.isArray(payload?.best_flights) ? payload.best_flights : []),
    ...(Array.isArray(payload?.other_flights) ? payload.other_flights : []),
  ]
  const offers = []
  for (const row of buckets) {
    const offer = normalizeOffer(row, currency)
    if (offer) offers.push(offer)
  }
  offers.sort((a, b) => a.price - b.price)
  const lowest = offers[0] || null
  const insightsLowest = Number(payload?.price_insights?.lowest_price)
  return {
    lowest:
      Number.isFinite(insightsLowest) && insightsLowest > 0
        ? { ...(lowest || {}), price: Math.min(lowest?.price ?? insightsLowest, insightsLowest), currency }
        : lowest,
    offers: offers.slice(0, limit),
    priceInsights: payload?.price_insights || null,
  }
}

export function buildQuoteFromFlightLeg(leg, trip = {}) {
  const origin = iataFromEndpoint(leg?.origin) || iataFromEndpoint(leg?.originLabel)
  const destination = iataFromEndpoint(leg?.destination) || iataFromEndpoint(leg?.destinationLabel)
  const outboundDate = isoDateOnly(leg?.departDate || trip.start_date)
  const returnDate =
    leg?.tripType === 'roundtrip' ? isoDateOnly(leg?.returnDate || trip.end_date) || null : null
  const adults = Number(leg?.passengers) > 0 ? Number(leg.passengers) : 1
  const cabin = leg?.cabin || 'economy'
  if (!origin || !destination || !/^\d{4}-\d{2}-\d{2}$/.test(outboundDate)) {
    return { error: 'ขาบินยังไม่ครบต้นทาง ปลายทาง หรือวันเดินทาง (ต้องเป็นรหัสสนามบิน 3 ตัว เช่น BKK, NRT)' }
  }
  return {
    origin,
    destination,
    outboundDate,
    returnDate: returnDate && /^\d{4}-\d{2}-\d{2}$/.test(returnDate) ? returnDate : null,
    adults,
    cabin,
    currency: 'THB',
  }
}

export async function fetchSerpFlightQuotes(params, { fetchImpl = fetch } = {}) {
  if (!isSerpFlightsConfigured()) {
    return { error: 'ยังไม่ได้ตั้งค่า SERPAPI_API_KEY', code: 'SERPAPI_NOT_CONFIGURED' }
  }

  const key = cacheKey(params)
  const hit = cache.get(key)
  if (hit && hit.expiresAt > Date.now()) {
    return { ...hit.payload, cached: true }
  }

  const qs = new URLSearchParams({
    engine: 'google_flights',
    api_key: String(process.env.SERPAPI_API_KEY).trim(),
    departure_id: params.origin,
    arrival_id: params.destination,
    outbound_date: params.outboundDate,
    currency: params.currency || 'THB',
    hl: 'th',
    gl: 'th',
    type: params.returnDate ? '1' : '2',
    adults: String(params.adults || 1),
    travel_class: travelClassParam(params.cabin),
  })
  if (params.returnDate) qs.set('return_date', params.returnDate)

  const url = `https://serpapi.com/search.json?${qs.toString()}`
  const res = await fetchImpl(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(25000),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    return {
      error: data?.error || `SerpAPI ตอบ ${res.status}`,
      code: 'SERPAPI_HTTP_ERROR',
      status: res.status,
    }
  }
  if (data?.error) {
    return { error: String(data.error), code: 'SERPAPI_ERROR' }
  }

  const picked = pickBestFlightOffers(data, params.currency || 'THB')
  if (!picked.lowest) {
    return { error: 'ไม่พบราคาเที่ยวบินจาก Google Flights', code: 'NO_OFFERS' }
  }

  const payload = {
    origin: params.origin,
    destination: params.destination,
    outboundDate: params.outboundDate,
    returnDate: params.returnDate,
    adults: params.adults || 1,
    currency: params.currency || 'THB',
    lowest: picked.lowest,
    offers: picked.offers,
    fetchedAt: new Date().toISOString(),
    disclaimer: 'ราคาจาก Google Flights ผ่าน SerpAPI — ยังไม่ใช่การจองในแอป อาจเปลี่ยนได้',
    cached: false,
  }
  cache.set(key, { expiresAt: Date.now() + CACHE_TTL_MS, payload })
  return payload
}

/** Test helper */
export function _clearSerpFlightCache() {
  cache.clear()
}
