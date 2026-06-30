export const MARKETS = [
  { id: 'US', label: 'US / Global', currencies: ['USD', 'THB'] },
  { id: 'SET', label: 'Thailand (SET)', currencies: ['THB', 'USD'] },
  { id: 'CRYPTO', label: 'Crypto', currencies: ['USD', 'THB'] },
  { id: 'HK', label: 'Hong Kong', currencies: ['HKD', 'THB', 'USD'] },
  { id: 'CN', label: 'China (Shanghai)', currencies: ['CNY', 'THB', 'USD'] },
  { id: 'SZ', label: 'China (Shenzhen)', currencies: ['CNY', 'THB', 'USD'] },
]

export function currencyForMarket(marketId, preferred) {
  const def = MARKETS.find((m) => m.id === marketId) || MARKETS[0]
  if (preferred && def.currencies.includes(preferred)) return preferred
  return def.currencies[0] || 'USD'
}

export const CURRENCY_SYMBOL = { USD: '$', THB: '฿', HKD: 'HK$', CNY: '¥' }
export const symFor = (c) => CURRENCY_SYMBOL[c] || '$'

export const SECTOR_COLORS = [
  '#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e',
  '#e84393', '#55efc4', '#fd79a8', '#a29bfe', '#74b9ff',
]

export const JOURNAL_TAGS = [
  'บันทึกความคิด', 'rebalance', 'ซื้อ', 'ขาย', 'วิเคราะห์', 'ข่าว', 'อื่นๆ',
]

export const sanitizeTicker = (ticker) => {
  if (!ticker) return ''
  return ticker.trim().toUpperCase().replace(/\s+/g, '-').replace(/\./g, '-')
}

export const CHART_RANGES = [
  { id: '1m', label: '1M', days: 30 },
  { id: '3m', label: '3M', days: 90 },
  { id: '6m', label: '6M', days: 180 },
  { id: '1y', label: '1Y', days: 365 },
  { id: 'ytd', label: 'YTD', days: 'ytd' },
  { id: 'all', label: 'All', days: 'all' },
]

export const CHART_RANGE_DAYS = Object.fromEntries(
  CHART_RANGES.map((r) => [r.id, r.days])
)

export const BENCHMARK_TOGGLES = [
  { id: 'sp500', label: 'S&P 500', color: 'var(--chart-benchmark)' },
  { id: 'set', label: 'SET', color: 'var(--chart-set)' },
]

/** @deprecated use BENCHMARK_TOGGLES — kept for any legacy refs */
export const BENCHMARK_OPTIONS = [
  { id: 'auto', label: 'Auto' },
  { id: 'sp500', label: 'S&P 500' },
  { id: 'set', label: 'SET' },
  { id: 'none', label: 'ปิด' },
]
