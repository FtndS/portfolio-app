/** Day-overview map helpers — keep in sync with backend googleMaps.isValidMapCoords */

/** Approx IATA centers — reject stored pins that land in the wrong country. */
export const AIRPORT_IATA_COORDS = {
  BKK: [13.6900, 100.7501],
  DMK: [13.9126, 100.6067],
  HKT: [8.1132, 98.3169],
  CNX: [18.7669, 98.9626],
  NRT: [35.7720, 140.3929],
  HND: [35.5494, 139.7798],
  KIX: [34.4347, 135.2441],
  ITM: [34.7855, 135.4382],
  SIN: [1.3644, 103.9915],
  ICN: [37.4602, 126.4407],
}

export function extractIataCode(name = '') {
  const m = /\(([A-Z]{3})\)/.exec(String(name || ''))
  return m?.[1] || null
}

export function isValidMapCoords(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false
  if (Math.abs(la) < 0.01 && Math.abs(ln) < 0.01) return false
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return false
  return true
}

export function coordsDistanceKm(lat1, lng1, lat2, lng2) {
  if (!isValidMapCoords(lat1, lng1) || !isValidMapCoords(lat2, lng2)) return Infinity
  const toRad = (d) => (Number(d) * Math.PI) / 180
  const R = 6371
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2
    + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Prefer known IATA coords when stored lat/lng is far from that airport. */
export function effectivePlaceCoords(place) {
  if (!place) return null
  const code = extractIataCode(place.name)
  const known = code && AIRPORT_IATA_COORDS[code]
  const storedOk = isValidMapCoords(place.lat, place.lng)
  if (known) {
    if (!storedOk || coordsDistanceKm(place.lat, place.lng, known[0], known[1]) > 80) {
      return { lat: known[0], lng: known[1], corrected: true, iata: code }
    }
  }
  if (!storedOk) return null
  return { lat: Number(place.lat), lng: Number(place.lng), corrected: false, iata: code }
}

export function showPlaceOnMap(place) {
  if (!place) return false
  if (place.type === 'transport') {
    const text = `${place.name || ''} ${place.notes || ''}`
    if (/grab|taxi|bolt|แท็กซี่/i.test(text)) return false
    if (/โหมด:\s*รถ|ขับรถ|จุดพักรถ|ปั๊ม|ptt/i.test(text) && !/โหมด:\s*บิน|รถไฟ|เรือ/.test(text)) {
      return false
    }
    return /สนามบิน|airport|สถานี|station|terminal|ท่าอากาศ/i.test(text)
  }
  return true
}

export function mappableDayPlaces(places) {
  return (places || [])
    .filter((p) => showPlaceOnMap(p) && effectivePlaceCoords(p))
    .map((p) => {
      const c = effectivePlaceCoords(p)
      return { ...p, lat: c.lat, lng: c.lng, _coordsCorrected: c.corrected }
    })
}

export function unmappedDayPlaces(places) {
  return (places || []).filter(
    (p) => showPlaceOnMap(p) && !effectivePlaceCoords(p)
  )
}

function maxPairDistanceKm(pts) {
  let max = 0
  for (let i = 0; i < pts.length; i += 1) {
    for (let j = i + 1; j < pts.length; j += 1) {
      max = Math.max(max, coordsDistanceKm(pts[i].lat, pts[i].lng, pts[j].lat, pts[j].lng))
    }
  }
  return max
}

export function buildDayOverviewEmbedUrl({ places = [], destination = '', focus = null } = {}) {
  const focusCoords = focus ? effectivePlaceCoords(focus) : null
  if (focusCoords) {
    const iata = focusCoords.iata
    // Name/IATA query is more reliable than stale wrong lat/lng for airports
    if (iata) {
      return `https://www.google.com/maps?q=${encodeURIComponent(`${iata} Airport`)}&z=14&hl=th&output=embed`
    }
    return `https://www.google.com/maps?q=${Number(focusCoords.lat)},${Number(focusCoords.lng)}&z=15&hl=th&output=embed`
  }

  const pts = mappableDayPlaces(places)
  if (pts.length === 1) {
    const iata = extractIataCode(pts[0].name)
    if (iata) {
      return `https://www.google.com/maps?q=${encodeURIComponent(`${iata} Airport`)}&z=14&hl=th&output=embed`
    }
    return `https://www.google.com/maps?q=${Number(pts[0].lat)},${Number(pts[0].lng)}&z=14&hl=th&output=embed`
  }
  if (pts.length >= 2) {
    // Cross-country days (BKK → Tokyo hotel): don't draw a bogus route; show destination
    if (maxPairDistanceKm(pts) > 400) {
      const destName = String(destination || '').trim()
      if (destName) {
        return `https://www.google.com/maps?q=${encodeURIComponent(destName)}&z=11&hl=th&output=embed`
      }
      // Fall back to last pin (usually destination city)
      const last = pts[pts.length - 1]
      return `https://www.google.com/maps?q=${Number(last.lat)},${Number(last.lng)}&z=12&hl=th&output=embed`
    }
    const origin = `${Number(pts[0].lat)},${Number(pts[0].lng)}`
    const last = pts[pts.length - 1]
    const dest = `${Number(last.lat)},${Number(last.lng)}`
    const via = pts
      .slice(1, -1)
      .slice(0, 8)
      .map((p) => `${Number(p.lat)},${Number(p.lng)}`)
      .join('+to:')
    const daddr = via ? `${via}+to:${dest}` : dest
    return `https://www.google.com/maps?saddr=${origin}&daddr=${daddr}&hl=th&output=embed`
  }

  const destName = String(destination || '').trim()
  if (destName) {
    return `https://www.google.com/maps?q=${encodeURIComponent(destName)}&z=11&hl=th&output=embed`
  }
  return null
}
