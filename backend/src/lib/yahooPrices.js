import { yahooSymbolsForHolding } from './ticker.js'

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
  }
}

export async function fetchHoldingQuote(ticker, market, currency) {
  const symbols = yahooSymbolsForHolding(ticker, market, currency)
  for (const symbol of symbols) {
    try {
      const quote = await fetchLiveQuote(symbol)
      if (quote) return quote
    } catch (e) {
      console.error(`Price fetch error for ${ticker} (${symbol}):`, e.message)
    }
  }
  return null
}
