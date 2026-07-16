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

export function extractPlaceSearchQuery(name, type, near) {
  const original = String(name || '').trim()
  let q = original
  if (!q) return near ? String(near).trim() : ''

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
    const nearText = near ? String(near).trim() : ''
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

/** Pick best unused search hit; skip weak matches and duplicate media. */
export function pickUniquePlaceHit(results, query, usedKeys = new Set()) {
  const scored = (results || [])
    .map((hit) => ({ hit, score: scorePlaceNameMatch(query, hit.name) }))
    .filter((x) => x.score >= 0.2)
    .sort((a, b) => b.score - a.score)

  for (const { hit, score } of scored) {
    const key = placeMediaKey(hit)
    if (key && usedKeys.has(key)) continue
    if (score < 0.35 && isGenericPlaceName(query)) continue
    if (key) usedKeys.add(key)
    return hit
  }
  return null
}

export function resolvePlaceDisplayName(originalName, hitName) {
  const orig = String(originalName || '').trim()
  const hit = String(hitName || '').trim()
  if (!hit) return orig
  if (!isGenericPlaceName(orig)) return orig
  if (isGenericPlaceName(hit)) return orig
  return hit
}
