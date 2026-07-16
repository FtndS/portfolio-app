import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { serverError } from '../lib/httpErrors.js'
import {
  enumerateDateRange,
  normalizePlacePayload,
  normalizeTripPayload,
} from '../lib/tripHelpers.js'

const router = express.Router()
router.use(authMiddleware)

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
    const r = await pool.query(
      `INSERT INTO trip_places
        (trip_id, trip_day_id, type, name, lat, lng, address, start_time, end_time, budget, notes, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       RETURNING *`,
      [
        tripId,
        parsed.trip_day_id,
        parsed.type,
        parsed.name,
        parsed.lat,
        parsed.lng,
        parsed.address,
        parsed.start_time,
        parsed.end_time,
        parsed.budget,
        parsed.notes,
        parsed.sort_order,
      ]
    )
    res.json(r.rows[0])
  } catch (err) {
    serverError(res, err, 'POST trip place error:')
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
    const r = await pool.query(
      `UPDATE trip_places
       SET trip_day_id = $1, type = $2, name = $3, lat = $4, lng = $5, address = $6,
           start_time = $7, end_time = $8, budget = $9, notes = $10, sort_order = $11, updated_at = NOW()
       WHERE id = $12 AND trip_id = $13
       RETURNING *`,
      [
        parsed.trip_day_id,
        parsed.type,
        parsed.name,
        parsed.lat,
        parsed.lng,
        parsed.address,
        parsed.start_time,
        parsed.end_time,
        parsed.budget,
        parsed.notes,
        parsed.sort_order,
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
