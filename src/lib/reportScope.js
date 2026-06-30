import { convertAmount } from './currency.js'

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
