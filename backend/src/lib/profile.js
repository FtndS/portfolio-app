import { toYahooTicker } from './ticker.js'
import { yahooGet } from './yahooAuth.js'

const QUOTE_SUMMARY_MODULES = [
  'assetProfile',
  'price',
  'fundProfile',
  'quoteType',
  'summaryProfile',
].join(',')

function resolveSector(result) {
  const sector = result.assetProfile?.sector
  if (sector) return sector

  const quoteType = result.price?.quoteType || result.quoteType?.quoteType
  if (quoteType === 'ETF' || quoteType === 'MUTUALFUND') {
    const category = result.fundProfile?.categoryName
      || result.summaryProfile?.category
    if (category) return `ETF — ${category}`
  }

  const industry = result.assetProfile?.industry
  if (industry) return industry

  return null
}

async function fetchQuoteSummary(yahooTicker) {
  const url = `https://query2.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(yahooTicker)}?modules=${QUOTE_SUMMARY_MODULES}`
  const response = await yahooGet(url)
  if (!response.ok) {
    console.error(`Yahoo quoteSummary ${yahooTicker}: HTTP ${response.status}`)
    return null
  }

  const data = await response.json()
  const error = data?.finance?.error || data?.quoteSummary?.error
  if (error) {
    console.error(`Yahoo quoteSummary ${yahooTicker}:`, error.description || error.code)
    return null
  }

  const result = data.quoteSummary?.result?.[0]
  if (!result) return null

  const sector = resolveSector(result)
  return {
    name: result.price?.longName || result.price?.shortName || '',
    sector,
  }
}

export async function fetchCompanyProfile(ticker, market = 'US') {
  const yahooTicker = toYahooTicker(ticker, market)

  try {
    const profile = await fetchQuoteSummary(yahooTicker)
    if (profile?.sector) {
      return {
        name: profile.name || '',
        sector: profile.sector,
      }
    }

    return {
      name: profile?.name || '',
      sector: 'Other',
    }
  } catch (e) {
    console.error(`Profile fetch failed for ${yahooTicker}:`, e.message)
    return { name: '', sector: 'Other' }
  }
}

export function needsSectorRefresh(sector) {
  return !sector || sector === 'Other'
}

export async function resolveSectorForHolding(ticker, market = 'US') {
  const profile = await fetchCompanyProfile(ticker, market)
  return profile.sector
}
