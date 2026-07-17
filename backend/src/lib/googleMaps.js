/** Build Google Maps open/embed URLs for trip place focus */

import { scorePlaceNameMatch } from './placeMatch.js'

function getMapsKey() {
  // Only use an explicit Embed key — Places keys often lack Maps Embed API
  return process.env.GOOGLE_MAPS_EMBED_API_KEY?.trim() || ''
}

/** Reject Null Island / junk coords that pin the Gulf of Guinea. */
export function isValidMapCoords(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false
  if (Math.abs(la) < 0.01 && Math.abs(ln) < 0.01) return false
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return false
  return true
}

/** Clean place name for map search — strip generic prefixes, keep airport codes. */
export function cleanMapSearchQuery(name = '') {
  let q = String(name || '').trim()
  if (!q) return ''
  // Prefer IATA codes in parentheses: "สนามบินดอนเมือง (DMK)" → keep full + code
  const code = /\(([A-Z]{3})\)/.exec(q)
  if (code) {
    const base = q.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
    q = `${base} ${code[1]} Airport`
    return q.slice(0, 160)
  }
  q = q
    .replace(/^ร้านอาหาร\s+/i, '')
    .replace(/^โรงแรม\s+/i, '')
    .replace(/^ที่พัก\s+/i, '')
    .trim()
  return q.slice(0, 160)
}

/** Alternate search strings — English in parens, name + destination, etc. */
export function buildMapSearchQueries(name = '', address = '', near = '', type = 'other') {
  const raw = String(name || '').trim()
  const addr = String(address || '').trim()
  const dest = String(near || '').trim()
  const cleaned = cleanMapSearchQuery(raw)
  const queries = []

  if (cleaned) queries.push(cleaned)
  if (raw && raw !== cleaned) queries.push(raw)

  const parenEn = /\(([^)]*[A-Za-z][^)]*)\)/.exec(raw)
  if (parenEn?.[1]) {
    const en = parenEn[1].trim()
    if (en) queries.push(en)
    if (dest && !en.toLowerCase().includes(dest.toLowerCase())) {
      queries.push(`${en} ${dest}`)
    }
  }

  const core = cleaned.replace(/\([^)]*\)/g, '').trim()
  if (core && core !== cleaned) queries.push(core)
  if (core && dest) queries.push(`${core} ${dest}`)
  if (cleaned && dest && type === 'restaurant') queries.push(`${cleaned} ${dest}`)
  if (addr) {
    const shortAddr = addr.split(',')[0].trim()
    if (cleaned && shortAddr) queries.push(`${cleaned} ${shortAddr}`)
    if (dest && shortAddr) queries.push(`${shortAddr} ${dest}`)
  }

  return [...new Set(queries.filter(Boolean))].slice(0, 6)
}

/**
 * Trip destination should not bias search when the place is already specific
 * (airports, coded names) — otherwise DMK + near=ChiangMai returns wrong POIs.
 */
export function shouldBiasSearchWithDestination(name, type) {
  const q = String(name || '')
  if (/airport|สนามบิน|\([A-Z]{3}\)/i.test(q)) return false
  if (type === 'airport') return false
  return true
}

function buildQueryText({ name, address }) {
  return [name, address].map((s) => String(s || '').trim()).filter(Boolean).join(', ')
}

function scoreMapHit(query, candidate, altQueries = []) {
  const all = [query, ...altQueries].filter(Boolean)
  let best = 0
  for (const q of all) {
    best = Math.max(best, scorePlaceNameMatch(q, candidate))
    // English in parens vs Thai name — compare stripped cores
    const en = /\(([^)]*[A-Za-z][^)]*)\)/.exec(q)
    if (en?.[1]) best = Math.max(best, scorePlaceNameMatch(en[1], candidate))
  }
  return best
}

function pickBestHit(results, query, altQueries = []) {
  if (!Array.isArray(results) || !results.length) return null
  let best = null
  let bestScore = -1
  for (const hit of results) {
    const score = scoreMapHit(query, hit?.name || '', altQueries)
    if (score > bestScore) {
      best = hit
      bestScore = score
    }
  }
  if (bestScore < 0.15 && results[0]) {
    if (String(query || '').trim().length < 4) return results[0]
  }
  return bestScore >= 0.15 ? best : results[0]
}

/** Public Google Maps link (opens full Google Maps UI). */
export function buildGoogleMapsOpenUrl({ name, address, lat, lng, placeId }) {
  if (placeId) {
    const q = encodeURIComponent(String(name || address || 'place'))
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`
  }
  if (isValidMapCoords(lat, lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${Number(lat)},${Number(lng)}`)}`
  }
  const query = buildQueryText({ name, address })
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'Thailand')}`
}

/**
 * Embeddable map URL.
 * Prefer place_id → valid lat/lng → place name (never append trip destination).
 */
