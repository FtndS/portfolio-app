/** AI trip planner — normalize Claude JSON + apply to DB */

import { enumerateDateRange, isValidPlaceType, normalizeTripPayload } from './tripHelpers.js'
import { searchTripPlaces } from './placeSearch.js'
import {
  extractPlaceSearchQuery,
  isGenericPlaceName,
  pickUniquePlaceHit,
  resolvePlaceDisplayName,
} from './placeMatch.js'
import { attachBookingLinks, attachBookingLinksToPlan } from './bookingLinks.js'

const MAX_ENRICH = 40
const MAX_DAYS = 14
const MAX_PLACES_PER_DAY = 12

function nullishDate(value) {
  if (value == null || value === '') return null
  const s = String(value).trim().toLowerCase()
  if (!s || s === 'null' || s === 'undefined') return null
  return String(value).trim().slice(0, 10)
}

export function normalizeAiTripPlanMessages(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .slice(-20)
    .map((m) => ({
      role: m?.role === 'assistant' ? 'assistant' : 'user',
      content: String(m?.content || '').trim().slice(0, 4000),
    }))
    .filter((m) => m.content)
}

export function normalizeAiPlanResponse(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'รูปแบบแผนไม่ถูกต้อง' }

  const status = String(raw.status || '').toLowerCase()
  if (status === 'clarify') {
    const questions = Array.isArray(raw.questions)
      ? raw.questions.map((q) => String(q || '').trim()).filter(Boolean).slice(0, 4)
      : []
    if (!questions.length) return { error: 'คำถามชี้แจงว่าง' }
    return { status: 'clarify', questions }
  }

  if (status !== 'plan' || !raw.trip || typeof raw.trip !== 'object') {
    return { error: 'สถานะแผนไม่ถูกต้อง' }
  }

  const tripBody = {
    title: raw.trip.title,
    destination: raw.trip.destination,
    start_date: nullishDate(raw.trip.start_date),
    end_date: nullishDate(raw.trip.end_date),
    notes: raw.trip.notes || 'สร้างโดย AI Trip Planner',
    status: 'planned',
    currency: 'THB',
  }
  const trip = normalizeTripPayload(tripBody)
  if (trip.error) return { error: trip.error }

  let daysIn = Array.isArray(raw.trip.days) ? raw.trip.days.slice(0, MAX_DAYS) : []
  if (!daysIn.length) {
    const dates = enumerateDateRange(trip.start_date, trip.end_date)
    if (dates.length) {
      daysIn = dates.map((_, i) => ({ day_index: i + 1, title: `วันที่ ${i + 1}`, places: [] }))
    } else {
      daysIn = [{ day_index: 1, title: 'วันที่ 1', places: [] }]
    }
  }

  const days = []
  for (let i = 0; i < daysIn.length; i += 1) {
    const d = daysIn[i] || {}
    const placesRaw = Array.isArray(d.places) ? d.places.slice(0, MAX_PLACES_PER_DAY) : []
    const places = []
    for (const p of placesRaw) {
      const name = String(p?.name || '').trim()
      if (!name) continue
      const typeRaw = String(p?.type || 'other').trim().toLowerCase()
      const type = isValidPlaceType(typeRaw) ? typeRaw : 'other'
      places.push({
        type,
        name: name.slice(0, 200),
        address: p?.address != null ? String(p.address).trim().slice(0, 500) || null : null,
        start_time: p?.start_time != null ? String(p.start_time).trim().slice(0, 16) || null : null,
        end_time: p?.end_time != null ? String(p.end_time).trim().slice(0, 16) || null : null,
        notes: p?.notes != null ? String(p.notes).trim().slice(0, 1000) || null : null,
      })
    }
    days.push({
      day_index: Number(d.day_index) || i + 1,
      title: String(d.title || `วันที่ ${i + 1}`).trim().slice(0, 120) || `วันที่ ${i + 1}`,
      places,
    })
  }

  if (!days.some((d) => d.places.length)) {
    return { error: 'แผนไม่มีจุดแวะ' }
  }

  const withHotel = ensureOvernightHotel({
    status: 'plan',
    trip: {
      ...trip,
      days,
    },
  })

  return attachBookingLinksToPlan(withHotel)
}

/** True when trip spans 2+ days or date range has overnight. */
export function isOvernightTrip(trip, days) {
  const dayCount = Array.isArray(days) ? days.length : 0
  if (dayCount >= 2) return true
  const dates = enumerateDateRange(trip?.start_date, trip?.end_date)
  return dates.length >= 2
}

function planHasHotel(days) {
  return (days || []).some((d) => (d.places || []).some((p) => p.type === 'hotel'))
}

