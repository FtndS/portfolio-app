import { convertAmount } from './currency.js'

function txDateStr(tx) {
  return String(tx?.date || '').split('T')[0]
}

function cashFlowOnDate(transactions, dateStr, displayCurrency = 'USD', usdThb = 35) {
  let cf = 0
  for (const tx of transactions || []) {
    if (txDateStr(tx) !== dateStr) continue
    const sh = Number(tx.shares)
    const price = Number(tx.price)
    const fee = Number(tx.fee || 0)
    const amount = sh * price + fee
    const ccy = String(tx.currency || 'USD').toUpperCase()
    const converted = convertAmount(amount, ccy, displayCurrency, usdThb)
    if (tx.type === 'BUY') cf += converted
    else if (tx.type === 'SELL') cf -= converted
  }
  return cf
}

/** Chain-linked return excluding net deposits/withdrawals (matches backend). */
export function attachPerformancePct(points, transactions = [], { displayCurrency = 'USD', usdThb = 35 } = {}) {
  if (!points?.length) return points || []

  const result = [{ ...points[0], performance_pct: 0 }]
  let chain = 1

  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    const v0 = Number(points[i - 1].total_value) || 0
    const v1 = Number(p.total_value) || 0
    const cf = cashFlowOnDate(transactions, p.date, displayCurrency, usdThb)

    if (v0 > 0) {
      chain *= 1 + (v1 - v0 - cf) / v0
    }

    result.push({
      ...p,
      performance_pct: Math.round((chain - 1) * 10000) / 100,
    })
  }

  return result
}

/** Merge holdings with the same ticker + currency across portfolios (weighted avg cost). */
export function aggregateHoldingsByTicker(holdings) {
  const map = new Map()
  for (const h of holdings) {
    const ticker = String(h.ticker || '').toUpperCase()
    if (!ticker) continue
    const ccy = String(h.currency || 'USD').toUpperCase()
    const key = `${ticker}\0${ccy}`
    const shares = Number(h.shares)
    if (!Number.isFinite(shares) || shares <= 0) continue

    const costBasis = shares * Number(h.avg_cost)
    const existing = map.get(key)
    if (!existing) {
      map.set(key, {
        ...h,
        id: `agg-${ticker}-${ccy}`,
        ticker,
        currency: ccy,
        shares,
        _costBasis: costBasis,
      })
      continue
    }
    existing.shares += shares
    existing._costBasis += costBasis
  }

  return [...map.values()].map((row) => ({
    ...row,
    avg_cost: row.shares > 0 ? row._costBasis / row.shares : Number(row.avg_cost),
  }))
}

export function normalizeHistoryResponse(res) {
  if (Array.isArray(res)) return res
  return Array.isArray(res?.history) ? res.history : []
}

function forwardFillHistory(batch, portfolioCurrency, displayCurrency, usdThb) {
  const portCcy = portfolioCurrency || 'USD'
  const rows = normalizeHistoryResponse(batch)
    .map((row) => {
      const date = String(row.date || '').split('T')[0]
      if (!date) return null
      return {
        date,
        total_value: convertAmount(row.total_value, portCcy, displayCurrency, usdThb),
        total_cost: convertAmount(row.total_cost || 0, portCcy, displayCurrency, usdThb),
      }
    })
    .filter(Boolean)
    .sort((a, b) => a.date.localeCompare(b.date))

  const byDate = new Map(rows.map((r) => [r.date, r]))
  return { byDate, rows }
}

/**
 * Sum portfolio value/cost by date across multiple portfolios (with FX).
 * Forward-fills each portfolio so sparse sample grids do not drop holdings on gap dates.
 * @param {{ batch: unknown, portfolioCurrency: string }[]} entries
 */
export function mergePortfolioHistories(entries, { displayCurrency = 'USD', usdThb = 35 } = {}) {
  const filled = entries.map(({ batch, portfolioCurrency }) =>
    forwardFillHistory(batch, portfolioCurrency, displayCurrency, usdThb)
  )

  const dateSet = new Set()
  for (const { rows } of filled) {
    for (const row of rows) dateSet.add(row.date)
  }
  const allDates = [...dateSet].sort()
  if (!allDates.length) return []

  return allDates.map((date) => {
    let total_value = 0
    let total_cost = 0
    for (const { byDate, rows } of filled) {
      if (!rows.length) continue
      let last = null
      for (const row of rows) {
        if (row.date > date) break
        last = row
      }
      const point = byDate.get(date) || last
      if (!point) continue
      total_value += point.total_value
      total_cost += point.total_cost
    }
    return { date, total_value, total_cost }
  })
}

export function mergePortfolioHistoriesWithPerformance(entries, options = {}) {
  const { displayCurrency = 'USD', usdThb = 35, transactions = [] } = options
  const merged = mergePortfolioHistories(entries, { displayCurrency, usdThb })
  return attachPerformancePct(merged, transactions, { displayCurrency, usdThb })
}

export function convertHistoryToDisplay(history, portfolioCurrency, displayCurrency, usdThb = 35) {
  const portCcy = portfolioCurrency || 'USD'
  return (history || []).map((row) => ({
    ...row,
    total_value: convertAmount(row.total_value, portCcy, displayCurrency, usdThb),
    total_cost: convertAmount(row.total_cost || 0, portCcy, displayCurrency, usdThb),
  }))
}

export function portfolioNameById(portfolios, id) {
  return portfolios.find((p) => Number(p.id) === Number(id))?.name || 'พอร์ต'
}

/** Infer native currency from holdings when portfolios.currency is stale (e.g. THB port still marked USD). */
export function inferPortfolioCurrency(portfolio, holdings = []) {
  const portHoldings = holdings.filter((h) => Number(h.portfolio_id) === Number(portfolio?.id))
  if (!portHoldings.length) return portfolio?.currency || 'USD'

  const counts = {}
  for (const h of portHoldings) {
    const c = String(h.currency || 'USD').toUpperCase()
    counts[c] = (counts[c] || 0) + 1
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD'
  const explicit = String(portfolio?.currency || '').toUpperCase()

  if ((counts[dominant] || 0) >= portHoldings.length * 0.5) return dominant
  return explicit || dominant || 'USD'
}

export function extractBenchmark(res) {
  if (!res || res.ok === false) return null
  if (Array.isArray(res.benchmarks) && res.benchmarks.length) return res.benchmarks[0]
  if (res.benchmark?.series?.length) return res.benchmark
  return null
}
