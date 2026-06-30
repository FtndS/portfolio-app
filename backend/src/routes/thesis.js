import express from 'express'
import { serverError } from '../lib/httpErrors.js'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { resolvePortfolioId } from '../lib/portfolio.js'
import { storageTicker } from '../lib/ticker.js'

const router = express.Router()
router.use(authMiddleware)

function normalizeTicker(raw) {
  return storageTicker(String(raw || '').trim().toUpperCase())
}

router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const result = await pool.query(
      `SELECT * FROM investment_thesis
       WHERE user_id = $1 AND portfolio_id = $2
       ORDER BY ticker ASC`,
      [req.userId, portfolioId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('GET thesis list error:', err)
    serverError(res, err)
  }
})

router.get('/:ticker', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const ticker = normalizeTicker(req.params.ticker)
    const result = await pool.query(
      `SELECT * FROM investment_thesis
       WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3`,
      [req.userId, portfolioId, ticker]
    )
    if (!result.rows.length) {
      return res.json({ ticker, thesis: '', invalidation: '', horizon: '' })
    }
    res.json(result.rows[0])
  } catch (err) {
    console.error('GET thesis error:', err)
    serverError(res, err)
  }
})

router.put('/:ticker', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.body.portfolio_id)
    const ticker = normalizeTicker(req.params.ticker)
    const thesis = String(req.body.thesis || '').trim()
    const invalidation = String(req.body.invalidation || '').trim()
    const horizon = String(req.body.horizon || '').trim()

    const result = await pool.query(
      `INSERT INTO investment_thesis (user_id, portfolio_id, ticker, thesis, invalidation, horizon, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())
       ON CONFLICT (user_id, portfolio_id, ticker)
       DO UPDATE SET thesis = $4, invalidation = $5, horizon = $6, updated_at = NOW()
       RETURNING *`,
      [req.userId, portfolioId, ticker, thesis, invalidation, horizon]
    )
    res.json(result.rows[0])
  } catch (err) {
    console.error('PUT thesis error:', err)
    serverError(res, err)
  }
})

export default router