function dayHasHotel(day) {
  return (day?.places || []).some((p) => p.type === 'hotel')
}

function makeHotelPlace(destination, nightIndex, nightCount) {
  const dest = String(destination || '').trim() || 'ปลายทาง'
  const isFirst = nightIndex === 0
  const isLastNight = nightIndex === nightCount - 1
  return {
    type: 'hotel',
    name: `โรงแรมใน${dest}`,
    address: null,
    start_time: isFirst ? '15:00' : '20:00',
    end_time: isLastNight ? '11:00' : null,
    notes: isFirst
      ? 'เช็คอิน · ที่พักค้างคืน'
      : (isLastNight ? 'ที่พักค้างคืน · เช็คเอาท์เช้าวันถัดไป' : 'ที่พักค้างคืน'),
  }
}

function insertHotelInDay(day, hotelPlace) {
  const places = [...(day.places || [])]
  const insertAt = places.findIndex((p) => {
    const h = Number(String(p.start_time || '').split(':')[0])
    return Number.isFinite(h) && h >= 14
  })
  if (insertAt >= 0) places.splice(insertAt, 0, hotelPlace)
  else places.push(hotelPlace)
  return { ...day, places: places.slice(0, MAX_PLACES_PER_DAY) }
}

/**
 * Overnight trips need a hotel for each night (day 1 .. day N-1).
 * If AI omitted any, insert a searchable hotel stop that evening.
 */
export function ensureOvernightHotel(plan) {
  if (!plan?.trip?.days?.length) return plan
  const { trip } = plan
  if (!isOvernightTrip(trip, trip.days)) return plan

  const nightCount = Math.max(0, trip.days.length - 1)
  if (nightCount < 1) return plan

  const destination = trip.destination || ''
  let changed = false
  const days = trip.days.map((day, i) => {
    if (i >= nightCount) return day
    if (dayHasHotel(day)) return day
    changed = true
    return insertHotelInDay(day, makeHotelPlace(destination, i, nightCount))
  })

  if (!changed && planHasHotel(trip.days)) return plan
  return { ...plan, trip: { ...trip, days } }
}

async function enrichOnePlace(place, { near, usedKeys }) {
  const searchQ = extractPlaceSearchQuery(place.name, place.type, near)
  if (!searchQ) return place

  try {
    const results = await searchTripPlaces({
      query: searchQ,
      type: place.type || 'other',
      near,
    })
    const hit = pickUniquePlaceHit(results, searchQ, usedKeys)
    if (!hit) return place

    const lat = hit.lat ?? null
    const lng = hit.lng ?? null
    const resolvedName = resolvePlaceDisplayName(place.name, hit.name)

    return {
      ...place,
      name: resolvedName,
      address: place.address || hit.address || null,
      lat: place.lat != null ? place.lat : (lat != null && lng != null ? lat : null),
      lng: place.lng != null ? place.lng : (lat != null && lng != null ? lng : null),
      photo_url: hit.photoUrl || place.photo_url || null,
      external_id: hit.externalId || hit.id || place.external_id || null,
      external_source: hit.source || place.external_source || null,
    }
  } catch {
    return place
  }
}

export async function enrichPlanPlaces(plan, { maxEnrich = MAX_ENRICH } = {}) {
  const near = plan.trip.destination || ''
  const usedKeys = new Set()
  // Ensure overnight hotel exists before enrich so it gets a real POI name/photo
  const ensured = ensureOvernightHotel(plan)
  const dayBuckets = ensured.trip.days.map((day) =>
    (day.places || []).map((place) => ({ ...place }))
  )
  // Prioritize hotels then restaurants in enrichment order within each day
  const priority = { hotel: 0, restaurant: 1, airport: 2, transport: 3, attraction: 4, other: 5 }
  const indices = dayBuckets.map((places) => {
    const order = places
      .map((_, i) => i)
      .sort((a, b) => (priority[places[a].type] ?? 9) - (priority[places[b].type] ?? 9))
    return { order, cursor: 0 }
  })
  let remaining = maxEnrich
  let progressed = true

  while (remaining > 0 && progressed) {
    progressed = false
    for (let d = 0; d < dayBuckets.length && remaining > 0; d += 1) {
      const places = dayBuckets[d]
      const idxState = indices[d]
      if (idxState.cursor >= idxState.order.length) continue
      const i = idxState.order[idxState.cursor]
      idxState.cursor += 1
      progressed = true
      remaining -= 1
      places[i] = await enrichOnePlace(places[i], { near, usedKeys })
    }
  }

  const days = ensured.trip.days.map((day, i) => ({
    ...day,
    places: dayBuckets[i],
  }))

  return attachBookingLinksToPlan({ ...ensured, trip: { ...ensured.trip, days } })
}

