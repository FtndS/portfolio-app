/** Phase 1 flight legs — parse routes, IATA lookup, curated provider deep links (no price API). */

/** @typedef {{ origin: string, destination: string, departDate: string|null, returnDate: string|null, passengers: number, cabin: string, tripType: 'oneway'|'roundtrip', label: string|null }} FlightLeg */

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

const IATA_BY_KEY = new Map([
  ['bkk', 'BKK'], ['suvarnabhumi', 'BKK'], ['สุวรรณภูมิ', 'BKK'], ['bangkok', 'BKK'], ['กรุงเทพ', 'BKK'],
  ['dmk', 'DMK'], ['don mueang', 'DMK'], ['donmueang', 'DMK'], ['ดอนเมือง', 'DMK'],
  ['cnx', 'CNX'], ['chiang mai', 'CNX'], ['chiangmai', 'CNX'], ['เชียงใหม่', 'CNX'],
  ['hkt', 'HKT'], ['phuket', 'HKT'], ['ภูเก็ต', 'HKT'],
  ['usm', 'USM'], ['samui', 'USM'], ['koh samui', 'USM'], ['เกาะสมุย', 'USM'], ['สมุย', 'USM'],
  ['kbv', 'KBV'], ['krabi', 'KBV'], ['กระบี่', 'KBV'],
  ['hdy', 'HDY'], ['hat yai', 'HDY'], ['หาดใหญ่', 'HDY'],
  ['utp', 'UTP'], ['u-tapao', 'UTP'], ['utapao', 'UTP'],
  ['cei', 'CEI'], ['chiang rai', 'CEI'], ['เชียงราย', 'CEI'],
  ['urt', 'URT'], ['surat thani', 'URT'], ['สุราษฎร์ธานี', 'URT'],
  ['nrt', 'NRT'], ['narita', 'NRT'], ['นาริตะ', 'NRT'], ['tokyo narita', 'NRT'],
  ['hnd', 'HND'], ['haneda', 'HND'], ['โตเกียว', 'NRT'], ['tokyo', 'NRT'],
  ['kix', 'KIX'], ['osaka', 'KIX'], ['โอซาก้า', 'KIX'],
  ['icn', 'ICN'], ['incheon', 'ICN'], ['seoul', 'ICN'], ['โซล', 'ICN'],
  ['sin', 'SIN'], ['singapore', 'SIN'], ['สิงคโปร์', 'SIN'],
  ['kul', 'KUL'], ['kuala lumpur', 'KUL'],
  ['hkg', 'HKG'], ['hong kong', 'HKG'], ['ฮ่องกง', 'HKG'],
  ['tpe', 'TPE'], ['taipei', 'TPE'], ['ไทเป', 'TPE'],
  ['nrt', 'NRT'],
])

const IATA_LABELS = {
  BKK: 'กรุงเทพ (BKK)',
  DMK: 'ดอนเมือง (DMK)',
  CNX: 'เชียงใหม่ (CNX)',
  HKT: 'ภูเก็ต (HKT)',
  USM: 'เกาะสมุย (USM)',
  KBV: 'กระบี่ (KBV)',
  HDY: 'หาดใหญ่ (HDY)',
  NRT: 'นาริตะ (NRT)',
  HND: 'ฮาเนดะ (HND)',
  KIX: 'โอซาก้า (KIX)',
  ICN: 'อินชอน (ICN)',
  SIN: 'สิงคโปร์ (SIN)',
}

/** Extract explicit IATA from text — (DMK), DMK, BKK-CNX */
export function extractIataCodes(text = '') {
  const s = String(text || '')
  const found = new Set()
  for (const m of s.matchAll(/\(([A-Z]{3})\)/g)) found.add(m[1])
  for (const m of s.matchAll(/\b([A-Z]{3})\b/g)) {
    if (IATA_BY_KEY.has(m[1].toLowerCase()) || IATA_LABELS[m[1]]) found.add(m[1])
  }
  return [...found]
}

