import { sanitizeTicker, toYahooTicker } from './ticker.js'
import { KNOWN_PROFILES } from '../data/known-profiles.js'

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

  // Prefer local lookup — Yahoo profile APIs often return 401 from server IPs
  if (known?.sector && known.sector !== 'Other') {
    return { name: known.name || '', sector: known.sector }
  }

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
