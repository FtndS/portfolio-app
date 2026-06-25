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

export async function resolvePortfolioId(userId, portfolioId) {
  if (portfolioId) {
    const r = await pool.query(
      'SELECT id FROM portfolios WHERE id = $1 AND user_id = $2',
      [portfolioId, userId]
    )
    if (r.rows.length) return portfolioId
  }
  return ensureUserPortfolio(userId)
}
