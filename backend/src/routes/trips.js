import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { placeSearchLimiter } from '../middleware/rateLimit.js'
import { serverError } from '../lib/httpErrors.js'
import {
  fetchGooglePlacePhoto,
  isGooglePlacesConfigured,
  searchTripPlaces,
} from '../lib/placeSearch.js'
import { resolveTripPlaceMap } from '../lib/googleMaps.js'
import { enrichTripPlacesMissingPhotos } from '../lib/aiTripPlan.js'
import { isGenericPlaceName } from '../lib/placeMatch.js'
import {
  enumerateDateRange,
  normalizePlacePayload,
  normalizeReorderPayload,
  normalizeTripPayload,
} from '../lib/tripHelpers.js'
import { attachBookingLinks, sanitizeBookingLinks } from '../lib/bookingLinks.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/places/search', placeSearchLimiter, async (req, res) => {
  const q = String(req.query.q || '').trim()
  const type = String(req.query.type || 'other').trim()
  const near = String(req.query.near || '').trim()
  if (q.length < 2 && near.length < 2) {
    return res.status(400).json({ error: 'พิมพ์คำค้นหาอย่างน้อย 2 ตัวอักษร หรือระบุปลายทางทริป' })
  }

  try {
    const results = await searchTripPlaces({ query: q, type, near })
    res.json({
      results,
      provider: isGooglePlacesConfigured() ? 'google' : 'osm',
    })
  } catch (err) {
    serverError(res, err, 'GET place search error:')
  }
})

/** Resolve a place for Google Maps embed + detail card */
router.get('/places/map', placeSearchLimiter, async (req, res) => {
  const name = String(req.query.q || req.query.name || '').trim()
  const type = String(req.query.type || 'other').trim()
  const near = String(req.query.near || '').trim()
  const address = String(req.query.address || '').trim() || null
  const placeId = String(req.query.placeId || req.query.place_id || '').trim() || null
  const lat = req.query.lat === '' || req.query.lat == null ? null : Number(req.query.lat)
  const lng = req.query.lng === '' || req.query.lng == null ? null : Number(req.query.lng)

  if (name.length < 1 && near.length < 2 && !(Number.isFinite(lat) && Number.isFinite(lng))) {
    return res.status(400).json({ error: 'ระบุชื่อสถานที่หรือพิกัด' })
  }

  try {
    const resolved = await resolveTripPlaceMap(searchTripPlaces, {
      name,
      type,
      near,
      lat: Number.isFinite(lat) ? lat : null,
      lng: Number.isFinite(lng) ? lng : null,
      placeId,
      address,
    })
    res.json(resolved)
  } catch (err) {
    serverError(res, err, 'GET place map error:')
  }
})

router.get('/places/photo', placeSearchLimiter, async (req, res) => {
  if (req.query.provider !== 'google') {
    return res.status(400).json({ error: 'ไม่รองรับแหล่งรูปนี้' })
  }
  const name = String(req.query.name || '').trim()
  if (!name) return res.status(400).json({ error: 'ไม่พบรูป' })

  try {
    const photo = await fetchGooglePlacePhoto(name)
    if (!photo) return res.status(404).end()
    res.set('Content-Type', photo.contentType)
    res.set('Cache-Control', 'private, max-age=86400')
    res.send(photo.buffer)
  } catch (err) {
    serverError(res, err, 'GET place photo error:')
  }
})

async function getOwnedTrip(userId, tripId) {
  const r = await pool.query(
    'SELECT * FROM trips WHERE id = $1 AND user_id = $2',
    [tripId, userId]
  )
  return r.rows[0] || null
}

async function loadTripDetail(userId, tripId) {
  const trip = await getOwnedTrip(userId, tripId)
  if (!trip) return null

  const days = await pool.query(
    `SELECT * FROM trip_days WHERE trip_id = $1 ORDER BY day_index ASC, id ASC`,
    [tripId]
  )
  const places = await pool.query(
    `SELECT * FROM trip_places WHERE trip_id = $1 ORDER BY sort_order ASC, id ASC`,
    [tripId]
  )

  return {
    ...trip,
    days: days.rows,
    places: places.rows,
  }
}

router.get('/', async (req, res) => {
  try {
    const r = await pool.query(
      `SELECT t.*,
        (SELECT COUNT(*)::int FROM trip_days d WHERE d.trip_id = t.id) AS day_count,
        (SELECT COUNT(*)::int FROM trip_places p WHERE p.trip_id = t.id) AS place_count
       FROM trips t
       WHERE t.user_id = $1
       ORDER BY COALESCE(t.start_date, t.created_at::date) DESC, t.created_at DESC`,
      [req.userId]
    )
    res.json(r.rows)
  } catch (err) {
    serverError(res, err, 'GET trips error:')
  }
})

