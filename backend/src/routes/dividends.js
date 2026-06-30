import express from 'express'
import { serverError } from '../lib/httpErrors.js'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { resolvePortfolioId } from '../lib/portfolio.js'
import { sanitizeTicker, defaultCurrency, detectMarket } from '../lib/ticker.js'

const router = express.Router()
router.use(authMiddleware)

const ALLOWED_CURRENCIES = new Set(['USD', 'THB', 'HKD', 'CNY'])

router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const result = await pool.query(
      `SELECT * FROM dividends
       WHERE user_id = $1 AND portfolio_id = $2
       ORDER BY pay_date DESC, created_at DESC`,
      [req.userId, portfolioId],
    )
    res.json(result.rows)
  } catch (err) {
    serverError(res, err)
  }
})

router.get('/summary', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const year = new Date().getFullYear()
    const result = await pool.query(
      `SELECT
         COALESCE(SUM(amount) FILTER (WHERE EXTRACT(YEAR FROM pay_date) = $3), 0) AS ytd_total,
         COALESCE(SUM(amount), 0) AS all_time_total,
         COUNT(*)::int AS count
       FROM dividends
       WHERE user_id = $1 AND portfolio_id = $2`,
      [req.userId, portfolioId, year],
    )
    const byTicker = await pool.query(
      `SELECT ticker, currency,
         COALESCE(SUM(amount) FILTER (WHERE EXTRACT(YEAR FROM pay_date) = $3), 0) AS ytd,
         COALESCE(SUM(amount), 0) AS total
       FROM dividends
       WHERE user_id = $1 AND portfolio_id = $2
       GROUP BY ticker, currency
       ORDER BY total DESC`,
      [req.userId, portfolioId, year],
    )
    res.json({ ...result.rows[0], by_ticker: byTicker.rows })
  } catch (err) {
    serverError(res, err)
  }
})

function parseBody(body) {
  const { ticker, amount, currency, shares_held, pay_date, note } = body
  const amt = parseFloat(amount)
  const shares = shares_held != null && shares_held !== '' ? parseFloat(shares_held) : null
  const ccy = String(currency || '').trim().toUpperCase()
  if (!ticker?.trim()) return { error: 'กรุณาระบุ Ticker' }
  if (!(amt > 0)) return { error: 'จำนวนเงินปันผลต้องมากกว่า 0' }
  if (!pay_date) return { error: 'กรุณาระบุวันที่รับปันผล' }
  if (!ALLOWED_CURRENCIES.has(ccy)) return { error: 'สกุลเงินไม่รองรับ' }
  if (shares != null && !(shares > 0)) return { error: 'จำนวนหุ้น ณ วันจ่ายต้องมากกว่า 0' }
  return {
    ticker: sanitizeTicker(ticker),
    amount: amt,
    currency: ccy || defaultCurrency(detectMarket(ticker, ccy)),
    shares_held: shares,
    pay_date,
    note: note?.trim() || null,
  }
}

router.post('/', async (req, res) => {
  const parsed = parseBody(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.body.portfolio_id)
    const result = await pool.query(
      `INSERT INTO dividends (user_id, portfolio_id, ticker, amount, currency, shares_held, pay_date, note)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) RETURNING *`,
      [
        req.userId, portfolioId, parsed.ticker, parsed.amount, parsed.currency,
        parsed.shares_held, parsed.pay_date, parsed.note,
      ],
    )
    res.json(result.rows[0])
  } catch (err) {
    serverError(res, err)
  }
})

router.put('/:id', async (req, res) => {
  const parsed = parseBody(req.body)
  if (parsed.error) return res.status(400).json({ error: parsed.error })
  try {
    const existing = await pool.query(
      'SELECT portfolio_id FROM dividends WHERE id = $1 AND user_id = $2',
      [req.params.id, req.userId]
    )
    if (!existing.rows.length) return res.status(404).json({ error: 'ไม่พบรายการ' })

    const portfolioId = existing.rows[0].portfolio_id
      ?? await resolvePortfolioId(req.userId, req.body.portfolio_id)

    const result = await pool.query(
      `UPDATE dividends
       SET ticker = $1, amount = $2, currency = $3, shares_held = $4, pay_date = $5, note = $6
       WHERE id = $7 AND user_id = $8 AND portfolio_id = $9
       RETURNING *`,
      [
        parsed.ticker, parsed.amount, parsed.currency, parsed.shares_held,
        parsed.pay_date, parsed.note, req.params.id, req.userId, portfolioId,
      ],
    )
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบรายการ' })
    res.json(result.rows[0])
  } catch (err) {
    serverError(res, err)
  }
})

router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query(
      'DELETE FROM dividends WHERE id = $1 AND user_id = $2 RETURNING id',
      [req.params.id, req.userId],
    )
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบรายการ' })
    res.json({ message: 'Deleted' })
  } catch (err) {
    serverError(res, err)
  }
})

export default router
