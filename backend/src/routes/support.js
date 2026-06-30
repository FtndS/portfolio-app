import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { supportLimiter } from '../middleware/rateLimit.js'
import { sendEmail, buildSupportTicketEmail } from '../lib/email.js'
import { serverError } from '../lib/httpErrors.js'
import { parseReceiptBase64 } from '../lib/receiptImage.js'

const router = express.Router()
router.use(authMiddleware)

const CATEGORIES = new Set(['bug', 'question', 'feature', 'other', 'upgrade'])
const MAX_TICKETS_PER_DAY = 5

function validateTicketInput({ category, subject, message, receiptBase64 }) {
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
  if (category === 'upgrade' && !receiptBase64) {
    return 'กรุณาแนบสลิปการโอนเงิน'
  }
  return null
}

async function collectNotifyEmails() {
  const emails = new Set()
  const admins = await pool.query(
    `SELECT email FROM users WHERE role = 'admin' AND email_verified = true`
  )
  for (const row of admins.rows) {
    if (row.email) emails.add(row.email.toLowerCase())
  }
  const owner = process.env.AI_OWNER_EMAIL || process.env.ADMIN_EMAIL
  if (owner) emails.add(owner.trim().toLowerCase())
  return [...emails]
}

async function notifyAdmins(ticket, user, receipt) {
  const recipients = await collectNotifyEmails()
  if (!recipients.length) return

  const { subject, html, text } = buildSupportTicketEmail({ ticket, user })
  const attachments = receipt
    ? [{ filename: `receipt-${ticket.id}.${receipt.contentType.includes('png') ? 'png' : 'jpg'}`, content: receipt.buffer, contentType: receipt.contentType }]
    : undefined

  await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({ to, subject, html, text, attachments })
    )
  )
}

router.get('/mine', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, category, subject, message, status, created_at, updated_at,
              (receipt_data IS NOT NULL) AS has_receipt
       FROM support_tickets
       WHERE user_id = $1
       ORDER BY created_at DESC
       LIMIT 20`,
      [req.userId]
    )
    res.json(result.rows)
  } catch (err) {
    serverError(res, err, 'GET support/mine error:')
  }
})

router.post('/', supportLimiter, async (req, res) => {
  try {
    const { category, subject, message, receiptBase64 } = req.body
    const validationErr = validateTicketInput({ category, subject, message, receiptBase64 })
    if (validationErr) return res.status(400).json({ error: validationErr })

    const receipt = parseReceiptBase64(receiptBase64)
    if (receipt?.error) return res.status(400).json({ error: receipt.error })

    const recent = await pool.query(
      `SELECT COUNT(*)::int AS count FROM support_tickets
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.userId]
    )
    if (recent.rows[0].count >= MAX_TICKETS_PER_DAY) {
      return res.status(429).json({ error: 'ส่งคำร้องเกินจำนวนที่กำหนดต่อวัน (5 ครั้ง) — ลองใหม่พรุ่งนี้' })
    }

    const result = await pool.query(
      `INSERT INTO support_tickets (user_id, category, subject, message, receipt_mime, receipt_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.userId,
        category,
        String(subject).trim(),
        String(message).trim(),
        receipt?.contentType || null,
        receipt?.buffer || null,
      ]
    )
    const ticket = result.rows[0]

    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.userId]
    )
    notifyAdmins(ticket, userResult.rows[0], receipt).catch((e) => {
      console.error('Support ticket email error:', e)
    })

    res.status(201).json({
      ...ticket,
      has_receipt: !!ticket.receipt_data,
      receipt_data: undefined,
      receipt_mime: undefined,
    })
  } catch (err) {
    serverError(res, err, 'POST support error:')
  }
})

export default router