router.post('/', async (req, res) => {
  const parsed = normalizeTripPayload(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const tripIns = await client.query(
      `INSERT INTO trips (user_id, title, destination, start_date, end_date, currency, status, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        req.userId,
        parsed.title,
        parsed.destination,
        parsed.start_date,
        parsed.end_date,
        parsed.currency,
        parsed.status,
        parsed.notes,
      ]
    )
    const trip = tripIns.rows[0]
    const dates = enumerateDateRange(parsed.start_date, parsed.end_date)
    const days = []
    if (dates.length) {
      for (let i = 0; i < dates.length; i += 1) {
        const day = await client.query(
          `INSERT INTO trip_days (trip_id, day_index, date, title)
           VALUES ($1, $2, $3, $4)
           RETURNING *`,
          [trip.id, i + 1, dates[i], `วันที่ ${i + 1}`]
        )
        days.push(day.rows[0])
      }
    } else {
      const day = await client.query(
        `INSERT INTO trip_days (trip_id, day_index, date, title)
         VALUES ($1, 1, NULL, $2)
         RETURNING *`,
        [trip.id, 'วันที่ 1']
      )
      days.push(day.rows[0])
    }
    await client.query('COMMIT')
    res.json({ ...trip, days, places: [] })
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    serverError(res, err, 'POST trips error:')
  } finally {
    client.release()
  }
})

router.get('/:id', async (req, res) => {
  try {
    const trip = await loadTripDetail(req.userId, Number(req.params.id))
    if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })
    res.json(trip)
  } catch (err) {
    serverError(res, err, 'GET trip detail error:')
  }
})

router.put('/:id', async (req, res) => {
  const tripId = Number(req.params.id)
  const existing = await getOwnedTrip(req.userId, tripId)
  if (!existing) return res.status(404).json({ error: 'ไม่พบทริป' })

  const parsed = normalizeTripPayload({ ...existing, ...req.body, title: req.body.title ?? existing.title })
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  try {
    const r = await pool.query(
      `UPDATE trips
       SET title = $1, destination = $2, start_date = $3, end_date = $4,
           currency = $5, status = $6, notes = $7, updated_at = NOW()
       WHERE id = $8 AND user_id = $9
       RETURNING *`,
      [
        parsed.title,
        parsed.destination,
        parsed.start_date,
        parsed.end_date,
        parsed.currency,
        parsed.status,
        parsed.notes,
        tripId,
        req.userId,
      ]
    )
    const detail = await loadTripDetail(req.userId, tripId)
    res.json(detail || r.rows[0])
  } catch (err) {
    serverError(res, err, 'PUT trip error:')
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const r = await pool.query(
      'DELETE FROM trips WHERE id = $1 AND user_id = $2 RETURNING id',
      [Number(req.params.id), req.userId]
    )
    if (!r.rows[0]) return res.status(404).json({ error: 'ไม่พบทริป' })
    res.json({ ok: true })
  } catch (err) {
    serverError(res, err, 'DELETE trip error:')
  }
})

router.post('/:id/days', async (req, res) => {
  const tripId = Number(req.params.id)
  const trip = await getOwnedTrip(req.userId, tripId)
  if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })

  try {
    const max = await pool.query(
      'SELECT COALESCE(MAX(day_index), 0) AS m FROM trip_days WHERE trip_id = $1',
      [tripId]
    )
    const dayIndex = Number(max.rows[0].m) + 1
    const title = String(req.body?.title || `วันที่ ${dayIndex}`).trim()
    const date = req.body?.date ? String(req.body.date).slice(0, 10) : null
    const notes = req.body?.notes != null ? String(req.body.notes).trim() || null : null
    const r = await pool.query(
      `INSERT INTO trip_days (trip_id, day_index, date, title, notes)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [tripId, dayIndex, date, title, notes]
    )
    res.json(r.rows[0])
  } catch (err) {
    serverError(res, err, 'POST trip day error:')
  }
})

router.put('/:id/days/:dayId', async (req, res) => {
  const tripId = Number(req.params.id)
  const dayId = Number(req.params.dayId)
  const trip = await getOwnedTrip(req.userId, tripId)
  if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })

  try {
    const title = req.body?.title != null ? String(req.body.title).trim() : undefined
    const date = req.body?.date !== undefined
      ? (req.body.date ? String(req.body.date).slice(0, 10) : null)
      : undefined
    const notes = req.body?.notes !== undefined
      ? (req.body.notes != null ? String(req.body.notes).trim() || null : null)
      : undefined

    const r = await pool.query(
      `UPDATE trip_days d
       SET title = COALESCE($1, d.title),
           date = CASE WHEN $4::boolean THEN $2::date ELSE d.date END,
           notes = CASE WHEN $5::boolean THEN $3 ELSE d.notes END
       WHERE d.id = $6 AND d.trip_id = $7
       RETURNING d.*`,
      [
        title ?? null,
        date ?? null,
        notes ?? null,
        date !== undefined,
        notes !== undefined,
        dayId,
        tripId,
      ]
    )
    if (!r.rows[0]) return res.status(404).json({ error: 'ไม่พบวันในทริป' })
    res.json(r.rows[0])
  } catch (err) {
    serverError(res, err, 'PUT trip day error:')
  }
})

