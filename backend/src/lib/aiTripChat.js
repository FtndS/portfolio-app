/** In-trip AI chat — advise and propose safe plan edits (not full trip recreate). */

import { isValidPlaceType, normalizePlacePayload } from './tripHelpers.js'
import { attachBookingLinks } from './bookingLinks.js'
import { normalizeAiTripPlanMessages } from './aiTripPlan.js'

const MAX_ACTIONS = 8
const ALLOWED_ACTION_TYPES = new Set([
  'add_place',
  'remove_place',
  'update_place',
  'set_day_title',
])

export { normalizeAiTripPlanMessages as normalizeTripChatMessages }

export function buildTripChatContext(trip) {
  if (!trip) return ''
  const days = [...(trip.days || [])].sort((a, b) => (a.day_index || 0) - (b.day_index || 0))
  const places = trip.places || []
  const byDay = new Map()
  for (const d of days) byDay.set(d.id, [])
  const unassigned = []
  for (const p of places) {
    if (p.trip_day_id && byDay.has(p.trip_day_id)) byDay.get(p.trip_day_id).push(p)
    else unassigned.push(p)
  }

  const lines = [
    `trip_id: ${trip.id}`,
    `title: ${trip.title || ''}`,
    `origin: ${trip.origin || ''}`,
    `destination: ${trip.destination || ''}`,
    `dates: ${trip.start_date || '?'} – ${trip.end_date || '?'}`,
    `currency: ${trip.currency || 'THB'}`,
  ]

  for (const d of days) {
    lines.push(`Day ${d.day_index} [day_id=${d.id}] ${d.title || ''} (${d.date || 'no-date'})`)
    const list = (byDay.get(d.id) || []).sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
    for (const p of list) {
      const time = [p.start_time, p.end_time].filter(Boolean).join('-') || '—'
      lines.push(
        `  - place_id=${p.id} type=${p.type} ${time} | ${p.name}${p.budget != null ? ` | budget=${p.budget}` : ''}`
      )
    }
  }
  if (unassigned.length) {
    lines.push('Unassigned places:')
    for (const p of unassigned) {
      lines.push(`  - place_id=${p.id} type=${p.type} | ${p.name}`)
    }
  }
  return lines.join('\n').slice(0, 12000)
}

export function buildTripChatSystemPrompt(contextText) {
  return `คุณเป็น Trip Copilot ของ PortDiary ช่วยผู้ใช้ปรับแผนทริปที่มีอยู่แล้ว
ตอบเป็น JSON เท่านั้น ไม่มี markdown

รูปแบบ:
{"status":"reply","reply":"ข้อความภาษาไทยสั้นๆ อธิบายสิ่งที่คิด/จะเปลี่ยน","actions":[]}

actions (ถ้าไม่ต้องแก้แผนให้เป็น []) สูงสุด ${MAX_ACTIONS} รายการ:
- {"type":"add_place","day_index":1,"place":{"type":"restaurant|attraction|hotel|airport|transport|other","name":"...","start_time":"12:00","end_time":"13:30","notes":"...","budget":null,"address":null}}
- {"type":"remove_place","place_id":123}
- {"type":"update_place","place_id":123,"patch":{"name":"...","start_time":"...","end_time":"...","notes":"...","budget":1000,"type":"restaurant"}}
- {"type":"set_day_title","day_index":2,"title":"..."}

กฎ:
1) ใช้ place_id / day_index จากบริบททริปด้านล่างเท่านั้น — ห้ามเดา id
2) ถ้าแค่ตอบคำถาม/แนะนำโดยไม่แก้แผน: actions=[]
3) ถ้าผู้ใช้ขอเพิ่ม/ลบ/ย้ายเวลา: ใส่ actions ที่จำเป็นน้อยที่สุด
4) ชื่อสถานที่ต้องเป็นชื่อจริงที่ค้นหาได้ ห้ามคำว่า แนะนำ/หรือ/ค้นหา ในชื่อ
5) ห้ามใส่ URL ใน JSON
6) reply เป็นภาษาไทย กระชับ 1–4 ประโยค
7) เป็นคำแนะนำเท่านั้น ห้ามอ้างว่าจองแล้วหรือราคาการันตี

แผนปัจจุบัน:
${contextText || '(ว่าง)'}
`
}

