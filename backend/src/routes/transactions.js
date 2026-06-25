import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { toYahooTicker } from '../lib/ticker.js'
import { resolvePortfolioId, isDefaultPortfolio, getDefaultPortfolioId } from '../lib/portfolio.js'
import { syncHoldingFromTransactions } from '../lib/holdingSync.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const includeOrphans = await isDefaultPortfolio(req.userId, portfolioId)
    const result = await pool.query(
      includeOrphans
        ? `SELECT * FROM transactions WHERE user_id = $1
           AND (portfolio_id = $2 OR portfolio_id IS NULL)
           ORDER BY date DESC, created_at DESC`
        : `SELECT * FROM transactions WHERE user_id = $1 AND portfolio_id = $2
           ORDER BY date DESC, created_at DESC`,
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

    await syncHoldingFromTransactions(client, req.userId, portfolioId, sanitizedTicker)

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
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    const tx = await client.query(
      'SELECT ticker, portfolio_id FROM transactions WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (!tx.rows.length) {
      await client.query('ROLLBACK')
      return res.status(404).json({ error: 'Not found' })
    }

    const { ticker, portfolio_id: rawPortfolioId } = tx.rows[0]
    const portfolioId = rawPortfolioId || await getDefaultPortfolioId(req.userId)
    await client.query('DELETE FROM transactions WHERE id = $1 AND user_id = $2', [req.params.id, req.userId])
    await syncHoldingFromTransactions(client, req.userId, portfolioId, ticker)

    await client.query('COMMIT')
    res.json({ message: 'Deleted' })
  } catch (err) {
    await client.query('ROLLBACK')
    res.status(500).json({ error: err.message })
  } finally {
    client.release()
  }
})

export default router
