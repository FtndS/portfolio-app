import pool from '../db/index.js'

export async function getDefaultPortfolioId(userId) {
  const r = await pool.query(
    'SELECT id FROM portfolios WHERE user_id = $1 ORDER BY is_default DESC, id ASC LIMIT 1',
    [userId]
  )
  return r.rows[0]?.id
}

export async function ensureUserPortfolio(userId) {
  const existing = await getDefaultPortfolioId(userId)
  if (existing) return existing
  const r = await pool.query(
    `INSERT INTO portfolios (user_id, name, is_default) VALUES ($1, 'Main Portfolio', true) RETURNING id`,
    [userId]
  )
  return r.rows[0].id
}

/** Link legacy rows (portfolio_id IS NULL) to the user's default portfolio */
export async function repairOrphanedRecords(userId, defaultPortfolioId) {
  if (!defaultPortfolioId) return
  await pool.query(
    `UPDATE holdings SET portfolio_id = $1 WHERE user_id = $2 AND portfolio_id IS NULL`,
    [defaultPortfolioId, userId]
  )
  await pool.query(
    `UPDATE transactions SET portfolio_id = $1 WHERE user_id = $2 AND portfolio_id IS NULL`,
    [defaultPortfolioId, userId]
  )
  await pool.query(
    `UPDATE journal SET portfolio_id = $1 WHERE user_id = $2 AND portfolio_id IS NULL`,
    [defaultPortfolioId, userId]
  )
}

export async function resolvePortfolioId(userId, portfolioId) {
  const defaultId = await ensureUserPortfolio(userId)
  await repairOrphanedRecords(userId, defaultId)

  if (portfolioId) {
    const r = await pool.query(
      'SELECT id FROM portfolios WHERE id = $1 AND user_id = $2',
      [portfolioId, userId]
    )
    if (r.rows.length) return Number(portfolioId)
  }
  return defaultId
}

export async function isDefaultPortfolio(userId, portfolioId) {
  const defaultId = await getDefaultPortfolioId(userId)
  return defaultId === portfolioId
}
