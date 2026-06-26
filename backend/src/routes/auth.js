import express from 'express'
import crypto from 'crypto'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db/index.js'
import { ensureUserPortfolio } from '../lib/portfolio.js'
import { authMiddleware } from '../middleware/auth.js'
import { authLimiter, forgotPasswordLimiter } from '../middleware/rateLimit.js'
import { buildPasswordResetEmail, sendEmail } from '../lib/email.js'
import { validateEmail, validateName, validatePassword } from '../lib/validate.js'

const router = express.Router()

const RESET_TOKEN_BYTES = 32
const RESET_TOKEN_TTL_MS = 60 * 60 * 1000

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name }
}

function appBaseUrl() {
  return (process.env.APP_URL || 'https://portdiary.com').replace(/\/$/, '')
}

router.get('/me', authMiddleware, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.userId]
    )
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid token' })
    res.json(publicUser(user))
  } catch (err) {
    res.status(500).json({ error: 'Server error' })
  }
})

router.post('/register', authLimiter, async (req, res) => {
  const { email, password, name } = req.body

  const nameErr = validateName(name)
  if (nameErr) return res.status(400).json({ error: nameErr })

  const emailErr = validateEmail(email)
  if (emailErr) return res.status(400).json({ error: emailErr })

  const passwordErr = validatePassword(password)
  if (passwordErr) return res.status(400).json({ error: passwordErr })

  try {
    const normalizedEmail = email.trim().toLowerCase()
    const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail])
    if (existing.rows.length) {
      return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' })
    }

    const hash = await bcrypt.hash(password, 10)
    const result = await pool.query(
      'INSERT INTO users (email, password, name) VALUES ($1, $2, $3) RETURNING id, email, name',
      [normalizedEmail, hash, name.trim()]
    )
    const user = result.rows[0]
    try {
      await ensureUserPortfolio(user.id)
    } catch (e) {
      console.warn('Default portfolio not created:', e.message)
    }
    res.json({ user })
  } catch (err) {
    console.error('Register error:', err.message)
    res.status(500).json({ error: 'สมัครสมาชิกไม่สำเร็จ กรุณาลองใหม่' })
  }
})

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body

  const emailErr = validateEmail(email)
  if (emailErr) return res.status(400).json({ error: emailErr })
  if (!password) return res.status(400).json({ error: 'กรุณาระบุรหัสผ่าน' })

  try {
    const normalizedEmail = email.trim().toLowerCase()
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })

    try {
      await ensureUserPortfolio(user.id)
    } catch (e) {
      console.warn('Default portfolio not ensured on login:', e.message)
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: publicUser(user) })
  } catch (err) {
    console.error('Login error:', err.message)
    res.status(500).json({ error: 'เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่' })
  }
})

router.post('/forgot-password', forgotPasswordLimiter, async (req, res) => {
  const { email } = req.body
  const emailErr = validateEmail(email)
  if (emailErr) return res.status(400).json({ error: emailErr })

  const genericMessage =
    'ถ้าอีเมลนี้มีในระบบ เราจะส่งลิงก์รีเซ็ตรหัสผ่านให้ภายในไม่กี่นาที'

  try {
    const normalizedEmail = email.trim().toLowerCase()
    const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]

    if (user) {
      const token = crypto.randomBytes(RESET_TOKEN_BYTES).toString('hex')
      const expires = new Date(Date.now() + RESET_TOKEN_TTL_MS)

      await pool.query(
        'UPDATE users SET password_reset_token = $1, password_reset_expires = $2 WHERE id = $3',
        [token, expires, user.id]
      )

      const resetUrl = `${appBaseUrl()}/?reset=${token}`
      const { subject, text, html } = buildPasswordResetEmail(resetUrl)
      await sendEmail({ to: user.email, subject, text, html })
    }

    res.json({ message: genericMessage })
  } catch (err) {
    console.error('Forgot password error:', err.message)
    res.status(500).json({ error: 'ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่ภายหลัง' })
  }
})

router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, password } = req.body

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'ลิงก์รีเซ็ตไม่ถูกต้อง' })
  }

  const passwordErr = validatePassword(password)
  if (passwordErr) return res.status(400).json({ error: passwordErr })

  try {
    const result = await pool.query(
      `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()`,
      [token]
    )
    const user = result.rows[0]
    if (!user) {
      return res.status(400).json({ error: 'ลิงก์รีเซ็ตหมดอายุหรือไม่ถูกต้อง กรุณาขอใหม่' })
    }

    const hash = await bcrypt.hash(password, 10)
    await pool.query(
      `UPDATE users
       SET password = $1, password_reset_token = NULL, password_reset_expires = NULL
       WHERE id = $2`,
      [hash, user.id]
    )

    res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ' })
  } catch (err) {
    console.error('Reset password error:', err.message)
    res.status(500).json({ error: 'ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่' })
  }
})

router.put('/profile', authMiddleware, authLimiter, async (req, res) => {
  const { name } = req.body
  const nameErr = validateName(name)
  if (nameErr) return res.status(400).json({ error: nameErr })

  try {
    const result = await pool.query(
      'UPDATE users SET name = $1 WHERE id = $2 RETURNING id, email, name',
      [name.trim(), req.userId]
    )
    if (!result.rows.length) return res.status(404).json({ error: 'ไม่พบบัญชี' })
    res.json({ user: publicUser(result.rows[0]), message: 'บันทึกชื่อสำเร็จ' })
  } catch (err) {
    console.error('Update profile error:', err.message)
    res.status(500).json({ error: 'บันทึกไม่สำเร็จ กรุณาลองใหม่' })
  }
})

router.put('/change-password', authMiddleware, authLimiter, async (req, res) => {
  const { currentPassword, newPassword } = req.body

  if (!currentPassword) {
    return res.status(400).json({ error: 'กรุณาระบุรหัสผ่านปัจจุบัน' })
  }

  const passwordErr = validatePassword(newPassword)
  if (passwordErr) return res.status(400).json({ error: passwordErr })

  try {
    const result = await pool.query('SELECT password FROM users WHERE id = $1', [req.userId])
    const user = result.rows[0]
    if (!user) return res.status(404).json({ error: 'ไม่พบบัญชี' })

    const valid = await bcrypt.compare(currentPassword, user.password)
    if (!valid) {
      return res.status(400).json({ error: 'รหัสผ่านปัจจุบันไม่ถูกต้อง' })
    }

    const hash = await bcrypt.hash(newPassword, 10)
    await pool.query('UPDATE users SET password = $1 WHERE id = $2', [hash, req.userId])

    res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' })
  } catch (err) {
    console.error('Change password error:', err.message)
    res.status(500).json({ error: 'เปลี่ยนรหัสผ่านไม่สำเร็จ กรุณาลองใหม่' })
  }
})

export default router
