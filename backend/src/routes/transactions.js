import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 ORDER BY date DESC, created_at DESC',
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { ticker, type, shares, price, note, date, holding_id } = req.body
  if (!ticker || !type || !shares || !price) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const total = parseFloat(shares) * parseFloat(price)
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // บันทึก transaction
    const txResult = await client.query(
      `INSERT INTO transactions (user_id, holding_id, ticker, type, shares, price, total, note, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.userId, holding_id || null, ticker.toUpperCase(), type, parseFloat(shares), parseFloat(price), total, note || null, date]
    )

    // คำนวณ avg cost ใหม่จากทุก BUY transaction
    const allBuys = await client.query(
      `SELECT shares, price FROM transactions 
       WHERE user_id = $1 AND ticker = $2 AND type = 'BUY'`,
      [req.userId, ticker.toUpperCase()]
    )

    if (allBuys.rows.length > 0) {
      const totalShares = allBuys.rows.reduce((s, r) => s + parseFloat(r.shares), 0)
      const totalCost = allBuys.rows.reduce((s, r) => s + parseFloat(r.shares) * parseFloat(r.price), 0)
      const avgCost = totalCost / totalShares

      // คำนวณ shares คงเหลือ (BUY - SELL)
      const allTx = await client.query(
        `SELECT type, shares FROM transactions WHERE user_id = $1 AND ticker = $2`,
        [req.userId, ticker.toUpperCase()]
      )
      const netShares = allTx.rows.reduce((s, r) => {
        return r.type === 'BUY' ? s + parseFloat(r.shares) : s - parseFloat(r.shares)
      }, 0)

      // update หรือ insert holding
      const existing = await client.query(
        'SELECT id FROM holdings WHERE user_id = $1 AND ticker = $2',
        [req.userId, ticker.toUpperCase()]
      )
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE holdings SET shares = $1, avg_cost = $2, updated_at = NOW()
           WHERE user_id = $3 AND ticker = $4`,
          [netShares, avgCost, req.userId, ticker.toUpperCase()]
        )
      } else {
        // ดึง currency จาก holding_id ถ้ามี
        const currency = 'USD'
        await client.query(
          `INSERT INTO holdings (user_id, ticker, name, shares, avg_cost, currency)
           VALUES ($1, $2, $3, $4, $5, $6)`,
          [req.userId, ticker.toUpperCase(), ticker.toUpperCase(), netShares, avgCost, currency]
        )
      }
    }

    await client.query('COMMIT')
    res.json(txResult.rows[0])
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM transactions WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
