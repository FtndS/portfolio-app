/** Phase 1 flight legs — parse from trip/place input, build provider deep links (no price API). */

import {
  extractIataToken,
  mergeFlightInput,
  normalizeFlightEndpoint,
  parseRouteFromText,
  routeFromAirportsInPlan,
} from './flightInput.js'

/** @typedef {{ origin: string, destination: string, originLabel: string, destinationLabel: string, departDate: string|null, returnDate: string|null, passengers: number|null, cabin: string|null, tripType: 'oneway'|'roundtrip', label: string|null }} FlightLeg */

function inferFlightMode(name = '', notes = '') {
  const text = `${name} ${notes}`.toLowerCase()
  return /โหมด:\s*บิน|เครื่องบิน|เที่ยวบิน|flight|fly|airport|สนามบิน/.test(text)
}

export function isFlightPlace(place) {
  if (!place) return false
  const type = String(place.type || '').toLowerCase()
  if (type === 'airport') return true
  if (type === 'transport') return inferFlightMode(place.name, place.notes)
  return false
}

// Re-export for tests / callers that only need explicit IATA from input text
export { extractIataToken, parseRouteFromText as parseRoutePair } from './flightInput.js'

function formatDateOnly(value) {
  if (!value) return null
  const s = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function skyscannerDate(iso) {
  if (!iso) return null
  return iso.replace(/-/g, '').slice(2)
}

function expediaDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

function slugifyQuery(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 48)
}

function endpointLabel(ep) {
  return ep?.label || ep?.query || ep?.code || ''
}

function buildRouteLabel(origin, destination) {
  const a = endpointLabel(origin)
  const b = endpointLabel(destination)
  if (!a || !b) return null
  return `${a} → ${b}`
}

/**
 * Resolve a flight leg from place + trip input only (no hardcoded cities/airports).
 * @returns {FlightLeg|null}
 */
export function resolveFlightLeg({ place, trip = {}, dayDate = null, allPlaces = [] } = {}) {
  if (!place || String(place.type || '').toLowerCase() !== 'transport') return null
  if (!inferFlightMode(place.name, place.notes)) return null

  const input = mergeFlightInput({ trip, place })
  let route = parseRouteFromText(`${place.name} ${place.notes || ''}`)

  if (!route && input.originText && input.destinationText) {
    const origin = normalizeFlightEndpoint(input.originText)
    const destination = normalizeFlightEndpoint(input.destinationText)
    if (origin && destination) {
      route = {
        origin: { code: origin.code, label: origin.label, query: origin.code || origin.label },
        destination: { code: destination.code, label: destination.label, query: destination.code || destination.label },
      }
    }
  }

  if (!route && input.originText && trip.destination) {
    const origin = normalizeFlightEndpoint(input.originText)
    const destination = normalizeFlightEndpoint(trip.destination)
    if (origin && destination) {
      route = {
        origin: { code: origin.code, label: origin.label, query: origin.code || origin.label },
        destination: { code: destination.code, label: destination.label, query: destination.code || destination.label },
      }
    }
  }

  if (!route) {
    route = routeFromAirportsInPlan(allPlaces, place)
  }

  if (!route?.origin?.query || !route?.destination?.query) return null
  if (route.origin.query === route.destination.query) return null

  const departDate = formatDateOnly(dayDate) || formatDateOnly(trip.start_date)
  const returnDate = formatDateOnly(trip.end_date)
  const tripType = returnDate && returnDate !== departDate ? 'roundtrip' : 'oneway'

  return {
    origin: route.origin.code || route.origin.query,
    destination: route.destination.code || route.destination.query,
    originLabel: route.origin.label,
    destinationLabel: route.destination.label,
    departDate,
    returnDate: tripType === 'roundtrip' ? returnDate : null,
    passengers: input.passengers,
    cabin: input.cabin,
    tripType,
    label: buildRouteLabel(route.origin, route.destination),
  }
}

