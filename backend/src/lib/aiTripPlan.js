/** AI trip planner — normalize Claude JSON + apply to DB */

import { enumerateDateRange, isValidPlaceType, normalizeTripPayload } from './tripHelpers.js'
import { searchTripPlaces } from './placeSearch.js'

const MAX_ENRICH = 8
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

  return {
    status: 'plan',
    trip: {
      ...trip,
      days,
    },
  }
}

export async function enrichPlanPlaces(plan, { maxEnrich = MAX_ENRICH } = {}) {
  const near = plan.trip.destination || ''
  let budget = maxEnrich
  const days = []

  for (const day of plan.trip.days) {
    const places = []
    for (const place of day.places) {
      let enriched = { ...place }
      if (budget > 0) {
        budget -= 1
        try {
          const results = await searchTripPlaces({
            query: place.name,
            type: place.type,
            near,
          })
          const hit = results?.[0]
          if (hit) {
            const lat = hit.lat ?? null
            const lng = hit.lng ?? null
            enriched = {
              ...enriched,
              address: enriched.address || hit.address || null,
              lat: lat != null && lng != null ? lat : null,
              lng: lat != null && lng != null ? lng : null,
              photo_url: hit.photoUrl || null,
              external_id: hit.externalId || hit.id || null,
              external_source: hit.source || null,
            }
          }
        } catch {
          // keep name-only place
        }
      }
      places.push(enriched)
    }
    days.push({ ...day, places })
  }

  return { ...plan, trip: { ...plan.trip, days } }
}

export async function applyAiTripPlan(client, userId, plan) {
  const { trip } = plan
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
  for (let i = 0; i < trip.days.length; i += 1) {
    const dayRow = dayRows[i]
    const dayPlaces = trip.days[i].places || []
    for (let j = 0; j < dayPlaces.length; j += 1) {
      const p = dayPlaces[j]
      const placeIns = await client.query(
        `INSERT INTO trip_places
          (trip_id, trip_day_id, type, name, lat, lng, address, photo_url, external_id, external_source,
           start_time, end_time, budget, notes, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15)
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

กฎแผน:
- ต้องมีสนามบินเข้า/ออก (type airport) ตามความเหมาะสมของทริป
- ต้องมีที่พัก (hotel) และร้านอาหาร (restaurant) อย่างน้อยวันละรายการเมื่อเป็นทริปหลายวัน
- ชื่อสถานที่ควรเป็นชื่อจริงที่ค้นหาได้
- เป็นแผนแนะนำเท่านั้น ห้ามอ้างว่าจองแล้วหรือราคาการันตี
- ใช้ภาษาไทยใน title/notes ได้`
}
