import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db/index.js'
import { ensureUserPortfolio } from '../lib/portfolio.js'

const router = express.Router()

router.post('/register', async (req, res) => {
  const { email, password, name } = req.body
  try {
    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [email, hash, name]
    )
    const user = result.rows[0]
    try {
      await ensureUserPortfolio(user.id)
    } catch (e) {
      console.warn('Default portfolio not created:', e.message)
    }
    res.json({ user })
  } catch (err) {
    res.status(400).json({ error: err.message })
  }
})

router.post('/login', async (req, res) => {
  const { email, password } = req.body
  try {
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid credentials' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'Invalid credentials' })

    try {
      await ensureUserPortfolio(user.id)
    } catch (e) {
      console.warn('Default portfolio not ensured on login:', e.message)
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: { id: user.id, email: user.email, name: user.name } })
  } catch (err) {
    res.status(500).json({ error: err.message })
  }
})

export default router
