import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { sendEmail, buildSupportTicketEmail } from '../lib/email.js'

const router = express.Router()
router.use(authMiddleware)

const CATEGORIES = new Set(['bug', 'question', 'feature', 'other'])
const MAX_TICKETS_PER_DAY = 5

function validateTicketInput({ category, subject, message }) {
  if (!CATEGORIES.has(category)) {
    return 'กรุณาเลือกประเภทปัญหา'
  }
  const subj = String(subject || '').trim()
  if (subj.length < 3 || subj.length > 200) {
    return 'หัวข้อต้องมี 3–200 ตัวอักษร'
  }
  const body = String(message || '').trim()
  if (body.length < 10 || body.length > 5000) {
    return 'รายละเอียดต้องมี 10–5,000 ตัวอักษร'
  }
  return null
}

async function notifyAdmins(ticket, user) {
  const admins = await pool.query(
    `SELECT email, name FROM users WHERE role = 'admin' AND email_verified = true`
  )
  if (!admins.rows.length) return

  const { subject, html, text } = buildSupportTicketEmail({ ticket, user })
  await Promise.allSettled(
    admins.rows.map((admin) =>
      sendEmail({ to: admin.email, subject, html, text })
    )
  )
}

router.get('/mine', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, category, subject, message, status, created_at, updated_at
       FROM support_tickets
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    console.error('GET support/mine error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.post('/', async (req, res) => {
  try {
    const { category, subject, message } = req.body
    const validationErr = validateTicketInput({ category, subject, message })
    if (validationErr) return res.status(400).json({ error: validationErr })

    const recent = await pool.query(
      `SELECT COUNT(*)::int AS count FROM support_tickets
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.userId]
    )
    if (recent.rows[0].count >= MAX_TICKETS_PER_DAY) {
      return res.status(429).json({ error: 'ส่งคำร้องเกินจำนวนที่กำหนดต่อวัน (5 ครั้ง) — ลองใหม่พรุ่งนี้' })
    }

    const result = await pool.query(
      `INSERT INTO support_tickets (user_id, category, subject, message)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [req.userId, category, String(subject).trim(), String(message).trim()]
    )
    const ticket = result.rows[0]

    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.userId]
    )
    notifyAdmins(ticket, userResult.rows[0]).catch((e) => {
      console.error('Support ticket email error:', e)
    })

    res.status(201).json(ticket)
  } catch (err) {
    console.error('POST support error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
