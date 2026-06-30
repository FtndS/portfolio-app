import express from 'express'
import { serverError } from '../lib/httpErrors.js'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { resolvePortfolioId } from '../lib/portfolio.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const portfolioId = await resolvePortfolioId(req.userId, req.query.portfolio_id)
    const result = await pool.query(
      `SELECT * FROM journal WHERE user_id = $1 AND portfolio_id = $2 ORDER BY date DESC`,
      [req.userId, portfolioId]
    )
    res.json(result.rows)
  } catch (err) {
    serverError(res, err)
  }
})

router.post('/', async (req, res) => {
  const { title, content, tickers, tag, date, portfolio_id } = req.body
  try {
    const portfolioId = await resolvePortfolioId(req.userId, portfolio_id)
    const result = await pool.query(
      `INSERT INTO journal (user_id, portfolio_id, title, content, tickers, tag, date)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [req.userId, portfolioId, title, content, tickers, tag, date]
    )
    res.json(result.rows[0])
  } catch (err) {
    serverError(res, err)
  }
})

router.put('/:id', async (req, res) => {
  const { title, content, tickers, tag, date } = req.body
  try {
    const result = await pool.query(
      `UPDATE journal SET title=$1, content=$2, tickers=$3, tag=$4, date=$5
       WHERE id=$6 AND user_id=$7 RETURNING *`,
      [title, content, tickers, tag, date, req.params.id, req.userId]
    )
    if (!result.rows.length) {
      return res.status(404).json({ error: 'ไม่พบรายการ' })
    }
    res.json(result.rows[0])
  } catch (err) {
    serverError(res, err)
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM journal WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ message: 'Deleted' })
  } catch (err) {
    serverError(res, err)
  }
})

export default router
