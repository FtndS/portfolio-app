import pool from '../db/index.js'
import { toYahooTicker, resolveMarket } from './ticker.js'

const priceHistoryCache = new Map()
const PRICE_HIST_TTL = 30 * 60 * 1000

export const BENCHMARKS = {
  sp500: { symbol: '^GSPC', label: 'S&P 500' },
  set: { symbol: '^SET.BK', label: 'SET Index' },
}

export function resolveDaysParam(daysParam) {
  if (daysParam === 'ytd') {
    const now = new Date()
    const start = new Date(now.getFullYear(), 0, 1)
    return Math.max(1, Math.ceil((now - start) / 86400000) + 1)
  }
  if (daysParam === 'all') return 3650
  const n = parseInt(daysParam, 10)
  return Number.isFinite(n) && n > 0 ? Math.min(n, 3650) : 90
}

export function daysToYahooRange(days) {
  const d = typeof days === 'number' ? days : 90
  if (d > 1825) return '5y'
  if (d > 730) return '2y'
  if (d > 365) return '1y'
  if (d > 180) return '6mo'
  if (d > 90) return '3mo'
  return '1mo'
}

export function resolveBenchmark(holdings, portfolioCurrency, preference = 'auto') {
  if (preference === 'none') return null
  if (preference === 'sp500') return BENCHMARKS.sp500
  if (preference === 'set') return BENCHMARKS.set

  if (!holdings?.length) {
    return portfolioCurrency === 'THB' ? BENCHMARKS.set : BENCHMARKS.sp500
  }

  const thbCount = holdings.filter((h) => (h.currency || 'USD') === 'THB').length
  return thbCount > holdings.length / 2 ? BENCHMARKS.set : BENCHMARKS.sp500
}

async function fetchYahooDailyCloses(yahooSymbol, days) {
  const range = daysToYahooRange(days)
  const cacheKey = `${yahooSymbol}:${range}`
  const cached = priceHistoryCache.get(cacheKey)
  if (cached && Date.now() - cached.ts < PRICE_HIST_TTL) return cached.data

  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=${range}`
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
    console.error(`Historical price error for ${yahooSymbol}:`, e.message)
    return {}
  }
}

async function fetchHistoricalPrices(ticker, days, meta = {}) {
  const yahoo = toYahooTicker(ticker, resolveMarket(ticker, meta.market, meta.currency))
  return fetchYahooDailyCloses(yahoo, days)
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

  const step = days > 365 ? 14 : days > 180 ? 7 : 1

  if (transactions.length) {
    const first = [...dates].sort()[0]
    const start = new Date(first)
    const end = new Date(today)
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + step)) {
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

  const holdingMetaResult = await pool.query(
    'SELECT ticker, market, currency FROM holdings WHERE user_id = $1 AND portfolio_id = $2',
    [userId, portfolioId]
  )
  const holdingMeta = Object.fromEntries(
    holdingMetaResult.rows.map((r) => [r.ticker, r])
  )

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
  const priceMaps = {}
  await Promise.all(tickers.map(async (t) => {
    priceMaps[t] = await fetchHistoricalPrices(t, days, holdingMeta[t] || {})
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

export async function computeBenchmarkHistory(benchmark, historyDates, days) {
  if (!benchmark || !historyDates?.length) {
    return { label: benchmark?.label, symbol: benchmark?.symbol, series: [], changePct: 0 }
  }

  const priceMap = await fetchYahooDailyCloses(benchmark.symbol, days)
  const series = historyDates
    .map((date) => {
      const dateStr = String(date).split('T')[0]
      const close = priceOnDate(priceMap, dateStr, null)
      return close != null ? { date: dateStr, close } : null
    })
    .filter(Boolean)

  if (!series.length) {
    return { label: benchmark.label, symbol: benchmark.symbol, series: [], changePct: 0 }
  }

  const firstClose = series[0].close
  const normalized = series.map((p) => ({
    date: p.date,
    close: p.close,
    indexed: firstClose > 0 ? (p.close / firstClose) * 100 : 100,
  }))

  const last = normalized[normalized.length - 1]
  const changePct = last.indexed - 100

  return {
    label: benchmark.label,
    symbol: benchmark.symbol,
    series: normalized,
    changePct: Math.round(changePct * 100) / 100,
  }
}
