import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import dotenv from 'dotenv'
import pool from './db/index.js'
import { runMigrations } from './db/migrate.js'
import authRoutes from './routes/auth.js'
import holdingsRoutes from './routes/holdings.js'
import transactionsRoutes from './routes/transactions.js'
import journalRoutes from './routes/journal.js'
import newsRoutes from './routes/news.js'
import aiRoutes from './routes/ai.js'
import portfoliosRoutes from './routes/portfolios.js'
import { toYahooTicker, sanitizeTicker } from './lib/ticker.js'
import { pricesLimiter } from './middleware/rateLimit.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set')
  process.exit(1)
}

const corsOrigins = (process.env.CORS_ORIGINS || 'https://portdiary.com,https://www.portdiary.com')
  .split(',')
  .map((o) => o.trim())
  .filter(Boolean)

if (process.env.NODE_ENV !== 'production') {
  corsOrigins.push('http://localhost:5173', 'http://127.0.0.1:5173')
}

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}))
app.use(cors({
  origin: (origin, callback) => {
    if (!origin || corsOrigins.includes(origin)) return callback(null, true)
    return callback(null, false)
  },
  credentials: true,
}))
app.use(express.json({ limit: '1mb' }))

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

app.get('/api/prices', pricesLimiter, async (req, res) => {
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
      const symbols = [...new Set([
        toYahooTicker(ticker),
        sanitizeTicker(ticker),
      ].filter(Boolean))]

      for (const yahooSymbol of symbols) {
        try {
          const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`
          const r = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0' },
            signal: AbortSignal.timeout(5000)
          })
          const data = await r.json()
          const meta = data?.chart?.result?.[0]?.meta
          if (meta?.regularMarketPrice) {
            result[ticker] = meta.regularMarketPrice
            const prev = meta.chartPreviousClose || meta.previousClose || 0
            result[`${ticker}_chg`] = prev > 0 ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0
            result[`${ticker}_prev`] = prev
            break
          }
        } catch (e) {
          console.error(`Price fetch error for ${ticker} (${yahooSymbol}):`, e.message)
        }
      }
    }))

    priceCache.set(cacheKey, { data: result, ts: Date.now() })
    res.json(result)
  } catch (e) {
    res.json(priceCache.get(cacheKey)?.data || {})
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/portfolios', portfoliosRoutes)
app.use('/api/holdings', holdingsRoutes)
app.use('/api/transactions', transactionsRoutes)
app.use('/api/journal', journalRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/ai', aiRoutes)

runMigrations()
  .then((errors) => {
    if (errors.length) {
      console.warn('Some migrations failed — server starting anyway:', errors)
    }
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`)
    })
  })
  .catch((err) => {
    console.error('Migration runner error:', err.message)
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT} (migration runner error)`)
    })
  })
