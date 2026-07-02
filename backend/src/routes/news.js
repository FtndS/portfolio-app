import express from 'express'
import { serverError } from '../lib/httpErrors.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  SECTOR_KEYWORDS,
  THAI_BANK_TICKER_HINTS,
  THAI_FINANCE_HINTS,
} from '../config/newsHints.js'

const router = express.Router()
router.use(authMiddleware)

// Cache 15 นาที
const cache = new Map()
const CACHE_TTL = 15 * 60 * 1000

function normalizeArticle(article, fallbackSource = 'Unknown') {
  return {
    title: String(article?.title || '').trim(),
    url: String(article?.url || '').trim(),
    publishedAt: String(article?.publishedAt || '').trim(),
    source: { name: String(article?.source?.name || article?.source || fallbackSource).trim() || fallbackSource },
  }
}

function dedupeArticles(articles) {
  const seen = new Set()
  const out = []
  for (const item of articles) {
    const a = normalizeArticle(item)
    if (!a.title || !a.url) continue
    const key = `${a.url.toLowerCase()}|${a.title.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    out.push(a)
  }
  return out
}

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
    const plainTickers = myTickers.map((t) => t.replace(/-bk$/i, '').toUpperCase())

    const tickerHints = plainTickers.flatMap((t) => THAI_BANK_TICKER_HINTS[t] || [t]).filter(Boolean)
    const queryHints = [...new Set([
      ...tickerHints,
      ...mySectors.flatMap((s) => SECTOR_KEYWORDS[s] || [s]),
      ...THAI_FINANCE_HINTS,
    ])].slice(0, 14)

    const googleQuery = encodeURIComponent(queryHints.join(' OR '))
    const [yahooArticles, googleArticles] = await Promise.all([
      fetchRSS('https://finance.yahoo.com/news/rssindex'),
      fetchRSS(`https://news.google.com/rss/search?q=${googleQuery}&hl=th&gl=TH&ceid=TH:th`),
    ])
    const articles = dedupeArticles([
      ...yahooArticles.map((a) => normalizeArticle(a, 'Yahoo Finance')),
      ...googleArticles.map((a) => normalizeArticle(a, 'Google News')),
    ])

    const inSector = []
    const outSector = []

    articles.forEach(a => {
      const text = a.title.toLowerCase()
      const matchTicker = myTickers.some(t => text.includes(t))
        || plainTickers.some((t) => text.includes(t.toLowerCase()))
        || tickerHints.some((t) => text.includes(String(t).toLowerCase()))
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
    serverError(res, err)
  }
})

router.get('/ticker/:symbol', async (req, res) => {
  try {
    const symbol = req.params.symbol.replace('.', '-').replace('/', '-')
    const plainSymbol = symbol.replace(/-BK$/i, '')
    const hintQuery = encodeURIComponent(`${plainSymbol} OR ${plainSymbol}-BK OR หุ้น ${plainSymbol}`)
    const [yahoo, google] = await Promise.all([
      fetchRSS(`https://feeds.finance.yahoo.com/rss/2.0/headline?s=${symbol}`),
      fetchRSS(`https://news.google.com/rss/search?q=${hintQuery}&hl=th&gl=TH&ceid=TH:th`),
    ])
    res.json(dedupeArticles([...yahoo, ...google]).slice(0, 15))
  } catch (err) {
    serverError(res, err)
  }
})

export default router
