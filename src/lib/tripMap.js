/** Day-overview map helpers — keep in sync with backend googleMaps.isValidMapCoords */

export function isValidMapCoords(lat, lng) {
  const la = Number(lat)
  const ln = Number(lng)
  if (!Number.isFinite(la) || !Number.isFinite(ln)) return false
  if (Math.abs(la) < 0.01 && Math.abs(ln) < 0.01) return false
  if (la < -90 || la > 90 || ln < -180 || ln > 180) return false
  return true
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
  return (places || []).filter(
    (p) => showPlaceOnMap(p) && isValidMapCoords(p.lat, p.lng)
  )
}

export function unmappedDayPlaces(places) {
  return (places || []).filter(
    (p) => showPlaceOnMap(p) && !isValidMapCoords(p.lat, p.lng)
  )
}

export function buildDayOverviewEmbedUrl({ places = [], destination = '', focus = null } = {}) {
  if (focus && isValidMapCoords(focus.lat, focus.lng)) {
    return `https://www.google.com/maps?q=${Number(focus.lat)},${Number(focus.lng)}&z=15&hl=th&output=embed`
  }

  const pts = mappableDayPlaces(places)
  if (pts.length === 1) {
    return `https://www.google.com/maps?q=${Number(pts[0].lat)},${Number(pts[0].lng)}&z=14&hl=th&output=embed`
  }
  if (pts.length >= 2) {
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
