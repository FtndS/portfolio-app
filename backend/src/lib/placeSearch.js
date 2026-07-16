/** Place search for Trip Planner — Google Places (optional) + Nominatim fallback */

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org/search'
const GOOGLE_PLACES_SEARCH = 'https://places.googleapis.com/v1/places:searchText'
const GOOGLE_PHOTO_MEDIA = 'https://places.googleapis.com/v1'

const TYPE_HINTS = {
  hotel: ['hotel', 'resort', 'hostel', 'lodging'],
  restaurant: ['restaurant', 'cafe', 'food'],
  airport: ['airport', 'สนามบิน'],
  attraction: ['attraction', 'museum', 'temple', 'วัด', 'สถานที่ท่องเที่ยว'],
  transport: ['train station', 'bus station', 'bts', 'mrt'],
  other: [],
}

const GOOGLE_TYPE_HINTS = {
  hotel: 'lodging',
  restaurant: 'restaurant',
  airport: 'airport',
  attraction: 'tourist_attraction',
  transport: 'transit_station',
}

function getGoogleKey() {
  return process.env.GOOGLE_PLACES_API_KEY?.trim() || ''
}

export function isGooglePlacesConfigured() {
  return !!getGoogleKey()
}

export function buildQuery(query, type, near) {
  const q = String(query || '').trim()
  const hints = TYPE_HINTS[type] || TYPE_HINTS.other
  const hint = hints[0] || ''
  const nearText = near ? String(near).trim() : ''
  if (!q && !nearText) return ''
  if (!q) return hint ? `${hint} ${nearText}` : nearText
  if (nearText && !q.toLowerCase().includes(nearText.toLowerCase())) {
    return hint ? `${q} ${hint} ${nearText}` : `${q} ${nearText}`
  }
  return hint && !q.toLowerCase().includes(hint) ? `${q} ${hint}` : q
}

async function fetchJson(url, options = {}, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const timer = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: ctrl.signal })
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

async function wikipediaThumbFromTag(tag) {
  if (!tag) return null
  const page = String(tag).replace(/^[^:]+:/, '').trim()
  if (!page) return null
  const data = await fetchJson(
    `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(page)}`,
    { headers: { Accept: 'application/json' } },
    8000
  )
  return data?.thumbnail?.source || data?.originalimage?.source || null
}

async function enrichNominatimPhoto(item) {
  const extratags = item.extratags || {}
  if (extratags.image) return String(extratags.image)
  if (extratags['image:url']) return String(extratags['image:url'])
  if (item.wikipedia) return wikipediaThumbFromTag(item.wikipedia)
  if (extratags.wikidata) {
    const wd = await fetchJson(
      `https://www.wikidata.org/wiki/Special:EntityData/${encodeURIComponent(extratags.wikidata)}.json`,
      {},
      8000
    )
    const entity = wd?.entities?.[extratags.wikidata]
    const enLabel = entity?.sitelinks?.enwiki?.title
    if (enLabel) return wikipediaThumbFromTag(enLabel)
  }
  return null
}

function mapNominatimItem(item, inferredType) {
  const lat = Number(item.lat)
  const lng = Number(item.lon)
  return {
    id: `osm:${item.osm_type || 'node'}:${item.osm_id || item.place_id}`,
    source: 'osm',
    name: item.display_name?.split(',')[0]?.trim() || item.name || 'สถานที่',
    address: item.display_name || null,
    lat: Number.isFinite(lat) ? lat : null,
    lng: Number.isFinite(lng) ? lng : null,
    type: inferredType,
    photoUrl: null,
    category: item.type || item.class || null,
  }
}

async function searchNominatim({ query, type, near }) {
  const q = buildQuery(query, type, near)
  if (!q) return []

  const params = new URLSearchParams({
    q,
    format: 'json',
    addressdetails: '1',
    extratags: '1',
    namedetails: '1',
    limit: '12',
    'accept-language': 'th,en',
  })

  const data = await fetchJson(`${NOMINATIM_BASE}?${params}`, {
    headers: {
      Accept: 'application/json',
      'User-Agent': process.env.PLACE_SEARCH_USER_AGENT || 'PortDiary/1.0 (trip-planner)',
    },
  })

  if (!Array.isArray(data)) return []

  const mapped = data.map((item) => mapNominatimItem(item, type))
  const withPhotos = await Promise.all(
    mapped.map(async (place, i) => {
      const photoUrl = await enrichNominatimPhoto(data[i])
      return photoUrl ? { ...place, photoUrl } : place
    })
  )
  return withPhotos
}

function googlePhotoProxyPath(photoName) {
  return `/trips/places/photo?provider=google&name=${encodeURIComponent(photoName)}`
}

async function searchGooglePlaces({ query, type, near }) {
  const key = getGoogleKey()
  if (!key) return []

  const textQuery = buildQuery(query, type, near)
  if (!textQuery) return []

  const body = {
    textQuery,
    languageCode: 'th',
    maxResultCount: 12,
  }
  const includedType = GOOGLE_TYPE_HINTS[type]
  if (includedType) body.includedType = includedType

  let res
  try {
    res = await fetch(GOOGLE_PLACES_SEARCH, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.location,places.photos,places.primaryType,places.types',
      },
      body: JSON.stringify(body),
    })
  } catch {
    return []
  }

  if (!res.ok) return []
  const data = await res.json()
  const places = data?.places || []

  return places.map((p) => {
    const photoName = p.photos?.[0]?.name || null
    return {
      id: `google:${p.id}`,
      source: 'google',
      name: p.displayName?.text || 'สถานที่',
      address: p.formattedAddress || null,
      lat: p.location?.latitude ?? null,
      lng: p.location?.longitude ?? null,
      type,
      photoUrl: photoName ? googlePhotoProxyPath(photoName) : null,
      category: p.primaryType || p.types?.[0] || null,
      externalId: p.id,
      photoRef: photoName,
    }
  })
}

export async function searchTripPlaces({ query, type = 'other', near = '' }) {
  const safeType = TYPE_HINTS[type] ? type : 'other'
  const googleResults = await searchGooglePlaces({ query, type: safeType, near })
  if (googleResults.length) return googleResults

  return searchNominatim({ query, type: safeType, near })
}

export async function fetchGooglePlacePhoto(photoName) {
  const key = getGoogleKey()
  if (!key || !photoName) return null

  const url = `${GOOGLE_PHOTO_MEDIA}/${photoName}/media?maxHeightPx=480&maxWidthPx=720&key=${encodeURIComponent(key)}`
  try {
    const res = await fetch(url, { redirect: 'follow' })
    if (!res.ok) return null
    return {
      contentType: res.headers.get('content-type') || 'image/jpeg',
      buffer: Buffer.from(await res.arrayBuffer()),
    }
  } catch {
    return null
  }
}
