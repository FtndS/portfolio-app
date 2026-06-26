import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { toYahooTicker, defaultCurrency, detectMarket } from '../lib/ticker.js'
import { resolvePortfolioId, isDefaultPortfolio } from '../lib/portfolio.js'
import { fetchCompanyProfile, needsSectorRefresh } from '../lib/profile.js'

const router = express.Router()
router.use(authMiddleware)

async function refreshStaleSectors(rows) {
  const stale = rows.filter(h => needsSectorRefresh(h.sector))
  if (!stale.length) return

  await Promise.all(stale.map(async (h) => {
    const profile = await fetchCompanyProfile(h.ticker, h.market || 'US')
    const sector = profile.sector
    const name = profile.name
    if (needsSectorRefresh(sector)) return
    await pool.query(
      `UPDATE holdings SET sector = $1,
        name = CASE WHEN name IS NULL OR name = ticker THEN $2 ELSE name END
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
    const includeOrphans = await isDefaultPortfolio(req.userId, portfolioId)
    const result = await pool.query(
      includeOrphans
        ? `SELECT * FROM holdings WHERE user_id = $1
           AND (portfolio_id = $2 OR portfolio_id IS NULL) ORDER BY ticker`
        : `SELECT * FROM holdings WHERE user_id = $1 AND portfolio_id = $2 ORDER BY ticker`,
      [req.userId, portfolioId]
    )
    await refreshStaleSectors(result.rows)
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { ticker, name, shares, avg_cost, currency, market, portfolio_id } = req.body
  const mkt = market || detectMarket(ticker)
  const sanitizedTicker = toYahooTicker(ticker, mkt).replace(/\./g, '-')
  const profile = await fetchCompanyProfile(ticker, mkt)
  const finalName = name || profile.name || sanitizedTicker
  const finalSector = profile.sector || 'Other'

  try {
    const portfolioId = await resolvePortfolioId(req.userId, portfolio_id)
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
  const mkt = market || detectMarket(ticker)
  const sanitizedTicker = toYahooTicker(ticker, mkt).replace(/\./g, '-')
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
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/refresh-sectors', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.body.portfolio_id)
    const isDefault = await isDefaultPortfolio(req.userId, portfolioId)
    const result = await pool.query(
      isDefault
        ? `SELECT * FROM holdings WHERE user_id = $1
           AND (portfolio_id = $2 OR portfolio_id IS NULL)`
        : `SELECT * FROM holdings WHERE user_id = $1 AND portfolio_id = $2`,
      [req.userId, portfolioId]
    )
    await refreshStaleSectors(result.rows)
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