function collectUsedMediaKeys(places) {
  const usedKeys = new Set()
  for (const p of places) {
    if (p.photo_url) usedKeys.add(`photo:${p.photo_url}`)
    if (p.external_id) usedKeys.add(`ext:${p.external_source || 'x'}:${p.external_id}`)
  }
  return usedKeys
}

function findDuplicatePhotoPlaceIds(places) {
  const seen = new Map()
  const dupIds = new Set()
  for (const p of places) {
    if (!p.photo_url) continue
    const key = p.photo_url
    if (seen.has(key)) dupIds.add(p.id)
    else seen.set(key, p.id)
  }
  return dupIds
}

/** Enrich DB places — unique photos + resolve generic names to real POIs. */
export async function enrichTripPlacesMissingPhotos(places, { near = '', maxEnrich = 24 } = {}) {
  const usedKeys = collectUsedMediaKeys(places)
  const dupIds = findDuplicatePhotoPlaceIds(places)

  const byDay = new Map()
  for (const p of places) {
    const key = p.trip_day_id || 0
    if (!byDay.has(key)) byDay.set(key, [])
    byDay.get(key).push(p)
  }
  const dayKeys = [...byDay.keys()]
  const queues = dayKeys.map((k) =>
    byDay
      .get(k)
      .filter((p) => !p.photo_url || isGenericPlaceName(p.name) || dupIds.has(p.id))
      .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
  )
  const updated = []
  let remaining = maxEnrich
  let progressed = true
  const cursors = queues.map(() => 0)

  while (remaining > 0 && progressed) {
    progressed = false
    for (let d = 0; d < queues.length && remaining > 0; d += 1) {
      const q = queues[d]
      const i = cursors[d]
      if (i >= q.length) continue
      cursors[d] += 1
      progressed = true
      remaining -= 1
      const place = q[i]
      const localUsed = new Set(usedKeys)
      if (place.photo_url) localUsed.delete(`photo:${place.photo_url}`)
      if (place.external_id) localUsed.delete(`ext:${place.external_source || 'x'}:${place.external_id}`)

      const enriched = await enrichOnePlace(place, { near, usedKeys: localUsed })
      const nameChanged = enriched.name !== place.name
      const photoChanged = enriched.photo_url && enriched.photo_url !== place.photo_url
      if (!nameChanged && !photoChanged) continue

      if (enriched.photo_url) usedKeys.add(`photo:${enriched.photo_url}`)
      if (enriched.external_id) usedKeys.add(`ext:${enriched.external_source || 'x'}:${enriched.external_id}`)

      updated.push({
        id: place.id,
        name: enriched.name,
        photo_url: enriched.photo_url || place.photo_url || null,
        address: enriched.address || place.address || null,
        lat: enriched.lat ?? place.lat ?? null,
        lng: enriched.lng ?? place.lng ?? null,
        external_id: enriched.external_id || place.external_id || null,
        external_source: enriched.external_source || place.external_source || null,
      })
    }
  }

  return updated
}

