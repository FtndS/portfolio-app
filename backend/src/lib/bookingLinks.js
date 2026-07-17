/** Curated external booking search links for trip places (no in-app booking). */

import {
  enrichFlightPlace,
} from './flightLeg.js'

function planDayDate(trip, dayIndex) {
  const start = trip?.start_date
  if (!start) return null
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(start).slice(0, 10))
  if (!m) return null
  const dt = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])))
  dt.setUTCDate(dt.getUTCDate() + Math.max(0, (dayIndex || 1) - 1))
  const y = dt.getUTCFullYear()
  const mo = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${mo}-${d}`
}

const ALLOWED_HOSTS = new Set([
  'www.agoda.com',
  'agoda.com',
  'www.booking.com',
  'booking.com',
  'www.trip.com',
  'trip.com',
  'th.trip.com',
  'www.12go.asia',
  '12go.asia',
  'www.google.com',
  'google.com',
  'www.grab.com',
  'grab.com',
  'www.skyscanner.co.th',
  'skyscanner.co.th',
  'www.skyscanner.com',
  'skyscanner.com',
  'www.expedia.com',
  'expedia.com',
  'www.kiwi.com',
  'kiwi.com',
])

const MAX_LINKS = 6

export function inferTransportMode(name = '', notes = '') {
  const text = `${name} ${notes}`.toLowerCase()
  if (/โหมด:\s*บิน|เครื่องบิน|เที่ยวบิน|flight|fly|airport|สนามบิน/.test(text)) return 'flight'
  if (/โหมด:\s*รถไฟ|รถไฟ|train|railway/.test(text)) return 'train'
  if (/โหมด:\s*เรือ|เรือ|ferry|boat|ข้ามฟาก/.test(text)) return 'ferry'
  if (/โหมด:\s*รถ|grab|taxi|bolt|รถเช่า|รถตู้|van|bus|รถบัส/.test(text)) return 'car'
  if (/เครื่องบิน|เที่ยวบิน|flight/.test(text)) return 'flight'
  if (/รถไฟ|train/.test(text)) return 'train'
  if (/เรือ|ferry|boat/.test(text)) return 'ferry'
  if (/grab|taxi|รถ/.test(text)) return 'car'
  return null
}

function encodeQ(s) {
  return encodeURIComponent(String(s || '').trim())
}

function searchQuery(name, destination) {
  const n = String(name || '').trim()
  const d = String(destination || '').trim()
  if (n && d && !n.includes(d)) return `${n} ${d}`
  return n || d || ''
}

function hotelLinks(q) {
  if (!q) return []
  return [
    {
      label: 'Agoda',
      kind: 'hotel',
      url: `https://www.agoda.com/search?city=&textToSearch=${encodeQ(q)}`,
    },
    {
      label: 'Booking.com',
      kind: 'hotel',
      url: `https://www.booking.com/searchresults.html?ss=${encodeQ(q)}`,
    },
    {
      label: 'Trip.com',
      kind: 'hotel',
      url: `https://www.trip.com/hotels/list?keyword=${encodeQ(q)}`,
    },
  ]
}

function flightLinks(q, context = {}) {
  if (context?.place) {
    const enriched = enrichFlightPlace(context.place, context)
    if (enriched.flight_leg) return enriched.booking_links
  }
  if (!q) return []
  return [
    {
      label: 'Google Flights',
      kind: 'flight',
      url: `https://www.google.com/travel/flights?q=${encodeQ(q)}`,
    },
    {
      label: 'Trip.com',
      kind: 'flight',
      url: `https://www.trip.com/flights/search?keyword=${encodeQ(q)}`,
    },
  ]
}

function surfaceLinks(q) {
  if (!q) return []
  return [
    {
      label: '12Go',
      kind: 'transport',
      url: `https://www.12go.asia/en/search?q=${encodeQ(q)}`,
    },
    {
      label: 'Trip.com',
      kind: 'transport',
      url: `https://www.trip.com/trains/list?keyword=${encodeQ(q)}`,
    },
  ]
}

function carLinks() {
  return [
    {
      label: 'Grab',
      kind: 'car',
      url: 'https://www.grab.com/th/transport/',
    },
  ]
}

/** Build curated booking search links from place context. */
export function buildBookingLinks({ type, name, destination = '', notes = '', place = null, trip = null, dayDate = null, allPlaces = [] } = {}) {
  const t = String(type || 'other').toLowerCase()
  const q = searchQuery(name, destination)
  const mode = inferTransportMode(name, notes)
  const ctx = { place: place || { type, name, notes }, trip, dayDate, allPlaces, destination }

  if (t === 'hotel') return hotelLinks(q).slice(0, MAX_LINKS)

  if (t === 'airport') return flightLinks(q || destination, ctx).slice(0, MAX_LINKS)

  if (t === 'transport') {
    if (mode === 'flight') return flightLinks(q, ctx).slice(0, MAX_LINKS)
    if (mode === 'car') return carLinks().slice(0, MAX_LINKS)
    if (mode === 'train' || mode === 'ferry') return surfaceLinks(q).slice(0, MAX_LINKS)
    // Unknown transport mode: offer both surface + Grab
    return [...surfaceLinks(q), ...carLinks()].slice(0, MAX_LINKS)
  }

  return []
}

function isAllowedUrl(url) {
  try {
    const u = new URL(String(url))
    if (u.protocol !== 'https:') return false
    return ALLOWED_HOSTS.has(u.hostname.toLowerCase())
  } catch {
    return false
  }
}

/** Keep only https links on allowlisted hosts. */
export function sanitizeBookingLinks(list) {
  if (!Array.isArray(list)) return []
  const out = []
  const seen = new Set()
  for (const item of list) {
    if (!item || typeof item !== 'object') continue
    const label = String(item.label || '').trim().slice(0, 40)
    const url = String(item.url || '').trim()
    const kind = String(item.kind || 'other').trim().slice(0, 32) || 'other'
    if (!label || !url || !isAllowedUrl(url)) continue
    if (seen.has(url)) continue
    seen.add(url)
    out.push({
      label,
      url,
      kind,
      ...(item.provider ? { provider: String(item.provider).trim().slice(0, 32) } : {}),
      ...(item.primary ? { primary: true } : {}),
    })
    if (out.length >= MAX_LINKS) break
  }
  return out
}

/** Attach server-built links onto a place (overwrites any AI-supplied URLs). */
export function attachBookingLinks(place, destination = '', context = {}) {
  if (!place || typeof place !== 'object') return place
  const trip = context.trip || {}
  const allPlaces = context.allPlaces || []
  const dayDate = context.dayDate ?? null
  const links = buildBookingLinks({
    type: place.type,
    name: place.name,
    destination: destination || trip.destination || '',
    notes: place.notes,
    place,
    trip,
    dayDate,
    allPlaces,
  })
  const enriched = enrichFlightPlace({ ...place, booking_links: sanitizeBookingLinks(links) }, { trip, dayDate, allPlaces })
  return enriched
}

export function attachBookingLinksToPlan(plan) {
  if (!plan?.trip?.days) return plan
  const trip = plan.trip
  const destination = trip.destination || ''
  const allPlaces = trip.days.flatMap((d) => d.places || [])
  const days = trip.days.map((day) => ({
    ...day,
    places: (day.places || []).map((p) => attachBookingLinks(p, destination, {
      trip,
      dayDate: planDayDate(trip, day.day_index),
      allPlaces,
    })),
  }))
  return { ...plan, trip: { ...trip, days } }
}
