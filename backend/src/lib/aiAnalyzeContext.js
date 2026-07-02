function isoDate(value) {
  if (!value) return ''
  const s = String(value).trim()
  const m = s.match(/^(\d{4}-\d{2}-\d{2})/)
  return m ? m[1] : s.split('T')[0]
}

function num(v) {
  const n = Number(v)
  return Number.isFinite(n) ? n : 0
}

export function summarizeTransactions(transactions, { maxItems = 30, maxRecent } = {}) {
  const recentLimit = maxRecent ?? maxItems
  const list = Array.isArray(transactions) ? [...transactions] : []
  if (!list.length) {
    return {
      stats: { total: 0, buys: 0, sells: 0, uniqueTickers: 0, activeDays: 0 },
      byTicker: [],
      recent: [],
    }
  }

  const sorted = list.sort((a, b) => isoDate(b.date).localeCompare(isoDate(a.date)))
  const byTicker = {}
  const daySet = new Set()

  for (const t of sorted) {
    const ticker = String(t.ticker || '').toUpperCase()
    if (!ticker) continue
    const type = String(t.type || '').toUpperCase()
    const total = num(t.total)
    const shares = num(t.shares)
    const date = isoDate(t.date)
    if (date) daySet.add(date)

    if (!byTicker[ticker]) {
      byTicker[ticker] = {
        ticker,
        buys: 0,
        sells: 0,
        buyValue: 0,
        sellValue: 0,
        buyShares: 0,
        sellShares: 0,
        lastTrade: date,
        firstTrade: date,
      }
    }
    const row = byTicker[ticker]
    if (date && date < row.firstTrade) row.firstTrade = date
    if (date && date > row.lastTrade) row.lastTrade = date

    if (type === 'BUY') {
      row.buys += 1
      row.buyValue += total
      row.buyShares += shares
    } else if (type === 'SELL') {
      row.sells += 1
      row.sellValue += total
      row.sellShares += shares
    }
  }

  const tickerRows = Object.values(byTicker)
    .map((r) => ({
      ...r,
      netFlow: r.buyValue - r.sellValue,
      tradeCount: r.buys + r.sells,
      churnRatio: r.sells > 0 && r.buys > 0 ? Number((r.sells / r.buys).toFixed(2)) : null,
    }))
    .sort((a, b) => b.tradeCount - a.tradeCount)

  const buys = list.filter((t) => String(t.type).toUpperCase() === 'BUY').length
  const sells = list.filter((t) => String(t.type).toUpperCase() === 'SELL').length

  const recent = sorted.slice(0, recentLimit).map((t) => ({
    date: isoDate(t.date),
    ticker: String(t.ticker || '').toUpperCase(),
    type: String(t.type || '').toUpperCase(),
    shares: num(t.shares),
    price: num(t.price),
    total: num(t.total),
    currency: t.currency || 'USD',
    note: String(t.note || '').slice(0, 120) || undefined,
  }))

  return {
    stats: {
      total: list.length,
      buys,
      sells,
      uniqueTickers: tickerRows.length,
      activeDays: daySet.size,
      sellBuyRatio: buys > 0 ? Number((sells / buys).toFixed(2)) : sells > 0 ? sells : 0,
    },
    byTicker: tickerRows.slice(0, 20),
    recent,
  }
}

export function summarizeJournal(journal, { maxItems = 12 } = {}) {
  const list = Array.isArray(journal) ? [...journal] : []
  if (!list.length) {
    return { stats: { total: 0, tags: [] }, entries: [] }
  }

  const sorted = list.sort((a, b) => isoDate(b.date).localeCompare(isoDate(a.date)))
  const tagCount = {}
  for (const j of sorted) {
    const tag = j.tag || 'ไม่มี tag'
    tagCount[tag] = (tagCount[tag] || 0) + 1
  }

  const tags = Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const entries = sorted.slice(0, maxItems).map((j) => ({
    date: isoDate(j.date),
    title: String(j.title || '').slice(0, 80) || undefined,
    tag: j.tag || undefined,
    tickers: j.tickers ? String(j.tickers).slice(0, 80) : undefined,
    content: String(j.content || '').slice(0, 320),
  }))

  return {
    stats: { total: list.length, tags },
    entries,
  }
}

export function buildAnalyzePayload({
  holdings,
  prices,
  displayCurrency,
  fxRate,
  transactions,
  journal,
  planConfig,
}) {
  const txSummary = summarizeTransactions(transactions, {
    maxRecent: planConfig.analyze.maxRecentInPrompt ?? planConfig.analyze.maxTransactions,
  })
  const journalSummary = summarizeJournal(journal, {
    maxItems: planConfig.analyze.maxJournal,
  })

  const portfolioData = holdings.map((h) => {
    const price = prices[h.ticker] || h.avg_cost
    const value = h.shares * price
    const valueDisplay = displayCurrency === 'THB'
      ? (h.currency === 'THB' ? value : value * fxRate)
      : (h.currency === 'THB' ? value / fxRate : value)
    const cost = h.shares * h.avg_cost
    const costDisplay = displayCurrency === 'THB'
      ? (h.currency === 'THB' ? cost : cost * fxRate)
      : (h.currency === 'THB' ? cost / fxRate : cost)
    const pnlPct = costDisplay > 0 ? ((valueDisplay - costDisplay) / costDisplay) * 100 : 0
    const dayChg = prices[`${h.ticker}_chg`] || 0
    const tickerTx = txSummary.byTicker.find((r) => r.ticker === String(h.ticker).toUpperCase())
    return {
      ticker: h.ticker,
      name: h.name || h.ticker,
      sector: h.sector || 'Unknown',
      shares: h.shares,
      avgCost: h.avg_cost,
      currentPrice: price,
      currency: h.currency,
      value: valueDisplay,
      pnlPct: pnlPct.toFixed(2),
      dayChange: dayChg.toFixed(2),
      tradeActivity: tickerTx
        ? {
            buys: tickerTx.buys,
            sells: tickerTx.sells,
            lastTrade: tickerTx.lastTrade,
            churnRatio: tickerTx.churnRatio,
          }
        : null,
    }
  })

  const totalValue = portfolioData.reduce((s, h) => s + h.value, 0)
  const portfolioWithPct = portfolioData.map((h) => ({
    ...h,
    allocation: totalValue > 0 ? ((h.value / totalValue) * 100).toFixed(1) : '0',
  }))

  const sectorMap = {}
  portfolioWithPct.forEach((h) => {
    sectorMap[h.sector] = (sectorMap[h.sector] || 0) + h.value
  })
  const sectorAlloc = Object.entries(sectorMap)
    .map(([s, v]) => ({ sector: s, pct: totalValue > 0 ? ((v / totalValue) * 100).toFixed(1) : '0' }))
    .sort((a, b) => Number(b.pct) - Number(a.pct))

  return {
    portfolioWithPct,
    sectorAlloc,
    totalValue,
    txSummary,
    journalSummary,
    dataScope: {
      transactionsIncluded: txSummary.recent.length,
      transactionsTotal: txSummary.stats.total,
      journalIncluded: journalSummary.entries.length,
      journalTotal: journalSummary.stats.total,
      plan: planConfig.id,
    },
  }
}
