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
import dividendsRoutes from './routes/dividends.js'
import newsRoutes from './routes/news.js'
import aiRoutes from './routes/ai.js'
import thesisRoutes from './routes/thesis.js'
import portfoliosRoutes from './routes/portfolios.js'
import { fetchHoldingQuote, fetchLiveQuote } from './lib/yahooPrices.js'
import { pricesLimiter } from './middleware/rateLimit.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

// Behind nginx reverse proxy (required for express-rate-limit + client IP)
app.set('trust proxy', 1)

if (!process.env.JWT_SECRET) {
  console.error('FATAL: JWT_SECRET is not set')
  process.exit(1)
}

const WEAK_JWT_SECRETS = new Set([
  'your-super-secret-jwt-key-change-this',
  'change-this-to-a-long-random-string',
])

if (
  WEAK_JWT_SECRETS.has(process.env.JWT_SECRET) ||
  process.env.JWT_SECRET.length < 32
) {
  console.warn('WARNING: JWT_SECRET is weak or too short')
  console.warn('WARNING: Generate a new one with: ./scripts/generate-jwt-secret.sh')
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
  const { tickers, markets, currencies, portfolio_currencies } = req.query
  if (!tickers) return res.json({})

  const cacheKey = [tickers, markets || '', currencies || '', portfolio_currencies || ''].join('|')
  const cached = priceCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PRICE_TTL) {
    return res.json(cached.data)
  }

  try {
    const tickerList = tickers.split(',').filter(Boolean)
    const marketList = markets?.split(',') || []
    const currencyList = currencies?.split(',') || []
    const portfolioCurrencyList = portfolio_currencies?.split(',') || []
    const result = {}

    const jobs = tickerList.map(async (ticker, i) => {
      if (ticker === 'USDTHB=X') {
        const quote = await fetchLiveQuote('USDTHB=X')
        if (quote) {
          result[ticker] = quote.price
          result[`${ticker}_chg`] = quote.changePct
          result[`${ticker}_prev`] = quote.previousClose
        }
        return
      }

      const quote = await fetchHoldingQuote(
        ticker,
        marketList[i] || '',
        currencyList[i] || '',
        portfolioCurrencyList[i] || ''
      )
      if (quote) {
        result[ticker] = quote.price
        result[`${ticker}_chg`] = quote.changePct
        result[`${ticker}_prev`] = quote.previousClose
      }
    })

    if (!tickerList.includes('USDTHB=X')) {
      jobs.push((async () => {
        const quote = await fetchLiveQuote('USDTHB=X')
        if (quote) {
          result['USDTHB=X'] = quote.price
          result['USDTHB=X_chg'] = quote.changePct
        }
      })())
    }

    await Promise.all(jobs)

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
app.use('/api/dividends', dividendsRoutes)
app.use('/api/news', newsRoutes)
app.use('/api/ai', aiRoutes)
app.use('/api/thesis', thesisRoutes)

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
