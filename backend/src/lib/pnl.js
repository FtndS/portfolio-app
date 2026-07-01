/** Average-cost P&L (matches holdingSync). Used by API/tests. */

const SHARES_EPS = 1e-9

function isoDate(value) {
  if (!value) return ''
  const s = String(value).trim()
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  return s.split('T')[0]
}

export function computePortfolioPnL({ transactions, holdings, prices = {}, convert }) {
  const sorted = [...(transactions || [])].sort((a, b) => {
    const d = isoDate(a.date).localeCompare(isoDate(b.date))
    if (d !== 0) return d
    return (a.id || 0) - (b.id || 0)
  })

  const state = {}
  let realized = 0

  for (const tx of sorted) {
    const ticker = tx.ticker
    const sh = Number(tx.shares)
    const price = Number(tx.price)
    const fee = Number(tx.fee || 0)
    const ccy = tx.currency || 'USD'

    if (!state[ticker]) state[ticker] = { shares: 0, avgCost: 0 }

    if (tx.type === 'BUY') {
      const prev = state[ticker]
      const prevCost = prev.shares * prev.avgCost
      const nextShares = prev.shares + sh
      prev.shares = nextShares
      prev.avgCost = nextShares > 0 ? (prevCost + sh * price + fee) / nextShares : 0
    } else {
      const prev = state[ticker]
      const proceeds = sh * price - fee
      const costBasis = sh * prev.avgCost
      realized += convert(proceeds - costBasis, ccy)
      prev.shares -= sh
      if (prev.shares <= 1e-9) {
        prev.shares = 0
        prev.avgCost = 0
      }
    }
  }

  let unrealized = 0
  for (const h of holdings || []) {
    const ticker = h.ticker
    const st = state[ticker]
    const shares = Number(h.shares)
    const avgCost =
      st && st.shares > SHARES_EPS ? st.avgCost : Number(h.avg_cost)
    const p = prices[ticker] ?? avgCost
    const val = shares * p
    const cost = shares * avgCost
    unrealized += convert(val - cost, h.currency || 'USD')
  }

  return {
    realized,
    unrealized,
    total: realized + unrealized,
    hasRealized: sorted.some((t) => t.type === 'SELL'),
  }
}

export function sumDividends(dividends, convert) {
  return (dividends || []).reduce(
    (s, d) => s + convert(Number(d.amount), d.currency || 'THB'),
    0,
  )
}

export function computeTotalReturn(pricePnL, dividendTotal) {
  const dividends = Number(dividendTotal) || 0
  return { totalReturn: pricePnL + dividends, hasDividends: dividends > 0.0001 }
}
