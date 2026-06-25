import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import pool from './db/index.js'
import authRoutes from './routes/auth.js'
import holdingsRoutes from './routes/holdings.js'
import transactionsRoutes from './routes/transactions.js'
import journalRoutes from './routes/journal.js'

dotenv.config()

const app = express()
const PORT = process.env.PORT || 3001

app.use(cors())
app.use(express.json())

app.get('/api/health', async (req, res) => {
  try {
    await pool.query('SELECT NOW()')
    res.json({ status: 'ok', db: 'connected' })
  } catch (err) {
    res.status(500).json({ status: 'error', db: err.message })
  }
})

app.use('/api/auth', authRoutes)
app.use('/api/holdings', holdingsRoutes)
app.use('/api/transactions', transactionsRoutes)
app.use('/api/journal', journalRoutes)

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
})
app.get('/api/prices', async (req, res) => {
  const { tickers } = req.query
  if (!tickers) return res.json({})
  try {
    const tickerList = [...tickers.split(','), 'USDTHB=X']
    const result = {}
    await Promise.all(tickerList.map(async (ticker) => {
      const url = `https://query1.finance.yahoo.com/v8/finance/chart/${ticker}?interval=1d&range=1d`
      const r = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } })
      const data = await r.json()
      const meta = data?.chart?.result?.[0]?.meta
      if (meta) {
        result[ticker] = meta.regularMarketPrice || 0
        const prev = meta.chartPreviousClose || meta.previousClose || 0
        result[`${ticker}_chg`] = prev > 0 ? ((meta.regularMarketPrice - prev) / prev) * 100 : 0
      }
    }))
    res.json(result)
  } catch (e) {
    res.json({})
  }
})
