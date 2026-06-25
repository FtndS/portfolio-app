import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pool from './db/index.js'
import authRoutes from './routes/auth.js'
import holdingsRoutes from './routes/holdings.js'
import transactionsRoutes from './routes/transactions.js'
import journalRoutes from './routes/journal.js'
import newsRoutes from './routes/news.js'
import aiRoutes from './routes/ai.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

// Price cache 5 นาที
const priceCache = new Map()
const PRICE_TTL = 5 * 60 * 1000

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()')
    res.json({ status: 'ok', db: 'connected' })
  } catch (err) {
    res.status(500).json({ status: 'error', db: err.message })
  }
})

app.get('/api/prices', async (req, res) => {
  const { tickers } = req.query
  if (!tickers) return res.json({})

  const cacheKey = tickers
  const cached = priceCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PRICE_TTL) {
    return res.json(cached.data)
  }

  try {
    const tickerList = [...new Set([...tickers.split(','), 'USDTHB=X'])]
    const result = {}

    await Promise.all(tickerList.map(async (ticker) => {
      try {
        const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
        const r = await fetch(url, {
          headers: { 'User-Agent': 'Mozilla/5.0' },
          signal: AbortSignal.timeout(5000)
        })
        const data = await r.json()
        const meta = data?.chart?.result?.[0]?.meta
        if (meta) {
          result[ticker] = meta.regularMarketPrice || 0
          const prev = meta.chartPreviousClose || meta.previousClose || 0
          result[`${ticker}_chg`] = prev > 0 ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0
          result[`${ticker}_prev`] = prev
        }
      } catch (e) {
        console.error(`Price fetch error for ${ticker}:`, e.message)
      }
    }))

    priceCache.set(cacheKey, { data: result, ts: Date.now() })
    res.json(result)
  } catch (e) {
    res.json(priceCache.get(cacheKey)?.data || {})
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/holdings', holdingsRoutes)
app.use('/api/transactions', transactionsRoutes)
app.use('/api/journal', journalRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/ai', aiRoutes)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