router.delete('/:id/days/:dayId', async (req, res) => {
  const tripId = Number(req.params.id)
  const dayId = Number(req.params.dayId)
  const trip = await getOwnedTrip(req.userId, tripId)
  if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })

  try {
    const r = await pool.query(
      'DELETE FROM trip_days WHERE id = $1 AND trip_id = $2 RETURNING id',
      [dayId, tripId]
    )
    if (!r.rows[0]) return res.status(404).json({ error: 'ไม่พบวันในทริป' })
    res.json({ ok: true })
  } catch (err) {
    serverError(res, err, 'DELETE trip day error:')
  }
})

router.post('/:id/enrich-photos', async (req, res) => {
  const tripId = Number(req.params.id)
  const trip = await getOwnedTrip(req.userId, tripId)
  if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })

  try {
    const places = await pool.query(
      `SELECT * FROM trip_places WHERE trip_id = $1 ORDER BY trip_day_id ASC NULLS LAST, sort_order ASC, id ASC`,
      [tripId]
    )
    const dupUrls = new Set()
    const seenUrls = new Set()
    for (const p of places.rows) {
      if (!p.photo_url) continue
      if (seenUrls.has(p.photo_url)) dupUrls.add(p.photo_url)
      else seenUrls.add(p.photo_url)
    }
    const needsWork = places.rows.filter(
      (p) => !p.photo_url || isGenericPlaceName(p.name) || (p.photo_url && dupUrls.has(p.photo_url))
    )
    if (!needsWork.length) {
      const detail = await loadTripDetail(req.userId, tripId)
      return res.json({ updated: 0, trip: detail })
    }

    const updates = await enrichTripPlacesMissingPhotos(places.rows, {
      near: trip.destination || '',
      maxEnrich: Math.min(36, Number(req.body?.limit) || 36),
    })

    for (const u of updates) {
      await pool.query(
        `UPDATE trip_places
         SET name = COALESCE($1, name),
             photo_url = COALESCE($2, photo_url),
             address = COALESCE($3, address),
             lat = COALESCE($4, lat),
             lng = COALESCE($5, lng),
             external_id = COALESCE($6, external_id),
             external_source = COALESCE($7, external_source),
             updated_at = NOW()
         WHERE id = $8 AND trip_id = $9`,
        [
          u.name,
          u.photo_url,
          u.address,
          u.lat,
          u.lng,
          u.external_id,
          u.external_source,
          u.id,
          tripId,
        ]
      )
    }

    const detail = await loadTripDetail(req.userId, tripId)
    res.json({ updated: updates.length, trip: detail })
  } catch (err) {
    serverError(res, err, 'POST trip enrich-photos error:')
  }
})

router.post('/:id/places', async (req, res) => {
  const tripId = Number(req.params.id)
  const trip = await getOwnedTrip(req.userId, tripId)
  if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })

  const parsed = normalizePlacePayload(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  if (parsed.trip_day_id) {
    const day = await pool.query(
      'SELECT id FROM trip_days WHERE id = $1 AND trip_id = $2',
      [parsed.trip_day_id, tripId]
    )
    if (!day.rows[0]) return res.status(400).json({ error: 'วันทริปไม่ตรงกับทริปนี้' })
  }

  try {
    const withLinks = parsed.booking_links?.length
      ? parsed
      : attachBookingLinks(parsed, trip.destination || '')
    const bookingLinks = sanitizeBookingLinks(withLinks.booking_links || [])

    const r = await pool.query(
      `INSERT INTO trip_places
        (trip_id, trip_day_id, type, name, lat, lng, address, photo_url, external_id, external_source,
         start_time, end_time, budget, notes, sort_order, booking_links)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16::jsonb)
       RETURNING *`,
      [
        tripId,
        parsed.trip_day_id,
        parsed.type,
        parsed.name,
        parsed.lat,
        parsed.lng,
        parsed.address,
        parsed.photo_url,
        parsed.external_id,
        parsed.external_source,
        parsed.start_time,
        parsed.end_time,
        parsed.budget,
        parsed.notes,
        parsed.sort_order,
        JSON.stringify(bookingLinks),
      ]
    )
    res.json(r.rows[0])
  } catch (err) {
    serverError(res, err, 'POST trip place error:')
  }
})

