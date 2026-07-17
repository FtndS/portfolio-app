/** Parse flight fields from trip/place text input — no hardcoded routes or defaults. */

const TAG_PATTERNS = {
  origin: ['จาก', 'from', 'ต้นทาง', 'origin'],
  destination: ['ถึง', 'to', 'ปลายทาง', 'destination'],
  passengers: ['ผู้โดยสาร', 'passengers', 'pax'],
  cabin: ['ชั้นโดยสาร', 'ชั้น', 'cabin', 'class'],
}

const ALL_TAG_KEYS = Object.values(TAG_PATTERNS).flat()

function pickTagged(text, keys) {
  const s = String(text || '')
  const stopKeys = ALL_TAG_KEYS.filter((k) => !keys.includes(k))
  const stopPattern = stopKeys.length
    ? `(?=\\s*(?:${stopKeys.map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})\\s*:|\\||$)`
    : '(?=\\||$)'

  for (const key of keys) {
    const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const m = new RegExp(`${escaped}\\s*:?\\s*([^|\\n]+?)${stopPattern}`, 'iu').exec(s)
    if (m?.[1]) return m[1].trim()
  }
  return null
}

export function parseFlightTaggedFields(text = '') {
  const passengersRaw = pickTagged(text, TAG_PATTERNS.passengers)
  const passengers = passengersRaw ? Number.parseInt(passengersRaw, 10) : null
  return {
    origin: pickTagged(text, TAG_PATTERNS.origin),
    destination: pickTagged(text, TAG_PATTERNS.destination),
    passengers: Number.isFinite(passengers) && passengers > 0 ? passengers : null,
    cabin: pickTagged(text, TAG_PATTERNS.cabin),
  }
}

/** IATA only when explicitly present in user/AI input — (DMK), DMK, BKK-CNX */
export function extractIataToken(text = '') {
  const s = String(text || '').trim()
  if (!s) return null
  const paren = /\(([A-Z]{3})\)/.exec(s)
  if (paren) return paren[1]
  if (/^[A-Z]{3}$/.test(s)) return s
  const word = /\b([A-Z]{3})\b/.exec(s)
  return word?.[1] && /^[A-Z]{3}$/.test(word[1]) ? word[1] : null
}

/** Endpoint from user text — code only if IATA is in the string, else use label as-is. */
export function normalizeFlightEndpoint(text = '') {
  const label = String(text || '').trim()
  if (!label) return null
  const code = extractIataToken(label)
  return { code, label }
}

function endpointFromText(text) {
  const norm = normalizeFlightEndpoint(text)
  if (!norm) return null
  return {
    code: norm.code,
    label: norm.label,
    query: norm.code || norm.label,
  }
}

/** Parse "DMK-CNX", "กรุงเทพ–เชียงใหม่", "Bangkok to Chiang Mai" from place name/notes. */
export function parseRouteFromText(text = '') {
  const s = String(text || '').trim()
  if (!s) return null

  const codes = []
  for (const m of s.matchAll(/\(([A-Z]{3})\)/g)) codes.push(m[1])
  for (const m of s.matchAll(/\b([A-Z]{3})\b/g)) {
    if (/^[A-Z]{3}$/.test(m[1]) && !codes.includes(m[1])) codes.push(m[1])
  }
  if (codes.length >= 2) {
    return {
      origin: { code: codes[0], label: codes[0], query: codes[0] },
      destination: { code: codes[1], label: codes[1], query: codes[1] },
    }
  }

  const arrow = /(.+?)\s*(?:[–\-—→]|(?:\s+to\s+)|(?:\s+ถึง\s+)|(?:\s+ไป\s+))\s*(.+)/i.exec(s)
  if (arrow) {
    const from = endpointFromText(arrow[1].replace(/^.*เที่ยวบิน\s*/i, '').trim())
    const to = endpointFromText(arrow[2].trim())
    if (from && to) return { origin: from, destination: to }
  }

  const dash = /(.+?)[–\-—](.+)/.exec(s.replace(/^.*เที่ยวบิน\s*/i, ''))
  if (dash) {
    const from = endpointFromText(dash[1].trim())
    const to = endpointFromText(dash[2].trim())
    if (from && to) return { origin: from, destination: to }
  }

  return null
}

export function mergeFlightInput({ trip = {}, place = {} } = {}) {
  const tripTags = parseFlightTaggedFields(trip.notes)
  const placeTags = parseFlightTaggedFields(place.notes)
  return {
    originText: placeTags.origin || tripTags.origin || trip.origin || null,
    destinationText: placeTags.destination || tripTags.destination || trip.destination || null,
    passengers: placeTags.passengers ?? tripTags.passengers ?? null,
    cabin: placeTags.cabin ?? tripTags.cabin ?? null,
  }
}

export function routeFromAirportsInPlan(allPlaces = [], currentPlace = null) {
  const airports = (allPlaces || [])
    .filter((p) => String(p.type || '').toLowerCase() === 'airport')
    .filter((p) => !currentPlace?.id || p.id !== currentPlace.id)

  if (airports.length < 2) return null
  const first = endpointFromText(airports[0].name)
  const last = endpointFromText(airports[airports.length - 1].name)
  if (first && last && first.query !== last.query) {
    return { origin: first, destination: last }
  }
  return null
}
