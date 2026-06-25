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
  // Class shares: BRK-B → BRK.B, BF-A → BF.A
  if (/^[A-Z0-9]+-[A-Z]$/.test(base)) return base.replace(/-([A-Z])$/, '.$1')
  return base.replace(/-([A-Z]{2})$/, '.$1')
}

export function defaultCurrency(market = 'US') {
  const m = MARKETS[market]
  return m?.currencies[0] || 'USD'
}

export function detectMarket(ticker) {
  const yahoo = toYahooTicker(ticker)
  if (yahoo.endsWith('.BK')) return 'SET'
  if (yahoo.endsWith('.HK')) return 'HK'
  if (yahoo.endsWith('.SS')) return 'CN'
  if (yahoo.endsWith('.SZ')) return 'SZ'
  return 'US'
}
