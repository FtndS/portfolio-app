import { toYahooTicker } from './ticker.js'

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

  return 'Other'
}

export async function fetchCompanyProfile(ticker, market = 'US') {
  const defaultResult = { name: '', sector: 'Other' }
  const yahooTicker = toYahooTicker(ticker, market)
  try {
    const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=assetProfile,price,fundProfile,quoteType,summaryProfile`
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
      signal: AbortSignal.timeout(8000)
    })
    if (!response.ok) return defaultResult
    const data = await response.json()
    const result = data.quoteSummary?.result?.[0]
    if (!result) return defaultResult
    return {
      name: result.price?.longName || result.price?.shortName || '',
      sector: resolveSector(result)
    }
  } catch (e) {
    console.error(`Failed to fetch profile for ${yahooTicker}:`, e.message)
    return defaultResult
  }
}

export function needsSectorRefresh(sector) {
  return !sector || sector === 'Other'
}
