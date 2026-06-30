import { sanitizeTicker } from './constants'

const EXCHANGE_SUFFIXES = ['BK', 'HK', 'SS', 'SZ']

const MARKET_META = {
  US: { suffix: '' },
  SET: { suffix: '.BK' },
  CRYPTO: { suffix: '' },
  HK: { suffix: '.HK' },
  CN: { suffix: '.SS' },
  SZ: { suffix: '.SZ' },
}

export function hasExchangeSuffix(ticker) {
  const base = sanitizeTicker(ticker)
  if (!base.includes('-')) return false
  return EXCHANGE_SUFFIXES.includes(base.split('-').pop())
}

export function toYahooTicker(ticker, market = 'US') {
  const base = sanitizeTicker(ticker)
  if (!base) return ''

  if (market === 'CRYPTO') {
    if (/^[A-Z0-9]+-[A-Z0-9]{3,5}$/.test(base)) return base
    return `${base}-USD`
  }

  if (base.includes('-')) {
    const parts = base.split('-')
    const suffix = parts[parts.length - 1]
    if (EXCHANGE_SUFFIXES.includes(suffix)) {
      return `${parts.slice(0, -1).join('-')}.${suffix}`
    }
  }

  const m = MARKET_META[market] || MARKET_META.US
  if (m.suffix && !base.endsWith(m.suffix.replace('.', '-'))) {
    return base + m.suffix
  }
  if (/^[A-Z0-9]+-[A-Z]$/.test(base)) return base
  return base.replace(/-([A-Z]{2})$/, '.$1')
}

export function resolveMarket(ticker, market, currency) {
  const raw = sanitizeTicker(ticker)
  if (/^[A-Z0-9]+-(USD|USDT|THB|BTC|ETH)$/.test(raw)) return 'CRYPTO'
  if (hasExchangeSuffix(ticker)) {
    const suffix = raw.split('-').pop()
    if (suffix === 'BK') return 'SET'
    if (suffix === 'HK') return 'HK'
    if (suffix === 'SS') return 'CN'
    if (suffix === 'SZ') return 'SZ'
  }
  if (currency === 'THB') return 'SET'
  if (currency === 'HKD') return 'HK'
  if (currency === 'CNY') return 'CN'
  if (market && MARKET_META[market]) {
    if (market === 'SET') return 'SET'
    return market
  }
  return 'US'
}

/** Normalize for storage — e.g. TISCO + SET → TISCO-BK */
export function storageTicker(ticker, market, currency) {
  const m = resolveMarket(ticker, market, currency)
  return toYahooTicker(ticker, m).replace(/\./g, '-')
}

export function tickerPlaceholder(market) {
  const map = {
    SET: 'เช่น TISCO',
    HK: 'เช่น 0700',
    CN: 'เช่น 600519',
    SZ: 'เช่น 000001',
    CRYPTO: 'เช่น BTC',
    US: 'เช่น VOO',
  }
  return map[market] || 'เช่น AAPL'
}
