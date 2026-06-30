import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { defaultCurrency, resolveMarket, storageTicker } from '../lib/ticker.js'
import { resolvePortfolioId } from '../lib/portfolio.js'
import {
  fetchCompanyProfile,
  needsSectorRefresh,
  resolveHoldingMarket,
} from '../lib/profile.js'

const router = express.Router()
router.use(authMiddleware)

function needsHoldingRepair(h) {
  return (
    needsSectorRefresh(h.sector) ||
    /^\d+$/.test(String(h.name || '').trim())
  )
}

async function repairMisidentifiedHoldings(rows, portfolioCurrency) {
  const candidates = rows.filter(needsHoldingRepair)
  if (!candidates.length) return

  await Promise.all(candidates.map(async (h) => {
    const correctMarket = await resolveHoldingMarket(h, portfolioCurrency)
    const holdingCurrency = defaultCurrency(correctMarket)
    const profile = await fetchCompanyProfile(h.ticker, correctMarket)

    const updates = {}
    if (correctMarket !== (h.market || 'US')) updates.market = correctMarket
    if (holdingCurrency !== h.currency) updates.currency = holdingCurrency
    if (!needsSectorRefresh(profile.sector)) updates.sector = profile.sector
    if (profile.name && !/^\d+$/.test(profile.name)) updates.name = profile.name

    if (!Object.keys(updates).length) return

    const fields = []
    const values = []
    let i = 1
    for (const [key, val] of Object.entries(updates)) {
      fields.push(`${key} = $${i++}`)
      values.push(val)
    }
    values.push(h.id)

    await pool.query(
      `UPDATE holdings SET ${fields.join(', ')} WHERE id = $${i}`,
      values
    )

    Object.assign(h, updates)
  }))
}

async function refreshStaleSectors(rows, portfolioCurrency) {
  const stale = rows.filter(h => needsSectorRefresh(h.sector))
  if (!stale.length) return

  await Promise.all(stale.map(async (h) => {
    const resolvedMarket = await resolveHoldingMarket(h, portfolioCurrency)
    if (resolvedMarket !== (h.market || 'US')) {
      await pool.query(
        'UPDATE holdings SET market = $1, currency = $2 WHERE id = $3',
        [resolvedMarket, defaultCurrency(resolvedMarket), h.id]
      )
      h.market = resolvedMarket
      h.currency = defaultCurrency(resolvedMarket)
    }
    const profile = await fetchCompanyProfile(h.ticker, resolvedMarket)
    const sector = profile.sector
    const name = profile.name
    if (needsSectorRefresh(sector)) return
    await pool.query(
      `UPDATE holdings SET sector = $1,
        name = CASE WHEN name IS NULL OR name = ticker OR name ~ '^[0-9]+$' THEN $2 ELSE name END
       WHERE id = $3`,
      [sector, name || h.ticker, h.id]
    )
    h.sector = sector
    if (name) h.name = name
  }))
}

router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const [result, portfolio] = await Promise.all([
      pool.query(
        `SELECT * FROM holdings WHERE user_id = $1 AND portfolio_id = $2 ORDER BY ticker`,
        [req.userId, portfolioId]
      ),
      pool.query(
        'SELECT currency FROM portfolios WHERE id = $1 AND user_id = $2',
        [portfolioId, req.userId]
      ),
    ])
    const portfolioCurrency = portfolio.rows[0]?.currency || 'USD'
    const rows = result.rows

    await repairMisidentifiedHoldings(rows, portfolioCurrency)
    await refreshStaleSectors(rows, portfolioCurrency)
    res.json(rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { ticker, name, shares, avg_cost, currency, market, portfolio_id } = req.body
  const portfolioId = await resolvePortfolioId(req.userId, portfolio_id)
  const portfolio = await pool.query(
    'SELECT currency FROM portfolios WHERE id = $1 AND user_id = $2',
    [portfolioId, req.userId]
  )
  const portfolioCurrency = portfolio.rows[0]?.currency || 'USD'
  const mkt = resolveMarket(ticker, market, currency, portfolioCurrency)
  const sanitizedTicker = storageTicker(ticker, mkt, currency, portfolioCurrency)
  const profile = await fetchCompanyProfile(ticker, mkt)
  const finalName = name || profile.name || sanitizedTicker
  const finalSector = profile.sector || 'Other'

  try {
    const result = await pool.query(
      `INSERT INTO holdings (user_id, portfolio_id, ticker, name, shares, avg_cost, sector, currency, market)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
      [req.userId, portfolioId, sanitizedTicker, finalName, shares, avg_cost, finalSector,
        currency || defaultCurrency(mkt), mkt]
    )
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.put('/:id', async (req, res) => {
  const { ticker, name, shares, avg_cost, currency, market } = req.body
  const existing = await pool.query(
    'SELECT portfolio_id FROM holdings WHERE id = $1 AND user_id = $2',
    [req.params.id, req.userId]
  )
  if (!existing.rows.length) {
    return res.status(404).json({ error: 'ไม่พบ holding' })
  }
  const portfolio = await pool.query(
    'SELECT currency FROM portfolios WHERE id = $1 AND user_id = $2',
    [existing.rows[0].portfolio_id, req.userId]
  )
  const portfolioCurrency = portfolio.rows[0]?.currency || 'USD'
  const mkt = resolveMarket(ticker, market, currency, portfolioCurrency)
  const sanitizedTicker = storageTicker(ticker, mkt, currency, portfolioCurrency)
  const profile = await fetchCompanyProfile(ticker, mkt)
  const finalName = name || profile.name || sanitizedTicker
  const finalSector = profile.sector || 'Other'

  try {
    const result = await pool.query(
      `UPDATE holdings SET ticker=$1, name=$2, shares=$3, avg_cost=$4, sector=$5,
        currency=$6, market=$7, updated_at=NOW()
       WHERE id=$8 AND user_id=$9 RETURNING *`,
      [sanitizedTicker, finalName, shares, avg_cost, finalSector,
        currency || defaultCurrency(mkt), mkt, req.params.id, req.userId]
    )
    if (!result.rows.length) {
      return res.status(404).json({ error: 'ไม่พบ holding' })
    }
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/refresh-sectors', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.body.portfolio_id)
    const [result, portfolio] = await Promise.all([
      pool.query(
        `SELECT * FROM holdings WHERE user_id = $1 AND portfolio_id = $2`,
        [req.userId, portfolioId]
      ),
      pool.query(
        'SELECT currency FROM portfolios WHERE id = $1 AND user_id = $2',
        [portfolioId, req.userId]
      ),
    ])
    const portfolioCurrency = portfolio.rows[0]?.currency || 'USD'
    await repairMisidentifiedHoldings(result.rows, portfolioCurrency)
    await refreshStaleSectors(result.rows, portfolioCurrency)
    res.json({ updated: result.rows.length, holdings: result.rows })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM holdings WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
