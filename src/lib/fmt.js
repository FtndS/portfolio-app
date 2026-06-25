export const fmt = (n, currency = 'USD') => {
  const symbol = currency === 'THB' ? '฿' : '$'
  return symbol + Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}
