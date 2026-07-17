/** Build Google Maps open/embed URLs for trip place focus */

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

function buildQueryText({ name, address, destination }) {
  return [name, address, destination].map((s) => String(s || '').trim()).filter(Boolean).join(', ')
}

/** Public Google Maps link (opens full Google Maps UI). */
export function buildGoogleMapsOpenUrl({ name, address, destination, lat, lng, placeId }) {
  if (placeId) {
    const q = encodeURIComponent(String(name || address || destination || 'place'))
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`
  }
  if (isValidMapCoords(lat, lng)) {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${Number(lat)},${Number(lng)}`)}`
  }
  const query = buildQueryText({ name, address, destination })
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'Thailand')}`
}

/**
 * Embeddable map URL.
 * Prefer place_id or place name/address text — avoid bad lat/lng pinning Null Island.
 */
export function buildGoogleMapsEmbedUrl({ name, address, destination, lat, lng, placeId }) {
  const key = getMapsKey()
  const textQ = buildQueryText({ name, address, destination })
  const hasCoords = isValidMapCoords(lat, lng)

  if (key) {
    let q
    if (placeId) q = `place_id:${placeId}`
    else if (textQ) q = textQ
    else if (hasCoords) q = `${Number(lat)},${Number(lng)}`
    else q = 'Thailand'
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&language=th&zoom=15`
  }

  // No Embed API key: use text/place search embed (more reliable than raw coords)
  if (placeId && textQ) {
    return `https://www.google.com/maps?q=${encodeURIComponent(textQ)}&z=16&hl=th&output=embed`
  }
  if (textQ) {
    return `https://www.google.com/maps?q=${encodeURIComponent(textQ)}&z=16&hl=th&output=embed`
  }
  if (hasCoords) {
    return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}&z=16&hl=th&output=embed`
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

  // Always search when missing placeId or coords are junk — so restaurants without coords still resolve
  if (!placeId || !requestCoordsOk) {
    try {
      const results = await searchTripPlaces({
        query: name || near,
        type: type || 'other',
        near,
      })
      hit = results?.[0] || null
    } catch {
      hit = null
    }
  }

  const hitCoordsOk = isValidMapCoords(hit?.lat, hit?.lng)
  const resolvedLat = hitCoordsOk ? Number(hit.lat) : (requestCoordsOk ? Number(lat) : null)
  const resolvedLng = hitCoordsOk ? Number(hit.lng) : (requestCoordsOk ? Number(lng) : null)

  const resolved = {
    name: hit?.name || name || 'สถานที่',
    address: hit?.address || address || null,
    lat: resolvedLat,
    lng: resolvedLng,
    placeId: placeId || hit?.externalId || null,
    photoUrl: hit?.photoUrl || null,
    rating: hit?.rating ?? null,
    userRatingCount: hit?.userRatingCount ?? null,
    category: hit?.category || type || null,
    source: hit?.source || null,
  }

  const openUrl = hit?.googleMapsUri || buildGoogleMapsOpenUrl({
    name: resolved.name,
    address: resolved.address,
    destination: near,
    lat: resolved.lat,
    lng: resolved.lng,
    placeId: resolved.placeId,
  })

  // Prefer textual place query for embed so pin matches the found POI card
  const embedUrl = buildGoogleMapsEmbedUrl({
    name: resolved.name,
    address: resolved.address || near,
    destination: near,
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