export async function applyAiTripPlan(client, userId, plan) {
  const withLinks = attachBookingLinksToPlan(plan)
  const { trip } = withLinks
  const tripIns = await client.query(
    `INSERT INTO trips (user_id, title, destination, start_date, end_date, currency, status, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
     RETURNING *`,
    [
      userId,
      trip.title,
      trip.destination,
      trip.start_date,
      trip.end_date,
      trip.currency,
      trip.status,
      trip.notes,
    ]
  )
  const created = tripIns.rows[0]
  const dateList = enumerateDateRange(trip.start_date, trip.end_date)
  const dayRows = []

  for (let i = 0; i < trip.days.length; i += 1) {
    const d = trip.days[i]
    const date = dateList[i] || dateList[dateList.length - 1] || null
    const dayIns = await client.query(
      `INSERT INTO trip_days (trip_id, day_index, date, title)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [created.id, d.day_index || i + 1, date, d.title]
    )
    dayRows.push(dayIns.rows[0])
  }

  const places = []
  const allPlanPlaces = trip.days.flatMap((d) => d.places || [])
  for (let i = 0; i < trip.days.length; i += 1) {
    const dayRow = dayRows[i]
    const dayDate = dateList[i] || dateList[dateList.length - 1] || null
    const dayPlaces = trip.days[i].places || []
    for (let j = 0; j < dayPlaces.length; j += 1) {
      const p = attachBookingLinks(dayPlaces[j], trip.destination || '', {
        trip,
        dayDate,
        allPlaces: allPlanPlaces,
      })
      const placeIns = await client.query(
        `INSERT INTO trip_places
          (trip_id, trip_day_id, type, name, lat, lng, address, photo_url, external_id, external_source,
           start_time, end_time, budget, notes, sort_order, booking_links)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
         RETURNING *`,
        [
          created.id,
          dayRow.id,
          p.type,
          p.name,
          p.lat ?? null,
          p.lng ?? null,
          p.address ?? null,
          p.photo_url ?? null,
          p.external_id ?? null,
          p.external_source ?? null,
          p.start_time ?? null,
          p.end_time ?? null,
          null,
          p.notes ?? null,
          j,
          JSON.stringify(p.booking_links || []),
        ]
      )
      places.push(placeIns.rows[0])
    }
  }

  return { ...created, days: dayRows, places }
}

export function buildTripPlanSystemPrompt() {
  return `คุณเป็นผู้ช่วยวางแผนท่องเที่ยวของ PortDiary สำหรับผู้ใช้ไทย
ตอบเป็น JSON เท่านั้น ไม่มี markdown

ถ้าข้อมูลยังไม่พอ (เมือง/ประเทศปลายทาง จำนวนวัน สไตล์กิน/เที่ยว สนามบินต้นทาง หรืองบคร่าวๆ) ให้ตอบ:
{"status":"clarify","questions":["คำถาม1","คำถาม2"]}
ถามทีละ 2–4 ข้อ เป็นภาษาไทย สุภาพ กระชับ

เมื่อข้อมูลพอแล้ว ให้ตอบ:
{"status":"plan","trip":{
  "title":"...",
  "destination":"...",
  "start_date":"YYYY-MM-DD หรือ null",
  "end_date":"YYYY-MM-DD หรือ null",
  "notes":"...",
  "days":[{
    "day_index":1,
    "title":"วันที่ 1",
    "places":[{
      "type":"airport|hotel|restaurant|attraction|transport|other",
      "name":"ชื่อสถานที่จริง",
      "address":"ถ้าทราบ",
      "start_time":"09:00",
      "end_time":"11:00",
      "notes":"สั้นๆ"
    }]
  }]
}}

กฎแผน (เรียงความสำคัญ):
1) ทริปค้างคืน: ทุกคืนต้องมี type "hotel" (เช่น 3 วัน 2 คืน = มี hotel ในวันที่ 1 และวันที่ 2) ชื่อโรงแรมจริง
2) ห้ามส่งแผนที่มีแค่เที่ยวบิน/รถโดยไม่มีที่พัก เมื่อเป็นการค้างคืน
3) ต้องมีร้านอาหาร (restaurant) อย่างน้อยวันละ 1 จุด ชื่อร้านจริง
4) ถ้าบิน: มีสนามบิน/เที่ยวบิน — ถ้าขับรถไปเอง: ใช้ type transport โหมดรถ ห้ามบังคับใส่สนามบิน
5) ขาเดินทาง (type transport) เมื่อต้องเดินทางระหว่างเมือง — พร้อม start_time/end_time
- ชื่อขาเดินทางใช้รูปแบบชัดเจน เช่น "เที่ยวบิน กรุงเทพ–ภูเก็ต" / "ขับรถ กรุงเทพ–ภูเก็ต"
- ใน notes ของ transport ให้ขึ้นต้นด้วย "โหมด: บิน" หรือ "โหมด: รถไฟ" หรือ "โหมด: เรือ" หรือ "โหมด: รถ"
- ถ้าโหมดบิน: ใน notes เพิ่ม "จาก:XXX ถึง:YYY" โดย XXX/YYY เป็นรหัสสนามบิน IATA (เช่น จาก:DMK ถึง:CNX) หรือใช้ชื่อเมืองชัดในชื่อ เช่น "เที่ยวบิน กรุงเทพ–เชียงใหม่"
- เรียงสถานที่ตามเวลาจริงในวัน (เช้า→เย็น) hotel ค้างคืนอยู่ช่วงเย็น
- ชื่อสถานที่ต้องเป็นชื่อจริงที่ค้นหาได้
- ห้ามใช้คำว่า แนะนำ / หรือ / ค้นหา / เช่น ในชื่อสถานที่
- วันละไม่เกิน 6–8 จุด notes สั้นมาก (ไม่เกิน 1 ประโยค)
- ห้ามใส่ URL หรือลิงก์จองใน JSON
- เป็นแผนแนะนำเท่านั้น ห้ามอ้างว่าจองแล้วหรือราคาการันตี
- ใช้ภาษาไทยใน title/notes ได้`
}
