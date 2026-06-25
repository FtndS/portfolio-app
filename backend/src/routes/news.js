import express from 'express'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
router.use(authMiddleware)

// Cache 15 นาที
const cache = new Map()
const CACHE_TTL = 15 * 60 * 1000

async function fetchRSS(url) {
  const cached = cache.get(url)
  if (cached && Date.now() - cached.ts < CACHE_TTL) {
    return cached.data
  }
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; PortDiary/1.0)' },
      signal: AbortSignal.timeout(8000)
    })
    const text = await res.text()
    const parser = { items: [] }
    const itemMatches = text.matchAll(/<item>([\s\S]*?)<\/item>/g)
    for (const m of itemMatches) {
      const t = m[1]
      const title = t.match(/<title[^>]*>([\s\S]*?)<\/title>/)?.[1]?.replace(/<!\[CDATA\[(.*?)\]\]>/g, '$1').trim() || ''
      const link = t.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || ''
      const pubDate = t.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || ''
      const source = t.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() || 'Yahoo Finance'
      if (title && link) parser.items.push({ title, url: link, publishedAt: pubDate, source: { name: source } })
    }
    cache.set(url, { data: parser.items, ts: Date.now() })
    return parser.items
  } catch (e) {
    console.error('RSS fetch error:', e.message)
    return cache.get(url)?.data || []
  }
}

router.get('/dashboard', async (req, res) => {
  try {
    const { sectors = '', tickers = '' } = req.query
    const mySectors = sectors.split(',').filter(Boolean).map(s => s.toLowerCase())
    const myTickers = tickers.split(',').filter(Boolean).map(t => t.toLowerCase())

    const articles = await fetchRSS('https://finance.yahoo.com/news/rssindex')

    const inSector = []
    const outSector = []

    const SECTOR_KEYWORDS = {
      technology: ['tech','ai','chip','semiconductor','nvidia','apple','google','microsoft','software','cloud','meta','amazon'],
      finance: ['bank','fed','rate','inflation','finance','market','interest','bond','treasury','jpmorgan','goldman'],
      healthcare: ['health','drug','medical','pharma','biotech','fda','vaccine','lilly','pfizer','merck'],
      energy: ['oil','energy','gas','crude','opec','exxon','chevron','solar','wind','renewable'],
      consumer: ['retail','consumer','spend','walmart','amazon','target','shop'],
      'real estate': ['reit','real estate','property','housing','mortgage'],
      'bonds & gold': ['gold','bond','treasury','yield','silver','commodity'],
      diversified: ['etf','index','fund','vanguard','blackrock','sp500','nasdaq'],
    }

    articles.forEach(a => {
      const text = a.title.toLowerCase()
      const matchTicker = myTickers.some(t => text.includes(t))
      const matchSector = mySectors.some(s => {
        const keywords = SECTOR_KEYWORDS[s] || [s]
        return keywords.some(kw => text.includes(kw))
      })
      if (matchTicker || matchSector) inSector.push(a)
      else outSector.push(a)
    })

    res.json({
      inSectorNews: (inSector.length ? inSector : articles).slice(0, 12),
      outSectorNews: outSector.slice(0, 12),
      cachedAt: new Date().toISOString()
    })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.get('/ticker/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.replace('.', '-').replace('/', '-')
    const articles = await fetchRSS(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}`)
    res.json(articles.slice(0, 15))
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
