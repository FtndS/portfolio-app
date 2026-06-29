export const MARKETS = {
  US: { label: 'US', suffix: '', currencies: ['USD'] },
  SET: { label: 'Thailand (SET)', suffix: '.BK', currencies: ['THB'] },
  CRYPTO: { label: 'Crypto', suffix: '', currencies: ['USD'] },
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
  if (market === 'CRYPTO') {
    // Store/quote crypto as quote-pairs on Yahoo (e.g. BTC-USD).
    if (/^[A-Z0-9]+-[A-Z0-9]{3,5}$/.test(base)) return base
    return `${base}-USD`
  }
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
  const raw = sanitizeTicker(ticker)
  if (/^[A-Z0-9]+-(USD|USDT|THB|BTC|ETH)$/.test(raw)) return 'CRYPTO'
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

export function resolveMarket(ticker, market, currency, portfolioCurrency) {
  const inferred = detectMarket(ticker, currency)
  if (portfolioCurrency === 'THB' && inferred === 'US' && !hasExchangeSuffix(ticker)) {
    return 'SET'
  }
  if (market && MARKETS[market]) {
    const marketCurrency = defaultCurrency(market)
    if (currency && currency !== marketCurrency && inferred !== market) {
      return inferred
    }
    if (market === 'SET') return 'SET'
    return market
  }
  return inferred
}

export function hasExchangeSuffix(ticker) {
  const base = sanitizeTicker(ticker)
  if (!base.includes('-')) return false
  const suffix = base.split('-').pop()
  return ['BK', 'HK', 'SS', 'SZ'].includes(suffix)
}

/** Plain symbol without exchange suffix (e.g. TISCO, SCB, AAPL). */
export function isPlainTicker(ticker) {
  return Boolean(ticker) && !hasExchangeSuffix(ticker)
}

/** Yahoo symbols to try when fetching quotes (primary + currency-based fallback). */
export function yahooSymbolsForHolding(ticker, market, currency, portfolioCurrency) {
  const resolved = resolveMarket(ticker, market, currency, portfolioCurrency)
  const symbols = []
  const add = (m) => {
    const sym = toYahooTicker(ticker, m)
    if (sym && !symbols.includes(sym)) symbols.push(sym)
  }

  add(resolved)
  if (isPlainTicker(ticker)) {
    if (resolved !== 'SET') add('SET')
    if (resolved !== 'US') add('US')
  }
  if (currency === 'THB' || portfolioCurrency === 'THB') add('SET')
  if (currency === 'HKD') add('HK')

  return symbols
}

/** Normalize ticker for DB storage (e.g. TISCO + SET → TISCO-BK). */
export function storageTicker(ticker, market, currency, portfolioCurrency) {
  const m = resolveMarket(ticker, market, currency, portfolioCurrency)
  return toYahooTicker(ticker, m).replace(/\./g, '-')
}
