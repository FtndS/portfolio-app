/** Merge holdings with the same ticker across portfolios (weighted avg cost). */
export function aggregateHoldingsByTicker(holdings) {
  const map = new Map()
  for (const h of holdings) {
    const ticker = String(h.ticker || '').toUpperCase()
    if (!ticker) continue
    const shares = Number(h.shares)
    if (!Number.isFinite(shares) || shares <= 0) continue

    const costBasis = shares * Number(h.avg_cost)
    const existing = map.get(ticker)
    if (!existing) {
      map.set(ticker, {
        ...h,
        id: `agg-${ticker}`,
        ticker,
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

/** Sum portfolio value/cost by date across multiple histories. */
export function mergePortfolioHistories(historyBatches) {
  const byDate = new Map()
  for (const batch of historyBatches) {
    for (const row of normalizeHistoryResponse(batch)) {
      const date = String(row.date || '').split('T')[0]
      if (!date) continue
      const prev = byDate.get(date) || { date, total_value: 0, total_cost: 0 }
      prev.total_value += Number(row.total_value) || 0
      prev.total_cost += Number(row.total_cost) || 0
      byDate.set(date, prev)
    }
  }
  return [...byDate.values()].sort((a, b) => a.date.localeCompare(b.date))
}

export function portfolioNameById(portfolios, id) {
  return portfolios.find((p) => Number(p.id) === Number(id))?.name || 'พอร์ต'
}