function googleFlightsUrl(leg) {
  const from = leg.originLabel || leg.origin
  const to = leg.destinationLabel || leg.destination
  const parts = [`Flights from ${from} to ${to}`]
  if (leg.departDate) parts.push(`on ${leg.departDate}`)
  if (leg.returnDate) parts.push(`through ${leg.returnDate}`)
  if (leg.passengers) parts.push(`${leg.passengers} passengers`)
  if (leg.cabin) parts.push(leg.cabin)
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(' '))}`
}

function skyscannerUrl(leg) {
  const o = slugifyQuery(leg.origin)
  const d = slugifyQuery(leg.destination)
  if (!o || !d) return null
  const dep = skyscannerDate(leg.departDate)
  if (!dep) return `https://www.skyscanner.co.th/transport/flights/${o}/${d}/`
  if (leg.returnDate) {
    const ret = skyscannerDate(leg.returnDate)
    return `https://www.skyscanner.co.th/transport/flights/${o}/${d}/${dep}/${ret}/`
  }
  return `https://www.skyscanner.co.th/transport/flights/${o}/${d}/${dep}/`
}

function tripComUrl(leg) {
  const from = leg.originLabel || leg.origin
  const to = leg.destinationLabel || leg.destination
  const q = [from, to, leg.departDate || '', leg.returnDate || ''].filter(Boolean).join(' ')
  if (/^[A-Z]{3}$/i.test(String(leg.origin)) && /^[A-Z]{3}$/i.test(String(leg.destination))) {
    return `https://th.trip.com/flights/showfarefirst?locale=th-th&curr=THB&dcity=${encodeURIComponent(String(leg.origin).toLowerCase())}&acity=${encodeURIComponent(String(leg.destination).toLowerCase())}${leg.departDate ? `&ddate=${leg.departDate}` : ''}${leg.returnDate ? `&rdate=${leg.returnDate}` : ''}&triptype=${leg.tripType === 'roundtrip' ? 'rt' : 'ow'}`
  }
  return `https://th.trip.com/flights/search?keyword=${encodeURIComponent(q)}`
}

function expediaUrl(leg) {
  const pax = leg.passengers ? `&passengers=adults:${leg.passengers}` : ''
  if (!leg.departDate) {
    return `https://www.expedia.com/Flights-Search?flight-type=on&mode=search&trip=${leg.tripType}${pax}`
  }
  const leg1 = `from:${leg.origin},to:${leg.destination},departure:${expediaDate(leg.departDate)}TANYT`
  let url = `https://www.expedia.com/Flights-Search?flight-type=on&mode=search&trip=${leg.tripType}&leg1=${encodeURIComponent(leg1)}${pax}`
  if (leg.tripType === 'roundtrip' && leg.returnDate) {
    const leg2 = `from:${leg.destination},to:${leg.origin},departure:${expediaDate(leg.returnDate)}TANYT`
    url += `&leg2=${encodeURIComponent(leg2)}`
  }
  return url
}

function kiwiUrl(leg) {
  const slug = `${slugifyQuery(leg.originLabel || leg.origin)}-${slugifyQuery(leg.destinationLabel || leg.destination)}`
  if (leg.departDate && leg.returnDate) {
    return `https://www.kiwi.com/th/search/results/${slug}/${leg.departDate}/${leg.returnDate}`
  }
  if (leg.departDate) {
    return `https://www.kiwi.com/th/search/results/${slug}/${leg.departDate}`
  }
  return `https://www.kiwi.com/th/search/results/${slug}`
}

/** Curated flight provider links built from resolved leg input. */
export function buildFlightProviderLinks(leg) {
  if (!leg?.origin || !leg?.destination) return []
  const links = [
    { label: 'Google Flights', kind: 'flight', provider: 'google', url: googleFlightsUrl(leg), primary: true },
    { label: 'Trip.com', kind: 'flight', provider: 'trip', url: tripComUrl(leg) },
    { label: 'Expedia', kind: 'flight', provider: 'expedia', url: expediaUrl(leg) },
    { label: 'Kiwi.com', kind: 'flight', provider: 'kiwi', url: kiwiUrl(leg) },
  ]
  const sky = skyscannerUrl(leg)
  if (sky) links.splice(1, 0, { label: 'Skyscanner', kind: 'flight', provider: 'skyscanner', url: sky })
  return links
}

/** Attach flight_leg + booking links for transport flight legs (computed, not persisted). */
export function enrichFlightPlace(place, context = {}) {
  if (!place || String(place.type || '').toLowerCase() !== 'transport') return place
  if (!inferFlightMode(place.name, place.notes)) return place
  const leg = resolveFlightLeg({
    place,
    trip: context.trip || {},
    dayDate: context.dayDate || null,
    allPlaces: context.allPlaces || [],
  })
  if (!leg) return place
  return {
    ...place,
    flight_leg: leg,
    booking_links: buildFlightProviderLinks(leg),
  }
}
