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

/** Infer native currency from holdings when portfolios.currency is stale. */
export function inferPortfolioCurrency(explicitCurrency, holdings = []) {
  if (!holdings?.length) return explicitCurrency || 'USD'

  const counts = {}
  for (const h of holdings) {
    const c = String(h.currency || 'USD').toUpperCase()
    counts[c] = (counts[c] || 0) + 1
  }
  const dominant = Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'USD'
  const explicit = String(explicitCurrency || '').toUpperCase()

  if ((counts[dominant] || 0) >= holdings.length * 0.5) return dominant
  return explicit || dominant || 'USD'
}
