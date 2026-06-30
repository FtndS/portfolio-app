/** USD per 1 unit of foreign currency (THB uses live rate from caller). */
export const USD_PER_UNIT = {
  USD: 1,
  HKD: 1 / 7.8,
  CNY: 1 / 7.25,
}

export function toUsd(amount, currency, usdThb = 35) {
  const ccy = String(currency || 'USD').toUpperCase()
  const n = Number(amount) || 0
  if (ccy === 'USD') return n
  if (ccy === 'THB') return n / usdThb
  const rate = USD_PER_UNIT[ccy]
  return rate != null ? n * rate : n
}

export function fromUsd(amountUsd, displayCurrency, usdThb = 35) {
  const usd = Number(amountUsd) || 0
  if (displayCurrency === 'THB') return usd * usdThb
  return usd
}

export function convertAmount(amount, fromCurrency, displayCurrency, usdThb = 35) {
  return fromUsd(toUsd(amount, fromCurrency, usdThb), displayCurrency, usdThb)
}

export function toPortfolioCurrency(amount, holdingCurrency, portfolioCurrency, usdThb = 35) {
  const from = holdingCurrency || 'USD'
  const to = portfolioCurrency || 'USD'
  if (from === to) return Number(amount) || 0
  return fromUsd(toUsd(amount, from, usdThb), to === 'THB' ? 'THB' : 'USD', usdThb)
}

export function makeConverter(displayCurrency, usdThb = 35) {
  return (amount, fromCurrency = 'USD') => convertAmount(amount, fromCurrency, displayCurrency, usdThb)
}
