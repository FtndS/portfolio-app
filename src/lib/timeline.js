import { isoDate } from './format.js'

export function tickerMatches(a, b) {
  return String(a || '').trim().toUpperCase() === String(b || '').trim().toUpperCase()
}

export function journalMatchesTicker(entry, ticker) {
  if (!entry?.tickers) return false
  return entry.tickers
    .split(',')
    .map((t) => t.trim())
    .some((t) => tickerMatches(t, ticker))
}

/** Merge transactions, journal, dividends into a reverse-chronological timeline. */
export function buildTickerTimeline(ticker, { transactions = [], journal = [], dividends = [] } = {}) {
  const events = []

  for (const tx of transactions) {
    if (!tickerMatches(tx.ticker, ticker)) continue
    events.push({
      id: `tx-${tx.id}`,
      type: 'transaction',
      date: isoDate(tx.date),
      tx,
    })
  }

  for (const j of journal) {
    if (!journalMatchesTicker(j, ticker)) continue
    events.push({
      id: `j-${j.id}`,
      type: 'journal',
      date: isoDate(j.date) || isoDate(j.created_at),
      journal: j,
    })
  }

  for (const d of dividends) {
    if (!tickerMatches(d.ticker, ticker)) continue
    events.push({
      id: `d-${d.id}`,
      type: 'dividend',
      date: isoDate(d.pay_date),
      dividend: d,
    })
  }

  return events.sort((a, b) => {
    const dc = b.date.localeCompare(a.date)
    if (dc !== 0) return dc
    return String(b.id).localeCompare(String(a.id))
  })
}