export function lookupIata(text = '') {
  const raw = String(text || '').trim()
  if (!raw) return null
  const code = extractIataCodes(raw)[0]
  if (code) return code
  const norm = raw.toLowerCase().replace(/\s+/g, ' ').trim()
  if (IATA_BY_KEY.has(norm)) return IATA_BY_KEY.get(norm)
  for (const [key, iata] of IATA_BY_KEY) {
    if (norm.includes(key) || key.includes(norm)) return iata
  }
  return null
}

/** Parse "กรุงเทพ–เชียงใหม่", "Bangkok to Chiang Mai", "DMK-CNX" */
export function parseRoutePair(text = '') {
  const s = String(text || '').trim()
  if (!s) return null

  const codes = extractIataCodes(s)
  if (codes.length >= 2) return { from: codes[0], to: codes[1] }

  const arrow = /(.+?)\s*(?:[–\-—→]|(?:\s+to\s+)|(?:\s+ถึง\s+)|(?:\s+ไป\s+))\s*(.+)/i.exec(s)
  if (arrow) {
    const from = lookupIata(arrow[1]) || lookupIata(arrow[1].replace(/^.*เที่ยวบิน\s*/i, ''))
    const to = lookupIata(arrow[2])
    if (from && to) return { from, to }
  }

  const dash = /(.+?)[–\-—](.+)/.exec(s.replace(/^.*เที่ยวบิน\s*/i, ''))
  if (dash) {
    const from = lookupIata(dash[1])
    const to = lookupIata(dash[2])
    if (from && to) return { from, to }
  }

  return null
}

/** Parse structured hints from notes: "โหมด: บิน | จาก:DMK ถึง:CNX" */
export function parseFlightHintsFromNotes(notes = '') {
  const s = String(notes || '')
  const from = /(?:จาก|from)\s*:?\s*([A-Za-zก-๙\s]+?)(?:\s|$|ถึง|to|\|)/i.exec(s)
  const to = /(?:ถึง|to)\s*:?\s*([A-Za-zก-๙\s]+?)(?:\s|$|\|)/i.exec(s)
  return {
    from: from ? lookupIata(from[1]) : null,
    to: to ? lookupIata(to[1]) : null,
  }
}

