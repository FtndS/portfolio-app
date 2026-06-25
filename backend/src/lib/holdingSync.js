import { detectMarket, defaultCurrency } from './ticker.js'
import { fetchCompanyProfile, needsSectorRefresh } from './profile.js'

export async function syncHoldingFromTransactions(client, userId, portfolioId, ticker, profile = null) {
  const allTx = await client.query(
    `SELECT type, shares, price FROM transactions
     WHERE user_id = $1 AND ticker = $3 AND (portfolio_id = $2 OR portfolio_id IS NULL)`,
    [userId, portfolioId, ticker]
  )

  if (allTx.rows.length === 0) {
    await client.query(
      `DELETE FROM holdings WHERE user_id = $1 AND ticker = $3
       AND (portfolio_id = $2 OR portfolio_id IS NULL)`,
      [userId, portfolioId, ticker]
    )
    return null
  }

  let netShares = 0
  let totalBuyShares = 0
  let totalBuyCost = 0

  for (const r of allTx.rows) {
    const sh = parseFloat(r.shares)
    if (r.type === 'BUY') {
      netShares += sh
      totalBuyShares += sh
      totalBuyCost += sh * parseFloat(r.price)
    } else {
      netShares -= sh
    }
  }

  if (netShares <= 0.000001) {
    await client.query(
      `DELETE FROM holdings WHERE user_id = $1 AND ticker = $3
       AND (portfolio_id = $2 OR portfolio_id IS NULL)`,
      [userId, portfolioId, ticker]
    )
    return null
  }

  const avgCost = totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0

  const existing = await client.query(
    `SELECT id, name, sector, currency, market FROM holdings
     WHERE user_id = $1 AND ticker = $3 AND (portfolio_id = $2 OR portfolio_id IS NULL)`,
    [userId, portfolioId, ticker]
  )

  const market = existing.rows[0]?.market || detectMarket(ticker)
  if (!profile && (existing.rows.length === 0 || needsSectorRefresh(existing.rows[0]?.sector))) {
    profile = await fetchCompanyProfile(ticker, market)
  }

  const name = profile?.name || existing.rows[0]?.name || ticker
  const sector = (profile?.sector && profile.sector !== 'Other')
    ? profile.sector
    : (existing.rows[0]?.sector || profile?.sector || 'Other')
  const currency = existing.rows[0]?.currency || defaultCurrency(market)

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE holdings SET shares = $1, avg_cost = $2, name = $3, sector = $4,
        portfolio_id = COALESCE(portfolio_id, $8), updated_at = NOW()
       WHERE user_id = $5 AND ticker = $7 AND (portfolio_id = $6 OR portfolio_id IS NULL)`,
      [netShares, avgCost, name, sector, userId, portfolioId, ticker, portfolioId]
    )
  } else {
    await client.query(
      `INSERT INTO holdings (user_id, portfolio_id, ticker, name, shares, avg_cost, sector, currency, market)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, portfolioId, ticker, name, netShares, avgCost, sector, currency, market]
    )
  }

  return { ticker, shares: netShares, avg_cost: avgCost, sector, name }
}
