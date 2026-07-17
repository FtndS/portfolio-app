/** Trip helpers — date range days + place types */

import { sanitizeBookingLinks } from './bookingLinks.js'

export const TRIP_PLACE_TYPES = ['hotel', 'restaurant', 'airport', 'attraction', 'transport', 'other']

export function isValidPlaceType(type) {
  return TRIP_PLACE_TYPES.includes(String(type || '').toLowerCase())
}

/** Inclusive list of YYYY-MM-DD between start and end (UTC date parts). */
export function enumerateDateRange(startDate, endDate) {
  if (!startDate || !endDate) return []
  const start = parseDateOnly(startDate)
  const end = parseDateOnly(endDate)
  if (!start || !end || end < start) return []

  const out = []
  const cur = new Date(start.getTime())
  while (cur <= end) {
    out.push(formatDateOnly(cur))
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return out
}

function parseDateOnly(value) {
  const s = String(value).slice(0, 10)
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  if (!m) return null
  const y = Number(m[1])
  const mo = Number(m[2])
  const d = Number(m[3])
  const dt = new Date(Date.UTC(y, mo - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d) return null
  return dt
}

function formatDateOnly(dt) {
  const y = dt.getUTCFullYear()
  const m = String(dt.getUTCMonth() + 1).padStart(2, '0')
  const d = String(dt.getUTCDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toDateOnlyString(value) {
  if (value == null || value === '') return null
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return formatDateOnly(new Date(Date.UTC(value.getFullYear(), value.getMonth(), value.getDate())))
  }
  const s = String(value).slice(0, 10)
  return parseDateOnly(s) ? s : null
}

export function normalizeTripPayload(body = {}) {
  const title = String(body.title || '').trim()
  const origin = String(body.origin || '').trim() || null
  const destination = String(body.destination || '').trim() || null
  const startRaw = body.start_date !== undefined ? body.start_date : body.startDate
  const endRaw = body.end_date !== undefined ? body.end_date : body.endDate
  const startDate = startRaw != null && startRaw !== '' ? toDateOnlyString(startRaw) : null
  const endDate = endRaw != null && endRaw !== '' ? toDateOnlyString(endRaw) : null
  if (startRaw != null && startRaw !== '' && !startDate) return { error: 'วันเริ่มต้นไม่ถูกต้อง' }
  if (endRaw != null && endRaw !== '' && !endDate) return { error: 'วันสิ้นสุดไม่ถูกต้อง' }
  const currency = String(body.currency || 'THB').trim().toUpperCase().slice(0, 3) || 'THB'
  const notes = body.notes != null ? String(body.notes).trim() || null : null
  const status = String(body.status || 'draft').trim().toLowerCase() || 'draft'

  if (!title) return { error: 'กรุณาระบุชื่อทริป' }
  if (startDate && endDate && parseDateOnly(endDate) < parseDateOnly(startDate)) {
    return { error: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น' }
  }
  if (!['draft', 'planned', 'done', 'archived'].includes(status)) {
    return { error: 'สถานะทริปไม่ถูกต้อง' }
  }

  return {
    title,
    origin,
    destination,
    start_date: startDate,
    end_date: endDate,
    currency,
    notes,
    status,
  }
}

export function normalizePlacePayload(body = {}) {
  const name = String(body.name || '').trim()
  const typeRaw = String(body.type || 'other').trim().toLowerCase()
  const type = isValidPlaceType(typeRaw) ? typeRaw : null
  if (!name) return { error: 'กรุณาระบุชื่อสถานที่' }
  if (!type) return { error: 'ประเภทสถานที่ไม่ถูกต้อง' }

  const lat = body.lat === '' || body.lat == null ? null : Number(body.lat)
  const lng = body.lng === '' || body.lng == null ? null : Number(body.lng)
  if (lat != null && Number.isNaN(lat)) return { error: 'ละติจูดไม่ถูกต้อง' }
  if (lng != null && Number.isNaN(lng)) return { error: 'ลองจิจูดไม่ถูกต้อง' }
  if ((lat == null) !== (lng == null)) return { error: 'ต้องใส่ละติจูดและลองจิจูดคู่กัน' }

  const budget = body.budget === '' || body.budget == null ? null : Number(body.budget)
  if (budget != null && Number.isNaN(budget)) return { error: 'งบประมาณไม่ถูกต้อง' }

  const tripDayId = body.trip_day_id == null || body.trip_day_id === ''
    ? null
    : Number(body.trip_day_id)
  if (tripDayId != null && Number.isNaN(tripDayId)) return { error: 'วันทริปไม่ถูกต้อง' }

  const photoUrl = body.photo_url != null ? String(body.photo_url).trim() || null : null
  const externalId = body.external_id != null ? String(body.external_id).trim() || null : null
  const externalSource = body.external_source != null ? String(body.external_source).trim().slice(0, 32) || null : null
  const bookingLinks = body.booking_links !== undefined
    ? sanitizeBookingLinks(body.booking_links)
    : undefined

  return {
    trip_day_id: tripDayId,
    type,
    name,
    lat,
    lng,
    address: body.address != null ? String(body.address).trim() || null : null,
    photo_url: photoUrl,
    external_id: externalId,
    external_source: externalSource,
    start_time: body.start_time != null ? String(body.start_time).trim().slice(0, 16) || null : null,
    end_time: body.end_time != null ? String(body.end_time).trim().slice(0, 16) || null : null,
    budget,
    notes: body.notes != null ? String(body.notes).trim() || null : null,
    sort_order: body.sort_order == null || body.sort_order === '' ? 0 : Number(body.sort_order) || 0,
    ...(bookingLinks !== undefined ? { booking_links: bookingLinks } : {}),
  }
}

/** Validate reorder payload: day_id + ordered place_ids for one day. */
export function normalizeReorderPayload(body = {}) {
  const dayId = body.day_id == null || body.day_id === '' ? null : Number(body.day_id)
  if (dayId == null || Number.isNaN(dayId)) return { error: 'วันทริปไม่ถูกต้อง' }

  const rawIds = Array.isArray(body.place_ids) ? body.place_ids : null
  if (!rawIds || !rawIds.length) return { error: 'รายการจุดแวะว่าง' }

  const placeIds = rawIds.map((id) => Number(id))
  if (placeIds.some((id) => Number.isNaN(id))) return { error: 'รหัสจุดแวะไม่ถูกต้อง' }
  if (new Set(placeIds).size !== placeIds.length) return { error: 'รหัสจุดแวะซ้ำ' }

  return { day_id: dayId, place_ids: placeIds }
}
