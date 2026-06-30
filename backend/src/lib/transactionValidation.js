const SHARES_EPS = 1e-9

export function netSharesFromRows(rows) {
  let net = 0
  for (const r of rows) {
    const sh = parseFloat(r.shares)
    if (r.type === 'BUY') net += sh
    else net -= sh
  }
  return net
}

export async function fetchOrderedTransactions(client, userId, portfolioId, ticker, excludeTxId = null) {
  const params = [userId, portfolioId, ticker]
  let sql = `SELECT type, shares FROM transactions
    WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3`
  if (excludeTxId != null) {
    sql += ` AND id != $4`
    params.push(excludeTxId)
  }
  sql += ` ORDER BY date ASC, created_at ASC, id ASC`
  const result = await client.query(sql, params)
  return result.rows
}

export async function getNetSharesForTicker(client, userId, portfolioId, ticker, excludeTxId = null) {
  const rows = await fetchOrderedTransactions(client, userId, portfolioId, ticker, excludeTxId)
  return netSharesFromRows(rows)
}

export function validateSellQuantity(netShares, sellShares) {
  const sell = Number(sellShares)
  if (!(sell > 0)) return 'จำนวนหุ้นต้องมากกว่า 0'
  if (sell > netShares + SHARES_EPS) {
    const held = Math.max(0, netShares)
    return `ขายเกินจำนวนที่ถือ (ถืออยู่ ${held.toFixed(4)} หุ้น)`
  }
  return null
}
