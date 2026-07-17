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

/** Clean place name for map search — keep airport codes, drop trip destination bias. */
export function cleanMapSearchQuery(name = '') {
  let q = String(name || '').trim()
  if (!q) return ''
  // Prefer IATA codes in parentheses: "สนามบินดอนเมือง (DMK)" → keep full + code
  const code = /\(([A-Z]{3})\)/.exec(q)
  if (code) {
    const base = q.replace(/\s*\([^)]*\)\s*/g, ' ').trim()
    q = `${base} ${code[1]} Airport`
  }
  return q.slice(0, 160)
}

/**
 * Trip destination should not bias search when the place is already specific
 * (airports, coded names) — otherwise DMK + near=ChiangMai returns wrong POIs.
 */
export function shouldBiasSearchWithDestination(name, type) {
  const q = String(name || '')
  if (/airport|สนามบิน|\([A-Z]{3}\)/i.test(q)) return false
  if (type === 'airport') return false
  if (q.length >= 12) return false
  return true
}

function buildQueryText({ name, address }) {
  return [name, address].map((s) => String(s || '').trim()).filter(Boolean).join(', ')
}

function pickBestHit(results, query) {
  if (!Array.isArray(results) || !results.length) return null
  let best = null
  let bestScore = -1
  for (const hit of results) {
    const score = scorePlaceNameMatch(query, hit?.name || '')
    if (score > bestScore) {
      best = hit
      bestScore = score
    }
  }
  // Require a weak match; otherwise first result can be unrelated
  if (bestScore < 0.15 && results[0]) {
    // Still allow first if query is very short
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
  const requestCoordsOk = isValidMapCoords(lat, lng)
  const searchQ = cleanMapSearchQuery(name) || String(name || '').trim() || String(near || '').trim()
  const nearForSearch = shouldBiasSearchWithDestination(name, type) ? near : ''

  // Always search by name when possible — stored lat/lng can be wrong (destination-biased).
  if (searchQ) {
    try {
      const results = await searchTripPlaces({
        query: searchQ,
        type: type || 'other',
        near: nearForSearch,
      })
      hit = pickBestHit(results, searchQ)
    } catch {
      hit = null
    }
  }

  const hitCoordsOk = isValidMapCoords(hit?.lat, hit?.lng)
  const hitScore = hit ? scorePlaceNameMatch(searchQ, hit.name || '') : 0
  // Prefer search hit when it matches the place name; otherwise keep request coords
  const useHit = hit && (hitScore >= 0.15 || !requestCoordsOk)
  const resolvedLat = useHit && hitCoordsOk ? Number(hit.lat) : (requestCoordsOk ? Number(lat) : null)
  const resolvedLng = useHit && hitCoordsOk ? Number(hit.lng) : (requestCoordsOk ? Number(lng) : null)

  const resolved = {
    name: (useHit && hit?.name) || name || 'สถานที่',
    address: (useHit && hit?.address) || address || null,
    lat: resolvedLat,
    lng: resolvedLng,
    placeId: (useHit && hit?.externalId) || placeId || null,
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
