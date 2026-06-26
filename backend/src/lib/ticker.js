export const MARKETS = {
  US: { label: 'US', suffix: '', currencies: ['USD'] },
  SET: { label: 'Thailand (SET)', suffix: '.BK', currencies: ['THB'] },
  HK: { label: 'Hong Kong', suffix: '.HK', currencies: ['HKD'] },
  CN: { label: 'China (Shanghai)', suffix: '.SS', currencies: ['CNY'] },
  SZ: { label: 'China (Shenzhen)', suffix: '.SZ', currencies: ['CNY'] },
}

export function sanitizeTicker(ticker) {
  if (!ticker) return ''
  return ticker.trim().toUpperCase().replace(/\s+/g, '-').replace(/\./g, '-')
}

export function toYahooTicker(ticker, market = 'US') {
  const base = sanitizeTicker(ticker)
  if (!base) return ''
  if (base.includes('-')) {
    const parts = base.split('-')
    const suffix = parts[parts.length - 1]
    if (['BK', 'HK', 'SS', 'SZ'].includes(suffix)) {
      return parts.slice(0, -1).join('-') + '.' + suffix
    }
  }
  const m = MARKETS[market] || MARKETS.US
  if (m.suffix && !base.endsWith(m.suffix.replace('.', '-'))) {
    return base + m.suffix
  }
  if (m.suffix) return base.replace(/-([A-Z]{2})$/, '.$1') || base + m.suffix
  // US share classes: Yahoo uses BRK-B / BRK-A (hyphen), not BRK.B
  if (/^[A-Z0-9]+-[A-Z]$/.test(base)) return base
  return base.replace(/-([A-Z]{2})$/, '.$1')
}

export function defaultCurrency(market = 'US') {
  const m = MARKETS[market]
  return m?.currencies[0] || 'USD'
}

/** Infer exchange from ticker suffix and/or trading currency. */
export function detectMarket(ticker, currency) {
  const yahoo = toYahooTicker(ticker)
  if (yahoo.endsWith('.BK')) return 'SET'
  if (yahoo.endsWith('.HK')) return 'HK'
  if (yahoo.endsWith('.SS')) return 'CN'
  if (yahoo.endsWith('.SZ')) return 'SZ'
  if (currency === 'THB') return 'SET'
  if (currency === 'HKD') return 'HK'
  if (currency === 'CNY') return 'CN'
  return 'US'
}

export function resolveMarket(ticker, market, currency) {
  const inferred = detectMarket(ticker, currency)
  if (market && MARKETS[market]) {
    const marketCurrency = defaultCurrency(market)
    if (currency && currency !== marketCurrency && inferred !== market) {
      return inferred
    }
    return market
  }
  return inferred
}

/** Yahoo symbols to try when fetching quotes (primary + currency-based fallback). */
export function yahooSymbolsForHolding(ticker, market, currency) {
  const resolved = resolveMarket(ticker, market, currency)
  const symbols = new Set([
    toYahooTicker(ticker, resolved),
    toYahooTicker(ticker),
  ])
  if (currency === 'THB') symbols.add(toYahooTicker(ticker, 'SET'))
  if (currency === 'HKD') symbols.add(toYahooTicker(ticker, 'HK'))
  return [...symbols].filter(Boolean)
}

/** Normalize ticker for DB storage (e.g. TISCO + SET → TISCO-BK). */
export function storageTicker(ticker, market, currency) {
  const m = resolveMarket(ticker, market, currency)
  return toYahooTicker(ticker, m).replace(/\./g, '-')
}