function normalizePlaceDraft(raw) {
  if (!raw || typeof raw !== 'object') return null
  const name = String(raw.name || '').trim()
  if (!name) return null
  const typeRaw = String(raw.type || 'other').trim().toLowerCase()
  const type = isValidPlaceType(typeRaw) ? typeRaw : 'other'
  const budgetRaw = raw.budget
  const budget = budgetRaw == null || budgetRaw === '' ? null : Number(budgetRaw)
  return {
    type,
    name: name.slice(0, 200),
    address: raw.address != null ? String(raw.address).trim().slice(0, 500) || null : null,
    start_time: raw.start_time != null ? String(raw.start_time).trim().slice(0, 16) || null : null,
    end_time: raw.end_time != null ? String(raw.end_time).trim().slice(0, 16) || null : null,
    notes: raw.notes != null ? String(raw.notes).trim().slice(0, 1000) || null : null,
    budget: Number.isFinite(budget) && budget >= 0 ? budget : null,
  }
}

function normalizePatch(raw) {
  if (!raw || typeof raw !== 'object') return null
  const patch = {}
  if (raw.name != null) {
    const name = String(raw.name).trim().slice(0, 200)
    if (name) patch.name = name
  }
  if (raw.type != null) {
    const typeRaw = String(raw.type).trim().toLowerCase()
    if (isValidPlaceType(typeRaw)) patch.type = typeRaw
  }
  if (raw.address != null) patch.address = String(raw.address).trim().slice(0, 500) || null
  if (raw.start_time != null) patch.start_time = String(raw.start_time).trim().slice(0, 16) || null
  if (raw.end_time != null) patch.end_time = String(raw.end_time).trim().slice(0, 16) || null
  if (raw.notes != null) patch.notes = String(raw.notes).trim().slice(0, 1000) || null
  if (raw.budget != null && raw.budget !== '') {
    const n = Number(raw.budget)
    if (Number.isFinite(n) && n >= 0) patch.budget = n
  }
  return Object.keys(patch).length ? patch : null
}

export function normalizeTripChatResponse(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'รูปแบบตอบไม่ถูกต้อง' }
  const reply = String(raw.reply || '').trim().slice(0, 4000)
  if (!reply) return { error: 'ข้อความตอบว่าง' }

  const actionsIn = Array.isArray(raw.actions) ? raw.actions.slice(0, MAX_ACTIONS) : []
  const actions = []
  for (const a of actionsIn) {
    const type = String(a?.type || '').trim()
    if (!ALLOWED_ACTION_TYPES.has(type)) continue

    if (type === 'add_place') {
      const dayIndex = Number(a.day_index)
      const place = normalizePlaceDraft(a.place)
      if (!Number.isFinite(dayIndex) || dayIndex < 1 || !place) continue
      actions.push({ type, day_index: dayIndex, place })
      continue
    }
    if (type === 'remove_place') {
      const placeId = Number(a.place_id)
      if (!Number.isFinite(placeId)) continue
      actions.push({ type, place_id: placeId })
      continue
    }
    if (type === 'update_place') {
      const placeId = Number(a.place_id)
      const patch = normalizePatch(a.patch)
      if (!Number.isFinite(placeId) || !patch) continue
      actions.push({ type, place_id: placeId, patch })
      continue
    }
    if (type === 'set_day_title') {
      const dayIndex = Number(a.day_index)
      const title = String(a.title || '').trim().slice(0, 120)
      if (!Number.isFinite(dayIndex) || dayIndex < 1 || !title) continue
      actions.push({ type, day_index: dayIndex, title })
    }
  }

  return { status: 'reply', reply, actions }
}

