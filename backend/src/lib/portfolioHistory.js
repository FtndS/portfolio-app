import pool from '../db/index.js'
import { toYahooTicker } from './ticker.js'

const priceHistoryCache = new Map()
const PRICE_HIST_TTL = 30 * 60 * 1000

async function fetchHistoricalPrices(ticker, range = '6mo') {
  const yahoo = toYahooTicker(ticker)
  const cacheKey = `${yahoo}:${range}`
  const cached = priceHistoryCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PRICE_HIST_TTL) return cached.data

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahoo)}?interval=1d&range=${range}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(10000),
    })
    const data = await res.json()
    const result = data.chart?.result?.[0]
    if (!result) return {}
    const timestamps = result.timestamp || []
    const closes = result.indicators?.quote?.[0]?.close || []
    const map = {}
    timestamps.forEach((ts, i) => {
      if (closes[i] != null) {
        map[new Date(ts * 1000).toISOString().split('T')[0]] = closes[i]
      }
    })
    priceHistoryCache.set(cacheKey, { data: map, ts: Date.now() })
    return map
  } catch (e) {
    console.error(`Historical price error for ${yahoo}:`, e.message)
    return {}
  }
}

function priceOnDate(priceMap, dateStr, fallback = 0) {
  if (priceMap[dateStr] != null) return priceMap[dateStr]
  const dates = Object.keys(priceMap).filter(d => d <= dateStr).sort()
  return dates.length ? priceMap[dates[dates.length - 1]] : fallback
}

function positionsAtDate(transactions, dateStr) {
  const positions = {}
  const avgCosts = {}
  for (const tx of transactions) {
    const txDate = (tx.date instanceof Date ? tx.date.toISOString() : String(tx.date)).split('T')[0]
    if (txDate > dateStr) continue
    const sh = parseFloat(tx.shares)
    const price = parseFloat(tx.price)
    if (tx.type === 'BUY') {
      const prev = positions[tx.ticker] || 0
      const prevCost = (avgCosts[tx.ticker] || 0) * prev
      const next = prev + sh
      positions[tx.ticker] = next
      avgCosts[tx.ticker] = next > 0 ? (prevCost + sh * price) / next : 0
    } else {
      const next = (positions[tx.ticker] || 0) - sh
      if (next <= 0.000001) {
        delete positions[tx.ticker]
        delete avgCosts[tx.ticker]
      } else {
        positions[tx.ticker] = next
      }
    }
  }
  return { positions, avgCosts }
}

function buildSampleDates(transactions, days) {
  const dates = new Set()
  const today = new Date().toISOString().split('T')[0]
  dates.add(today)

  for (const tx of transactions) {
    dates.add((tx.date instanceof Date ? tx.date.toISOString() : String(tx.date)).split('T')[0])
  }

  if (transactions.length) {
    const first = [...dates].sort()[0]
    const start = new Date(first)
    const end = new Date(today)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 7)) {
      dates.add(d.toISOString().split('T')[0])
    }
  }

  const cutoff = new Date()
  cutoff.setDate(cutoff.getDate() - days)
  const cutoffStr = cutoff.toISOString().split('T')[0]

  return [...dates].filter(d => d >= cutoffStr).sort()
}

export async function computePortfolioHistory(userId, portfolioId, days = 90) {
  const txResult = await pool.query(
    `SELECT ticker, type, shares, price, date FROM transactions
     WHERE user_id = $1 AND portfolio_id = $2 ORDER BY date ASC, created_at ASC`,
    [userId, portfolioId]
  )
  const transactions = txResult.rows

  const snapshotResult = await pool.query(
    `SELECT snapshot_date AS date, total_value, total_cost
     FROM portfolio_snapshots
     WHERE portfolio_id = $1 AND snapshot_date >= CURRENT_DATE - $2::int
     ORDER BY snapshot_date ASC`,
    [portfolioId, days]
  )
  const snapshotMap = Object.fromEntries(
    snapshotResult.rows.map(r => [String(r.date).split('T')[0], r])
  )

  if (!transactions.length) {
    return snapshotResult.rows.map(r => ({
      date: r.date,
      total_value: Number(r.total_value),
      total_cost: Number(r.total_cost),
      source: 'snapshot',
    }))
  }

  const tickers = [...new Set(transactions.map(t => t.ticker))]
  const range = days <= 90 ? '3mo' : days <= 180 ? '6mo' : '1y'
  const priceMaps = {}
  await Promise.all(tickers.map(async (t) => {
    priceMaps[t] = await fetchHistoricalPrices(t, range)
  }))

  const sampleDates = buildSampleDates(transactions, days)
  const points = []

  for (const dateStr of sampleDates) {
    if (snapshotMap[dateStr]) {
      const s = snapshotMap[dateStr]
      points.push({
        date: dateStr,
        total_value: Number(s.total_value),
        total_cost: Number(s.total_cost),
        source: 'snapshot',
      })
      continue
    }

    const { positions, avgCosts } = positionsAtDate(transactions, dateStr)
    let totalValue = 0
    let totalCost = 0
    for (const [ticker, shares] of Object.entries(positions)) {
      const avg = avgCosts[ticker] || 0
      const px = priceOnDate(priceMaps[ticker], dateStr, avg)
      totalValue += shares * px
      totalCost += shares * avg
    }

    if (totalCost > 0 || totalValue > 0) {
      points.push({
        date: dateStr,
        total_value: Math.round(totalValue * 100) / 100,
        total_cost: Math.round(totalCost * 100) / 100,
        source: 'computed',
      })
    }
  }

  const seen = new Set()
  const unique = points.filter(p => {
    if (seen.has(p.date)) return false
    seen.add(p.date)
    return true
  })

  if (unique.length < 2 && unique.length > 0) {
    const d = new Date(unique[0].date)
    d.setDate(d.getDate() - 7)
    unique.unshift({
      date: d.toISOString().split('T')[0],
      total_value: 0,
      total_cost: 0,
      source: 'computed',
    })
  }

  return unique.sort((a, b) => a.date.localeCompare(b.date))
}
