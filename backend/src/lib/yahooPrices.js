import { yahooSymbolsForHolding, toYahooTicker } from './ticker.js'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'

export async function fetchLiveQuote(yahooSymbol) {
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(yahooSymbol)}?interval=1d&range=1d`
  const r = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT },
    signal: AbortSignal.timeout(8000),
  })
  const data = await r.json()
  const meta = data?.chart?.result?.[0]?.meta
  if (!meta?.regularMarketPrice) return null

  const price = meta.regularMarketPrice
  const prev = meta.chartPreviousClose || meta.previousClose || 0
  return {
    price,
    changePct: prev > 0 ? ((price - prev) / prev) * 100 : 0,
    previousClose: prev,
    currency: meta.currency,
    symbol: meta.symbol,
  }
}

function pickBestQuote(quotes, { currency, portfolioCurrency }) {
  if (!quotes.length) return null
  if (quotes.length === 1) return quotes[0]

  const bk = quotes.find((q) => q.symbol?.endsWith('.BK'))
  const us = quotes.find((q) => q.currency === 'USD' && !q.symbol?.endsWith('.BK'))

  if (bk && us && bk.symbol !== us.symbol) {
    if (currency === 'THB' || portfolioCurrency === 'THB') return bk
    // Mislabeled Thai tickers (e.g. SCB US penny vs SCB.BK)
    if (bk.price < 10000 && us.price > 500) return bk
  }

  const preferThb = currency === 'THB' || portfolioCurrency === 'THB'
  if (preferThb) {
    const thb = quotes.find((q) => q.currency === 'THB')
    if (thb) return thb
    if (bk) return bk
  }

  const preferUsd = currency === 'USD' || portfolioCurrency === 'USD'
  if (preferUsd && us) return us

  return quotes[0]
}

export async function fetchHoldingQuote(ticker, market, currency, portfolioCurrency) {
  const symbols = yahooSymbolsForHolding(ticker, market, currency, portfolioCurrency)
  const quotes = []

  for (const symbol of symbols) {
    try {
      const quote = await fetchLiveQuote(symbol)
      if (quote) quotes.push(quote)
    } catch (e) {
      console.error(`Price fetch error for ${ticker} (${symbol}):`, e.message)
    }
  }

  return pickBestQuote(quotes, { currency, portfolioCurrency })
}
