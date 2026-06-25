import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { toYahooTicker, defaultCurrency, detectMarket } from '../lib/ticker.js'
import { resolvePortfolioId } from '../lib/portfolio.js'

const router = express.Router()
router.use(authMiddleware)

async function fetchCompanyProfileFromInternet(ticker, market = 'US') {
  const defaultResult = { name: '', sector: 'Other' }
  const yahooTicker = toYahooTicker(ticker, market)
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${yahooTicker}?modules=assetProfile,price`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    })
    if (!response.ok) return defaultResult
    const data = await response.json()
    const result = data.quoteSummary?.result?.[0]
    if (!result) return defaultResult
    return {
      name: result.price?.longName || result.price?.shortName || '',
      sector: result.assetProfile?.sector || 'Other'
    }
  } catch (e) {
    console.error(`Failed to fetch live profile for ${yahooTicker}:`, e)
    return defaultResult
  }
}

router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const result = await pool.query(
      'SELECT * FROM holdings WHERE user_id = $1 AND portfolio_id = $2 ORDER BY ticker',
      [req.userId, portfolioId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { ticker, name, shares, avg_cost, currency, market, portfolio_id } = req.body
  const mkt = market || detectMarket(ticker)
  const sanitizedTicker = toYahooTicker(ticker, mkt).replace(/\./g, '-')
  const profile = await fetchCompanyProfileFromInternet(ticker, mkt)
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
  const profile = await fetchCompanyProfileFromInternet(ticker, mkt)
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

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM holdings WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