function formatDateOnly(value) {
  if (!value) return null
  const s = String(value).slice(0, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null
}

function skyscannerDate(iso) {
  if (!iso) return null
  return iso.replace(/-/g, '').slice(2) // YYYY-MM-DD → YYMMDD
}

function expediaDate(iso) {
  if (!iso) return null
  const [y, m, d] = iso.split('-')
  return `${m}/${d}/${y}`
}

function iataLabel(code) {
  return IATA_LABELS[code] || code
}

/**
 * Resolve a flight leg from place + trip context.
 * @returns {FlightLeg|null}
 */
export function resolveFlightLeg({ place, trip = {}, dayDate = null, allPlaces = [] } = {}) {
  if (!isFlightPlace(place)) return null

  const hints = parseFlightHintsFromNotes(place.notes)
  let route = parseRoutePair(`${place.name} ${place.notes || ''}`)
  if (!route && hints.from && hints.to) route = { from: hints.from, to: hints.to }

  const type = String(place.type || '').toLowerCase()
  const destIata = lookupIata(trip.destination || '')

  if (!route && type === 'airport') {
    const code = lookupIata(place.name) || extractIataCodes(place.name)[0]
    if (code && destIata && code !== destIata) {
      route = { from: code, to: destIata }
    } else if (code && destIata && code === destIata) {
      // Arrival airport — try find outbound from earlier places
      const prior = (allPlaces || []).filter((p) => p.id !== place.id)
      for (const p of prior) {
        const r = parseRoutePair(p.name)
        if (r) { route = r; break }
        const c = lookupIata(p.name)
        if (c && c !== code) { route = { from: c, to: code }; break }
      }
    }
  }

  if (!route) {
    // Last resort: Bangkok ↔ destination
    const bangkok = 'BKK'
    if (destIata && destIata !== bangkok) {
      route = { from: bangkok, to: destIata }
    }
  }

  if (!route?.from || !route?.to || route.from === route.to) return null

  const departDate = formatDateOnly(dayDate) || formatDateOnly(trip.start_date)
  const returnDate = formatDateOnly(trip.end_date)
  const tripType = returnDate && returnDate !== departDate ? 'roundtrip' : 'oneway'

  return {
    origin: route.from,
    destination: route.to,
    departDate,
    returnDate: tripType === 'roundtrip' ? returnDate : null,
    passengers: 1,
    cabin: 'economy',
    tripType,
    label: `${iataLabel(route.from)} → ${iataLabel(route.to)}`,
  }
}

function googleFlightsUrl(leg) {
  const parts = [`Flights from ${leg.origin} to ${leg.destination}`]
  if (leg.departDate) parts.push(`on ${leg.departDate}`)
  if (leg.returnDate) parts.push(`through ${leg.returnDate}`)
  return `https://www.google.com/travel/flights?q=${encodeURIComponent(parts.join(' '))}`
}

function skyscannerUrl(leg) {
  const o = leg.origin.toLowerCase()
  const d = leg.destination.toLowerCase()
  const dep = skyscannerDate(leg.departDate)
  if (!dep) return `https://www.skyscanner.co.th/transport/flights/${o}/${d}/`
  if (leg.returnDate) {
    const ret = skyscannerDate(leg.returnDate)
    return `https://www.skyscanner.co.th/transport/flights/${o}/${d}/${dep}/${ret}/`
  }
  return `https://www.skyscanner.co.th/transport/flights/${o}/${d}/${dep}/`
}

function tripComUrl(leg) {
  const q = [
    leg.origin,
    leg.destination,
    leg.departDate || '',
    leg.returnDate || '',
  ].filter(Boolean).join(' ')
  return `https://th.trip.com/flights/showfarefirst?locale=th-th&curr=THB&dcity=${encodeURIComponent(leg.origin.toLowerCase())}&acity=${encodeURIComponent(leg.destination.toLowerCase())}${leg.departDate ? `&ddate=${leg.departDate}` : ''}${leg.returnDate ? `&rdate=${leg.returnDate}` : ''}&triptype=${leg.tripType === 'roundtrip' ? 'rt' : 'ow'}`
}

function expediaUrl(leg) {
  if (!leg.departDate) {
    return `https://www.expedia.com/Flights-Search?flight-type=on&mode=search&trip=${leg.tripType}&passengers=adults:${leg.passengers || 1}`
  }
  const leg1 = `from:${leg.origin},to:${leg.destination},departure:${expediaDate(leg.departDate)}TANYT`
  let url = `https://www.expedia.com/Flights-Search?flight-type=on&mode=search&trip=${leg.tripType}&leg1=${encodeURIComponent(leg1)}&passengers=adults:${leg.passengers || 1}`
  if (leg.tripType === 'roundtrip' && leg.returnDate) {
    const leg2 = `from:${leg.destination},to:${leg.origin},departure:${expediaDate(leg.returnDate)}TANYT`
    url += `&leg2=${encodeURIComponent(leg2)}`
  }
  return url
}

function kiwiUrl(leg) {
  const slug = `${leg.origin.toLowerCase()}-${leg.destination.toLowerCase()}`
  if (leg.departDate && leg.returnDate) {
    return `https://www.kiwi.com/th/search/results/${slug}/${leg.departDate}/${leg.returnDate}`
  }
  if (leg.departDate) {
    return `https://www.kiwi.com/th/search/results/${slug}/${leg.departDate}`
  }
  return `https://www.kiwi.com/th/search/results/${slug}`
}

/** Curated flight provider links with structured search params. */
export function buildFlightProviderLinks(leg) {
  if (!leg?.origin || !leg?.destination) return []
  return [
    { label: 'Google Flights', kind: 'flight', provider: 'google', url: googleFlightsUrl(leg), primary: true },
    { label: 'Skyscanner', kind: 'flight', provider: 'skyscanner', url: skyscannerUrl(leg) },
    { label: 'Trip.com', kind: 'flight', provider: 'trip', url: tripComUrl(leg) },
    { label: 'Expedia', kind: 'flight', provider: 'expedia', url: expediaUrl(leg) },
    { label: 'Kiwi.com', kind: 'flight', provider: 'kiwi', url: kiwiUrl(leg) },
  ]
}

/** Attach flight_leg + booking links for a place (computed, not persisted). */
export function enrichFlightPlace(place, context = {}) {
  if (!isFlightPlace(place)) return place
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
