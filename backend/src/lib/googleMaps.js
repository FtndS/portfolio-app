/** Build Google Maps open/embed URLs for trip place focus */

function getMapsKey() {
  // Only use an explicit Embed key — Places keys often lack Maps Embed API
  return process.env.GOOGLE_MAPS_EMBED_API_KEY?.trim() || ''
}

function buildQueryText({ name, address, destination, lat, lng }) {
  if (Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))) {
    return `${Number(lat)},${Number(lng)}`
  }
  return [name, address, destination].map((s) => String(s || '').trim()).filter(Boolean).join(', ')
}

/** Public Google Maps link (opens full Google Maps UI). */
export function buildGoogleMapsOpenUrl({ name, address, destination, lat, lng, placeId }) {
  if (placeId) {
    const q = encodeURIComponent(String(name || address || destination || 'place'))
    return `https://www.google.com/maps/search/?api=1&query=${q}&query_place_id=${encodeURIComponent(placeId)}`
  }
  const query = buildQueryText({ name, address, destination, lat, lng })
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query || 'Thailand')}`
}

/**
 * Embeddable map URL.
 * Prefers Maps Embed API when key is available; otherwise uses q=…&output=embed.
 */
export function buildGoogleMapsEmbedUrl({ name, address, destination, lat, lng, placeId }) {
  const key = getMapsKey()
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))

  if (key) {
    let q
    if (placeId) q = `place_id:${placeId}`
    else if (hasCoords) q = `${Number(lat)},${Number(lng)}`
    else q = buildQueryText({ name, address, destination, lat, lng })
    if (!q) q = 'Thailand'
    return `https://www.google.com/maps/embed/v1/place?key=${encodeURIComponent(key)}&q=${encodeURIComponent(q)}&language=th&zoom=15`
  }

  if (hasCoords) {
    return `https://www.google.com/maps?q=${Number(lat)},${Number(lng)}&z=16&hl=th&output=embed`
  }
  const q = buildQueryText({ name, address, destination, lat, lng }) || 'Thailand'
  return `https://www.google.com/maps?q=${encodeURIComponent(q)}&z=15&hl=th&output=embed`
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
  const hasCoords = Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))

  if (!placeId || !hasCoords) {
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

  const resolved = {
    name: hit?.name || name || 'สถานที่',
    address: hit?.address || address || null,
    lat: hasCoords ? Number(lat) : (hit?.lat ?? null),
    lng: hasCoords ? Number(lng) : (hit?.lng ?? null),
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

  const embedUrl = buildGoogleMapsEmbedUrl({
    name: resolved.name,
    address: resolved.address,
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