export function buildGoogleMapsEmbedUrl({ name, address, lat, lng, placeId }) {
  const key = getMapsKey()
  const textQ = buildQueryText({ name, address })
  const hasCoords = isValidMapCoords(lat, lng)

  if (key) {
    let q
    if (placeId) q = `place_id:${placeId}`
    else if (hasCoords) q = `${Number(lat)},${Number(lng)}`
    else if (textQ) q = textQ
    else q = 'Thailand'
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&language=th&zoom=15`
  }

  // No Embed API key
  if (placeId && textQ) {
    return `https://www.google.com/maps?q=${encodeURIComponent(textQ)}&z=15&hl=th&output=embed`
  }
  if (hasCoords) {
    return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}&z=15&hl=th&output=embed`
  }
  if (textQ) {
    return `https://www.google.com/maps?q=${encodeURIComponent(textQ)}&z=15&hl=th&output=embed`
  }
  return `https://www.google.com/maps?q=${encodeURIComponent('Thailand')}&z=5&hl=th&output=embed`
}

/** Resolve a trip place into map URLs + best matching POI (via search). */
export async function resolveTripPlaceMap(searchTripPlaces, {
  name,
  type = 'other',
  near = '',
  lat = null,
  lng = null,
  placeId = null,
  address = null,
} = {}) {
  let hit = null
  let hitScore = 0
  const requestCoordsOk = isValidMapCoords(lat, lng)
  const hasStoredPlaceId = Boolean(placeId)
  const searchQ = cleanMapSearchQuery(name) || String(name || '').trim() || String(near || '').trim()
  const nearForSearch = shouldBiasSearchWithDestination(name, type) ? near : ''
  const searchQueries = buildMapSearchQueries(name, address, nearForSearch, type)
  const altQueries = searchQueries.filter((q) => q !== searchQ)

  // Search when missing reliable placeId/coords, or to improve weak stored data
  const needsSearch = !hasStoredPlaceId || !requestCoordsOk || type === 'restaurant'
  if (needsSearch && searchQueries.length) {
    try {
      let bestHit = null
      let bestScore = -1
      let bestQuery = searchQ
      for (const q of searchQueries) {
        const results = await searchTripPlaces({
          query: q,
          type: type || 'other',
          near: nearForSearch,
        })
        for (const candidate of results) {
          const score = scoreMapHit(q, candidate?.name || '', altQueries)
          if (score > bestScore) {
            bestScore = score
            bestHit = candidate
            bestQuery = q
          }
        }
      }
      hit = bestHit
      hitScore = bestScore >= 0 ? bestScore : scoreMapHit(bestQuery, bestHit?.name || '', altQueries)
    } catch {
      hit = null
    }
  }

  const hitCoordsOk = isValidMapCoords(hit?.lat, hit?.lng)
  // Prefer search hit when it matches well; override wrong stored coords for mappable POIs
  const strongHit = hit && hitScore >= 0.2
  const placeTypes = ['restaurant', 'hotel', 'attraction', 'airport', 'other']
  const useHit = hit && hitCoordsOk && (
    strongHit
    || !requestCoordsOk
    || (hitScore >= 0.15 && placeTypes.includes(type))
  )
  const resolvedLat = useHit && hitCoordsOk ? Number(hit.lat) : (requestCoordsOk ? Number(lat) : (hitCoordsOk ? Number(hit.lat) : null))
  const resolvedLng = useHit && hitCoordsOk ? Number(hit.lng) : (requestCoordsOk ? Number(lng) : (hitCoordsOk ? Number(hit.lng) : null))

  const resolved = {
    name: (useHit && hit?.name) || name || 'สถานที่',
    address: (useHit && hit?.address) || address || null,
    lat: resolvedLat,
    lng: resolvedLng,
    placeId: (strongHit && hit?.externalId) || placeId || (useHit && hit?.externalId) || null,
    photoUrl: (useHit && hit?.photoUrl) || null,
    rating: useHit ? (hit?.rating ?? null) : null,
    userRatingCount: useHit ? (hit?.userRatingCount ?? null) : null,
    category: type || (useHit && hit?.category) || null,
    source: (useHit && hit?.source) || null,
  }

  const openUrl = (useHit && hit?.googleMapsUri) || buildGoogleMapsOpenUrl({
    name: resolved.name,
    address: resolved.address,
    lat: resolved.lat,
    lng: resolved.lng,
    placeId: resolved.placeId,
  })

  // Embed: placeId / coords / name only — do NOT append trip destination
  const embedUrl = buildGoogleMapsEmbedUrl({
    name: resolved.name,
    address: resolved.address,
    lat: resolved.lat,
    lng: resolved.lng,
    placeId: resolved.placeId,
  })

  return {
    place: resolved,
    embedUrl,
    openUrl,
    provider: hit?.source === 'google' || getMapsKey() ? 'google' : 'google-fallback',
  }
}
