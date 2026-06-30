import { convertAmount } from './currency.js'

function txDateStr(tx) {
  return String(tx?.date || '').split('T')[0]
}

function cashFlowOnDate(transactions, dateStr) {
  let cf = 0
  for (const tx of transactions || []) {
    if (txDateStr(tx) !== dateStr) continue
    const sh = Number(tx.shares)
    const price = Number(tx.price)
    const fee = Number(tx.fee || 0)
    const amount = sh * price + fee
    if (tx.type === 'BUY') cf += amount
    else if (tx.type === 'SELL') cf -= amount
  }
  return cf
}

/** Chain-linked return excluding net deposits/withdrawals (matches backend). */
export function attachPerformancePct(points, transactions = []) {
  if (!points?.length) return points || []

  const result = [{ ...points[0], performance_pct: 0 }]
  let chain = 1

  for (let i = 1; i < points.length; i++) {
    const p = points[i]
    const v0 = Number(points[i - 1].total_value) || 0
    const v1 = Number(p.total_value) || 0
    const cf = cashFlowOnDate(transactions, p.date)

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

/**
 * Sum portfolio value/cost by date across multiple portfolios (with FX).
 * @param {{ batch: unknown, portfolioCurrency: string }[]} entries
 */
export function mergePortfolioHistories(entries, { displayCurrency = 'USD', usdThb = 35 } = {}) {
  const byDate = new Map()
  for (const { batch, portfolioCurrency } of entries) {
    const portCcy = portfolioCurrency || 'USD'
    for (const row of normalizeHistoryResponse(batch)) {
      const date = String(row.date || '').split('T')[0]
      if (!date) continue
      const prev = byDate.get(date) || { date, total_value: 0, total_cost: 0 }
      prev.total_value += convertAmount(row.total_value, portCcy, displayCurrency, usdThb)
      prev.total_cost += convertAmount(row.total_cost || 0, portCcy, displayCurrency, usdThb)
      byDate.set(date, prev)
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function mergePortfolioHistoriesWithPerformance(entries, options = {}) {
  const merged = mergePortfolioHistories(entries, options)
  const transactions = options.transactions || []
  return attachPerformancePct(merged, transactions)
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
