import { sanitizeTicker, toYahooTicker } from './ticker.js'

/** Fallback when Yahoo API is blocked/unavailable from VPS */
const KNOWN_PROFILES = {
  NVDA: { name: 'NVIDIA Corporation', sector: 'Technology' },
  'BRK-B': { name: 'Berkshire Hathaway Inc.', sector: 'Financial Services' },
  VOO: { name: 'Vanguard S&P 500 ETF', sector: 'ETF — US Large Cap' },
  QQQM: { name: 'Invesco NASDAQ 100 ETF', sector: 'ETF — US Growth' },
  SMH: { name: 'VanEck Semiconductor ETF', sector: 'ETF — Semiconductors' },
  QQQ: { name: 'Invesco QQQ Trust', sector: 'ETF — Technology' },
  SPY: { name: 'SPDR S&P 500 ETF', sector: 'ETF — US Large Cap' },
  VTI: { name: 'Vanguard Total Stock Market ETF', sector: 'ETF — US Total Market' },
  AAPL: { name: 'Apple Inc.', sector: 'Technology' },
  MSFT: { name: 'Microsoft Corporation', sector: 'Technology' },
  GOOGL: { name: 'Alphabet Inc.', sector: 'Communication Services' },
  AMZN: { name: 'Amazon.com Inc.', sector: 'Consumer Cyclical' },
  META: { name: 'Meta Platforms Inc.', sector: 'Communication Services' },
  TSLA: { name: 'Tesla Inc.', sector: 'Consumer Cyclical' },
  PTT: { name: 'PTT Public Company Limited', sector: 'Energy' },
  PTTBK: { name: 'PTT Public Company Limited', sector: 'Energy' },
}

function lookupKnown(ticker) {
  const key = sanitizeTicker(ticker)
  return KNOWN_PROFILES[key] || null
}

function resolveSector(result) {
  const sector = result.assetProfile?.sector
  if (sector) return sector

  const quoteType = result.price?.quoteType || result.quoteType?.quoteType
  if (quoteType === 'ETF' || quoteType === 'MUTUALFUND') {
    const category = result.fundProfile?.categoryName
      || result.summaryProfile?.category
      || 'Index Fund'
    return `ETF — ${category}`
  }

  const industry = result.assetProfile?.industry
  if (industry) return industry

  return null
}

async function fetchQuoteSummary(yahooTicker) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=assetProfile,price,fundProfile,quoteType,summaryProfile`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const data = await response.json()
  const result = data.quoteSummary?.result?.[0]
  if (!result) return null
  const sector = resolveSector(result)
  return {
    name: result.price?.longName || result.price?.shortName || '',
    sector: sector || null,
  }
}

async function fetchQuoteV7(yahooTicker) {
  const url = `https://query1.finance.yahoo.com/v7/finance/quote?symbols=${encodeURIComponent(yahooTicker)}`
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok) return null
  const data = await response.json()
  const q = data.quoteResponse?.result?.[0]
  if (!q) return null

  let sector = q.sectorDisp || q.sector || null
  if (!sector && (q.quoteType === 'ETF' || q.quoteType === 'MUTUALFUND')) {
    sector = `ETF — ${q.category || 'Index Fund'}`
  }
  return {
    name: q.longName || q.shortName || q.symbol || '',
    sector,
  }
}

function mergeProfiles(...profiles) {
  const out = { name: '', sector: null }
  for (const p of profiles) {
    if (!p) continue
    if (p.name && !out.name) out.name = p.name
    if (p.sector && p.sector !== 'Other' && !out.sector) out.sector = p.sector
  }
  return out
}

export async function fetchCompanyProfile(ticker, market = 'US') {
  const yahooTicker = toYahooTicker(ticker, market)
  const known = lookupKnown(ticker)

  try {
    const [summary, quote] = await Promise.all([
      fetchQuoteSummary(yahooTicker),
      fetchQuoteV7(yahooTicker),
    ])
    const merged = mergeProfiles(summary, quote, known)
    return {
      name: merged.name || known?.name || '',
      sector: merged.sector || known?.sector || 'Other',
    }
  } catch (e) {
    console.error(`Profile fetch failed for ${yahooTicker}:`, e.message)
    return {
      name: known?.name || '',
      sector: known?.sector || 'Other',
    }
  }
}

export function needsSectorRefresh(sector) {
  return !sector || sector === 'Other'
}

export async function resolveSectorForHolding(ticker, market = 'US') {
  const profile = await fetchCompanyProfile(ticker, market)
  return profile.sector
}
