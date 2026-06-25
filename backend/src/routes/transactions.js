import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { toYahooTicker } from '../lib/ticker.js'
import { resolvePortfolioId } from '../lib/portfolio.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const result = await pool.query(
      'SELECT * FROM transactions WHERE user_id = $1 AND portfolio_id = $2 ORDER BY date DESC, created_at DESC',
      [req.userId, portfolioId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { ticker, type, shares, price, note, date, holding_id, portfolio_id } = req.body
  if (!ticker || !type || !shares || !price) {
    return res.status(400).json({ error: 'Missing required fields' })
  }
  const sanitizedTicker = toYahooTicker(ticker).replace(/\./g, '-')
  const total = parseFloat(shares) * parseFloat(price)
  const client = await pool.connect()
  try {
    const portfolioId = await resolvePortfolioId(req.userId, portfolio_id)
    await client.query('BEGIN')

    const txResult = await client.query(
      `INSERT INTO transactions (user_id, portfolio_id, holding_id, ticker, type, shares, price, total, note, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10) RETURNING *`,
      [req.userId, portfolioId, holding_id || null, sanitizedTicker, type,
        parseFloat(shares), parseFloat(price), total, note || null, date]
    )

    const allBuys = await client.query(
      `SELECT shares, price FROM transactions
       WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3 AND type = 'BUY'`,
      [req.userId, portfolioId, sanitizedTicker]
    )

    if (allBuys.rows.length > 0) {
      const totalShares = allBuys.rows.reduce((s, r) => s + parseFloat(r.shares), 0)
      const totalCost = allBuys.rows.reduce((s, r) => s + parseFloat(r.shares) * parseFloat(r.price), 0)
      const avgCost = totalCost / totalShares

      const allTx = await client.query(
        `SELECT type, shares FROM transactions WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3`,
        [req.userId, portfolioId, sanitizedTicker]
      )
      const netShares = allTx.rows.reduce((s, r) => {
        return r.type === 'BUY' ? s + parseFloat(r.shares) : s - parseFloat(r.shares)
      }, 0)

      const existing = await client.query(
        'SELECT id, currency, market FROM holdings WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3',
        [req.userId, portfolioId, sanitizedTicker]
      )
      if (existing.rows.length > 0) {
        await client.query(
          `UPDATE holdings SET shares = $1, avg_cost = $2, updated_at = NOW()
           WHERE user_id = $3 AND portfolio_id = $4 AND ticker = $5`,
          [netShares, avgCost, req.userId, portfolioId, sanitizedTicker]
        )
      } else {
        await client.query(
          `INSERT INTO holdings (user_id, portfolio_id, ticker, name, shares, avg_cost, currency, market)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [req.userId, portfolioId, sanitizedTicker, sanitizedTicker, netShares, avgCost, 'USD', 'US']
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
