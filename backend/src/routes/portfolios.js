import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*,
        COALESCE(SUM(h.shares * h.avg_cost), 0) AS total_invested,
        COUNT(h.id) AS holding_count
       FROM portfolios p
       LEFT JOIN holdings h ON h.portfolio_id = p.id
       WHERE p.user_id = $1
       GROUP BY p.id
       ORDER BY p.is_default DESC, p.created_at ASC`,
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { name, description, currency } = req.body
  if (!name?.trim()) return res.status(400).json({ error: 'กรุณาระบุชื่อพอร์ต' })
  try {
    const result = await pool.query(
      `INSERT INTO portfolios (user_id, name, description, currency, is_default)
       VALUES ($1, $2, $3, $4, false) RETURNING *`,
      [req.userId, name.trim(), description || null, currency || 'USD']
    )
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  const { name, description, currency } = req.body
  try {
    const result = await pool.query(
      `UPDATE portfolios SET name = COALESCE($1, name), description = COALESCE($2, description),
        currency = COALESCE($3, currency)
       WHERE id = $4 AND user_id = $5 RETURNING *`,
      [name, description, currency, req.params.id, req.userId]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'Not found' })
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const count = await client.query('SELECT COUNT(*) FROM portfolios WHERE user_id = $1', [req.userId])
    if (parseInt(count.rows[0].count) <= 1) {
      await client.query('ROLLBACK')
      return res.status(400).json({ error: 'ต้องมีอย่างน้อย 1 พอร์ต' })
    }
    const target = await client.query(
      'SELECT id, is_default FROM portfolios WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (!target.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Not found' })
    }
    await client.query('DELETE FROM portfolios WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
    if (target.rows[0].is_default) {
      await client.query(
        `UPDATE portfolios SET is_default = true WHERE user_id = $1 AND id = (
          SELECT id FROM portfolios WHERE user_id = $1 ORDER BY created_at ASC LIMIT 1
        )`,
        [req.userId]
      )
    }
    await client.query('COMMIT')
    res.json({ message: 'Deleted' })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

// Portfolio value history (Google Finance style)
router.get('/:id/history', async (req, res) => {
  const { days = 90 } = req.query
  try {
    const owns = await pool.query(
      'SELECT id FROM portfolios WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (!owns.rows.length) return res.status(404).json({ error: 'Not found' })

    const result = await pool.query(
      `SELECT snapshot_date AS date, total_value, total_cost, sector_data
       FROM portfolio_snapshots
       WHERE portfolio_id = $1 AND snapshot_date >= CURRENT_DATE - $2::int
       ORDER BY snapshot_date ASC`,
      [req.params.id, parseInt(days) || 90]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

// Record today's snapshot (called from frontend after prices load)
router.post('/:id/snapshot', async (req, res) => {
  const { total_value, total_cost, sector_data } = req.body
  try {
    const owns = await pool.query(
      'SELECT id FROM portfolios WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (!owns.rows.length) return res.status(404).json({ error: 'Not found' })

    const result = await pool.query(
      `INSERT INTO portfolio_snapshots (portfolio_id, snapshot_date, total_value, total_cost, sector_data)
       VALUES ($1, CURRENT_DATE, $2, $3, $4)
       ON CONFLICT (portfolio_id, snapshot_date)
       DO UPDATE SET total_value = $2, total_cost = $3, sector_data = $4
       RETURNING *`,
      [req.params.id, total_value, total_cost, JSON.stringify(sector_data || [])]
    )
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
