export const MARKETS = [
  { id: 'US', label: 'US / Global', currencies: ['USD'] },
  { id: 'SET', label: 'Thailand (SET)', currencies: ['THB'] },
  { id: 'HK', label: 'Hong Kong', currencies: ['HKD'] },
  { id: 'CN', label: 'China (Shanghai)', currencies: ['CNY'] },
  { id: 'SZ', label: 'China (Shenzhen)', currencies: ['CNY'] },
]

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