router.put('/:id/places/reorder', async (req, res) => {
  const tripId = Number(req.params.id)
  const trip = await getOwnedTrip(req.userId, tripId)
  if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })

  const parsed = normalizeReorderPayload(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  const day = await pool.query(
    'SELECT id FROM trip_days WHERE id = $1 AND trip_id = $2',
    [parsed.day_id, tripId]
  )
  if (!day.rows[0]) return res.status(400).json({ error: 'วันทริปไม่ตรงกับทริปนี้' })

  const existing = await pool.query(
    `SELECT id FROM trip_places
     WHERE trip_id = $1 AND trip_day_id = $2
     ORDER BY sort_order ASC, id ASC`,
    [tripId, parsed.day_id]
  )
  const existingIds = existing.rows.map((r) => r.id)
  if (existingIds.length !== parsed.place_ids.length) {
    return res.status(400).json({ error: 'รายการจุดแวะไม่ครบ' })
  }
  const sameSet =
    existingIds.length === parsed.place_ids.length &&
    existingIds.every((id) => parsed.place_ids.includes(id))
  if (!sameSet) return res.status(400).json({ error: 'รายการจุดแวะไม่ตรงกับวันนี้' })

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    for (let i = 0; i < parsed.place_ids.length; i += 1) {
      await client.query(
        `UPDATE trip_places
         SET sort_order = $1, updated_at = NOW()
         WHERE id = $2 AND trip_id = $3 AND trip_day_id = $4`,
        [i, parsed.place_ids[i], tripId, parsed.day_id]
      )
    }
    await client.query('COMMIT')
    const detail = await loadTripDetail(req.userId, tripId)
    res.json(detail)
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {})
    serverError(res, err, 'PUT trip places reorder error:')
  } finally {
    client.release()
  }
})

router.put('/:id/places/:placeId', async (req, res) => {
  const tripId = Number(req.params.id)
  const placeId = Number(req.params.placeId)
  const trip = await getOwnedTrip(req.userId, tripId)
  if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })

  const existing = await pool.query(
    'SELECT * FROM trip_places WHERE id = $1 AND trip_id = $2',
    [placeId, tripId]
  )
  if (!existing.rows[0]) return res.status(404).json({ error: 'ไม่พบสถานที่' })

  const parsed = normalizePlacePayload({ ...existing.rows[0], ...req.body, name: req.body.name ?? existing.rows[0].name })
  if (parsed.error) return res.status(400).json({ error: parsed.error })

  if (parsed.trip_day_id) {
    const day = await pool.query(
      'SELECT id FROM trip_days WHERE id = $1 AND trip_id = $2',
      [parsed.trip_day_id, tripId]
    )
    if (!day.rows[0]) return res.status(400).json({ error: 'วันทริปไม่ตรงกับทริปนี้' })
  }

  try {
    const bookingLinks = parsed.booking_links !== undefined
      ? sanitizeBookingLinks(parsed.booking_links)
      : sanitizeBookingLinks(
          Array.isArray(existing.rows[0].booking_links) ? existing.rows[0].booking_links : []
        )

    const r = await pool.query(
      `UPDATE trip_places
       SET trip_day_id = $1, type = $2, name = $3, lat = $4, lng = $5, address = $6,
           photo_url = $7, external_id = $8, external_source = $9,
           start_time = $10, end_time = $11, budget = $12, notes = $13, sort_order = $14,
           booking_links = $15::jsonb, updated_at = NOW()
       WHERE id = $16 AND trip_id = $17
       RETURNING *`,
      [
        parsed.trip_day_id,
        parsed.type,
        parsed.name,
        parsed.lat,
        parsed.lng,
        parsed.address,
        parsed.photo_url,
        parsed.external_id,
        parsed.external_source,
        parsed.start_time,
        parsed.end_time,
        parsed.budget,
        parsed.notes,
        parsed.sort_order,
        JSON.stringify(bookingLinks),
        placeId,
        tripId,
      ]
    )
    res.json(r.rows[0])
  } catch (err) {
    serverError(res, err, 'PUT trip place error:')
  }
})

router.delete('/:id/places/:placeId', async (req, res) => {
  const tripId = Number(req.params.id)
  const placeId = Number(req.params.placeId)
  const trip = await getOwnedTrip(req.userId, tripId)
  if (!trip) return res.status(404).json({ error: 'ไม่พบทริป' })

  try {
    const r = await pool.query(
      'DELETE FROM trip_places WHERE id = $1 AND trip_id = $2 RETURNING id',
      [placeId, tripId]
    )
    if (!r.rows[0]) return res.status(404).json({ error: 'ไม่พบสถานที่' })
    res.json({ ok: true })
  } catch (err) {
    serverError(res, err, 'DELETE trip place error:')
  }
})

export default router
