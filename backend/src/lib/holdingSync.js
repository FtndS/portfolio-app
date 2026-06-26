import { resolveMarket, defaultCurrency, storageTicker, detectMarket } from './ticker.js'
import { fetchCompanyProfile, needsSectorRefresh } from './profile.js'

export async function syncHoldingFromTransactions(client, userId, portfolioId, ticker, profile = null, txCurrency) {
  const allTx = await client.query(
    `SELECT type, shares, price FROM transactions
     WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3`,
    [userId, portfolioId, ticker]
  )

  if (allTx.rows.length === 0) {
    await client.query(
      `DELETE FROM holdings WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3`,
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
      `DELETE FROM holdings WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3`,
      [userId, portfolioId, ticker]
    )
    return null
  }

  const avgCost = totalBuyShares > 0 ? totalBuyCost / totalBuyShares : 0

  const existing = await client.query(
    `SELECT id, name, sector, currency, market FROM holdings
     WHERE user_id = $1 AND portfolio_id = $2 AND ticker = $3`,
    [userId, portfolioId, ticker]
  )

  const market = resolveMarket(
    ticker,
    existing.rows[0]?.market,
    existing.rows[0]?.currency || txCurrency,
    null
  )
  if (!profile && (existing.rows.length === 0 || needsSectorRefresh(existing.rows[0]?.sector))) {
    profile = await fetchCompanyProfile(ticker, market)
  }

  const name = profile?.name || existing.rows[0]?.name || ticker
  let sector = (profile?.sector && profile.sector !== 'Other')
    ? profile.sector
    : (existing.rows[0]?.sector || profile?.sector || 'Other')
  if (needsSectorRefresh(sector) && profile?.sector && profile.sector !== 'Other') {
    sector = profile.sector
  }
  const holdingCurrency = txCurrency
    || existing.rows[0]?.currency
    || defaultCurrency(detectMarket(ticker, txCurrency))

  if (existing.rows.length > 0) {
    await client.query(
      `UPDATE holdings SET shares = $1, avg_cost = $2, name = $3, sector = $4, currency = $9, market = $8, updated_at = NOW()
       WHERE user_id = $5 AND portfolio_id = $6 AND ticker = $7`,
      [netShares, avgCost, name, sector, userId, portfolioId, ticker, market, holdingCurrency]
    )
  } else {
    await client.query(
      `INSERT INTO holdings (user_id, portfolio_id, ticker, name, shares, avg_cost, sector, currency, market)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [userId, portfolioId, ticker, name, netShares, avgCost, sector, holdingCurrency, market]
    )
  }

  return { ticker, shares: netShares, avg_cost: avgCost, sector, name }
}

/** Rebuild transaction-derived holdings per portfolio (one-time / migration repair). */
export async function rebuildHoldingsFromTransactions(pool) {
  const users = await pool.query('SELECT DISTINCT user_id FROM portfolios')
  for (const { user_id: userId } of users.rows) {
    const portfolios = await pool.query(
      'SELECT id FROM portfolios WHERE user_id = $1',
      [userId]
    )
    for (const { id: portfolioId } of portfolios.rows) {
      const client = await pool.connect()
      try {
        await client.query('BEGIN')

        await client.query(
          `DELETE FROM holdings h
           WHERE h.user_id = $1 AND h.portfolio_id = $2
           AND EXISTS (
             SELECT 1 FROM transactions t
             WHERE t.user_id = h.user_id AND t.portfolio_id = h.portfolio_id AND t.ticker = h.ticker
           )`,
          [userId, portfolioId]
        )

        const tickers = await client.query(
          `SELECT DISTINCT ticker FROM transactions WHERE user_id = $1 AND portfolio_id = $2`,
          [userId, portfolioId]
        )
        for (const { ticker } of tickers.rows) {
          await syncHoldingFromTransactions(client, userId, portfolioId, ticker)
        }

        await client.query('COMMIT')
      } catch (err) {
        await client.query('ROLLBACK').catch(() => {})
        throw err
      } finally {
        client.release()
      }
    }
  }
}
