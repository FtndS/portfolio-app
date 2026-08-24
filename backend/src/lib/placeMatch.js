/** Match place search results — avoid duplicate photos and generic AI names */

const GENERIC_PATTERNS =
  /แนะนำ[:：]|หรือ|ค้นหา|เช่น|ประมาณ|Airbnb|Agoda|Booking|มื้อเช้า|มื้อกลางวัน|มื้อเย็น|บ้านพักแบบ|โรงแรมหรือ/i

export function isGenericPlaceName(name) {
  const s = String(name || '').trim()
  if (!s) return true
  if (GENERIC_PATTERNS.test(s)) return true
  if (/^ร้าน(ซีฟู้ด|อาหารทะเล|อาหาร)\s*(มื้อ|$)/i.test(s)) return true
  if (/^ร้านซีฟู้ดมื้อ/i.test(s)) return true
  return false
}

function iataFromName(name) {
  const m = /\(([A-Z]{3})\)/.exec(String(name || ''))
  return m?.[1] || null
}

function latinHintFromName(name) {
  const m = /\(([A-Za-z][^)]{2,80})\)/.exec(String(name || ''))
  const inner = m?.[1]?.trim() || ''
  if (!inner || /^\d/.test(inner)) return ''
  if (/^[A-Z]{3}$/.test(inner)) return `${inner} airport`
  return inner
}

export function extractPlaceSearchQuery(name, type, near) {
  const original = String(name || '').trim()
  const nearText = near ? String(near).trim() : ''
  const iata = iataFromName(original)
  if ((type === 'airport' || /สนามบิน|airport/i.test(original)) && iata) {
    return [iata, 'airport', nearText].filter(Boolean).join(' ').slice(0, 160)
  }
  const latin = latinHintFromName(original)
  if (latin && (type === 'airport' || type === 'attraction' || type === 'hotel')) {
    return [latin, nearText].filter(Boolean).join(' ').slice(0, 160)
  }

  let q = original
  if (!q) return nearText

  let extracted = false

  const recommend = /แนะนำ[:：]\s*([^)]+)/i.exec(original)
  if (recommend?.[1]) {
    q = recommend[1].trim()
    extracted = true
  }

  if (!extracted) {
    const paren = /\(([^)]+)\)/.exec(original)
    if (paren?.[1] && isGenericPlaceName(original)) {
      const inner = paren[1].replace(/^แนะนำ[:：]\s*/i, '').trim()
      if (inner.length >= 4 && !/Airbnb|Agoda|Booking/i.test(inner)) {
        q = inner
        extracted = true
      }
    }
  }

  if (!extracted && isGenericPlaceName(original)) {
    const typeHint = {
      restaurant: 'ร้านอาหาร',
      hotel: 'โรงแรม',
      attraction: 'สถานที่ท่องเที่ยว',
      airport: 'สนามบิน',
      transport: 'สถานี',
    }[type]
    if (typeHint && nearText) q = `${typeHint} ${nearText}`
    else if (nearText) q = nearText
  }

  return q.slice(0, 160)
}

function normalizeName(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function scorePlaceNameMatch(query, candidate) {
  const a = normalizeName(query)
  const b = normalizeName(candidate)
  if (!a || !b) return 0
  if (b.includes(a) || a.includes(b)) return 1
  const aw = new Set(a.split(' ').filter((w) => w.length > 1))
  const bw = new Set(b.split(' ').filter((w) => w.length > 1))
  if (!aw.size || !bw.size) return 0
  let overlap = 0
  for (const w of aw) if (bw.has(w)) overlap += 1
  return overlap / Math.max(aw.size, bw.size)
}

export function placeMediaKey(hit) {
  if (!hit) return null
  if (hit.photoUrl) return `photo:${hit.photoUrl}`
  if (hit.photoRef) return `photo:${hit.photoRef}`
  if (hit.externalId) return `ext:${hit.externalId}`
  if (hit.id) return `id:${hit.id}`
  return null
}

function takeUnusedHit(hit, usedKeys) {
  if (!hit) return null
  const key = placeMediaKey(hit)
  if (key && usedKeys.has(key)) return null
  if (key) usedKeys.add(key)
  return hit
}

/** Pick best unused search hit; skip weak matches and duplicate media. */
export function pickUniquePlaceHit(results, query, usedKeys = new Set(), opts = {}) {
  const scored = (results || [])
    .map((hit) => ({ hit, score: scorePlaceNameMatch(query, hit.name) }))
    .filter((x) => x.score >= 0.2)
    .sort((a, b) => b.score - a.score)

  for (const { hit, score } of scored) {
    if (score < 0.35 && isGenericPlaceName(query) && opts.type !== 'airport') continue
    const taken = takeUnusedHit(hit, usedKeys)
    if (taken) return taken
  }

  const typed = opts.type === 'airport' || opts.type === 'hotel' || opts.type === 'attraction'
  if (typed) {
    const withPhoto = (results || []).find((hit) => hit?.photoUrl || hit?.photoRef)
    const taken = takeUnusedHit(withPhoto || results?.[0], usedKeys)
    if (taken) return taken
  }
  return null
}

/** Driving / Grab legs should not steal photo quota. Airports and stations should. */
export function shouldEnrichPlacePhoto(place) {
  if (!place) return false
  if (place.type === 'airport' || place.type === 'hotel' || place.type === 'restaurant' || place.type === 'attraction') {
    return true
  }
  if (place.type !== 'transport') return true
  const text = `${place.name || ''} ${place.notes || ''}`
  if (/grab|taxi|bolt|แท็กซี่/i.test(text)) return false
  if (/โหมด:\s*รถ|ขับรถ|จุดพักรถ|ปั๊ม|ptt/i.test(text) && !/โหมด:\s*บิน|รถไฟ|เรือ/.test(text)) return false
  if (/สนามบิน|airport|สถานี|station|terminal|ท่าอากาศ/i.test(place.name || '')) return true
  return false
}

export function resolvePlaceDisplayName(originalName, hitName) {
  const orig = String(originalName || '').trim()
  const hit = String(hitName || '').trim()
  if (!hit) return orig
  if (!isGenericPlaceName(orig)) return orig
  if (isGenericPlaceName(hit)) return orig
  return hit
}
