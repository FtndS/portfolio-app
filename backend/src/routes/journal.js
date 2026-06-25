import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'

const router = express.Router()
router.use(authMiddleware)

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM journal WHERE user_id = $1 ORDER BY date DESC',
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  const { title, content, tickers, tag, date } = req.body
  try {
    const result = await pool.query(
      `INSERT INTO journal (user_id, title, content, tickers, tag, date)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [req.userId, title, content, tickers, tag, date]
    )
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
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
    res.json(result.rows[0])
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM journal WHERE id=$1 AND user_id=$2', [req.params.id, req.userId])
    res.json({ message: 'Deleted' })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router