export async function applyTripChatActions(client, trip, days, places, actions) {
  const dayByIndex = new Map(days.map((d) => [Number(d.day_index), d]))
  const placeById = new Map(places.map((p) => [Number(p.id), p]))
  const applied = []

  for (const action of actions || []) {
    if (action.type === 'add_place') {
      const day = dayByIndex.get(Number(action.day_index))
      if (!day) continue
      const parsed = normalizePlacePayload({
        ...action.place,
        trip_day_id: day.id,
      })
      if (parsed.error) continue
      const sortR = await client.query(
        `SELECT COALESCE(MAX(sort_order), -1) + 1 AS next
         FROM trip_places WHERE trip_id = $1 AND trip_day_id IS NOT DISTINCT FROM $2`,
        [trip.id, day.id]
      )
      const sortOrder = sortR.rows[0]?.next ?? 0
      const withLinks = attachBookingLinks(
        { ...parsed, sort_order: sortOrder },
        trip.destination || '',
        { trip, dayDate: day.date || null, allPlaces: places }
      )
      const ins = await client.query(
        `INSERT INTO trip_places
          (trip_id, trip_day_id, type, name, lat, lng, address, photo_url, external_id, external_source,
           start_time, end_time, budget, notes, sort_order, booking_links)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
         RETURNING *`,
        [
          trip.id,
          day.id,
          withLinks.type,
          withLinks.name,
          withLinks.lat ?? null,
          withLinks.lng ?? null,
          withLinks.address ?? null,
          withLinks.photo_url ?? null,
          withLinks.external_id ?? null,
          withLinks.external_source ?? null,
          withLinks.start_time ?? null,
          withLinks.end_time ?? null,
          withLinks.budget ?? null,
          withLinks.notes ?? null,
          sortOrder,
          JSON.stringify(withLinks.booking_links || []),
        ]
      )
      places.push(ins.rows[0])
      placeById.set(Number(ins.rows[0].id), ins.rows[0])
      applied.push({ type: 'add_place', place_id: ins.rows[0].id })
      continue
    }

    if (action.type === 'remove_place') {
      const place = placeById.get(Number(action.place_id))
      if (!place) continue
      await client.query('DELETE FROM trip_places WHERE id = $1 AND trip_id = $2', [place.id, trip.id])
      placeById.delete(Number(place.id))
      applied.push({ type: 'remove_place', place_id: place.id })
      continue
    }

    if (action.type === 'update_place') {
      const place = placeById.get(Number(action.place_id))
      if (!place) continue
      const patch = action.patch || {}
      const next = {
        type: patch.type ?? place.type,
        name: patch.name ?? place.name,
        address: patch.address !== undefined ? patch.address : place.address,
        start_time: patch.start_time !== undefined ? patch.start_time : place.start_time,
        end_time: patch.end_time !== undefined ? patch.end_time : place.end_time,
        notes: patch.notes !== undefined ? patch.notes : place.notes,
        budget: patch.budget !== undefined ? patch.budget : place.budget,
      }
      const upd = await client.query(
        `UPDATE trip_places
         SET type = $1, name = $2, address = $3, start_time = $4, end_time = $5, notes = $6, budget = $7
         WHERE id = $8 AND trip_id = $9
         RETURNING *`,
        [
          next.type,
          next.name,
          next.address,
          next.start_time,
          next.end_time,
          next.notes,
          next.budget,
          place.id,
          trip.id,
        ]
      )
      if (upd.rows[0]) {
        placeById.set(Number(place.id), upd.rows[0])
        applied.push({ type: 'update_place', place_id: place.id })
      }
      continue
    }

    if (action.type === 'set_day_title') {
      const day = dayByIndex.get(Number(action.day_index))
      if (!day) continue
      const upd = await client.query(
        `UPDATE trip_days SET title = $1 WHERE id = $2 AND trip_id = $3 RETURNING *`,
        [action.title, day.id, trip.id]
      )
      if (upd.rows[0]) {
        dayByIndex.set(Number(day.day_index), upd.rows[0])
        applied.push({ type: 'set_day_title', day_id: day.id })
      }
    }
  }

  return applied
}
