import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { supportLimiter } from '../middleware/rateLimit.js'
import { sendEmail, buildSupportTicketEmail } from '../lib/email.js'
import { serverError } from '../lib/httpErrors.js'
import {
  parseAttachmentsInput,
  attachmentFilename,
  MAX_ATTACHMENTS_PER_TICKET,
} from '../lib/ticketAttachments.js'

const router = express.Router()
router.use(authMiddleware)

const CATEGORIES = new Set(['bug', 'question', 'feature', 'other', 'upgrade'])
const MAX_TICKETS_PER_DAY = 5

function validateTicketInput({ category, subject, message, attachmentCount = 0 }) {
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
  if (category === 'upgrade' && attachmentCount < 1) {
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

async function insertTicketAttachments(client, ticketId, attachments) {
  for (let i = 0; i < attachments.length; i += 1) {
    const att = attachments[i]
    await client.query(
      `INSERT INTO support_ticket_attachments (ticket_id, mime, data, sort_order)
       VALUES ($1, $2, $3, $4)`,
      [ticketId, att.contentType, att.buffer, i]
    )
  }
}

async function notifyAdmins(ticket, user, attachments) {
  const recipients = await collectNotifyEmails()
  if (!recipients.length) return

  const { subject, html, text } = buildSupportTicketEmail({ ticket, user })
  const emailAttachments = attachments?.length
    ? attachments.map((att, i) => ({
      filename: attachmentFilename(ticket.id, att.contentType, i),
      content: att.buffer,
      contentType: att.contentType,
    }))
    : undefined

  await Promise.allSettled(
    recipients.map((to) =>
      sendEmail({ to, subject, html, text, attachments: emailAttachments })
    )
  )
}

function sanitizeTicketRow(row, attachmentCount = 0) {
  return {
    ...row,
    has_receipt: attachmentCount > 0 || !!row.receipt_data,
    attachment_count: attachmentCount,
    receipt_data: undefined,
    receipt_mime: undefined,
  }
}

router.get('/mine', async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.category, t.subject, t.message, t.status, t.created_at, t.updated_at,
              (t.receipt_data IS NOT NULL) AS has_legacy_receipt,
              COALESCE(a.cnt, 0)::int AS attachment_count
       FROM support_tickets t
       LEFT JOIN (
         SELECT ticket_id, COUNT(*)::int AS cnt
         FROM support_ticket_attachments
         GROUP BY ticket_id
       ) a ON a.ticket_id = t.id
       WHERE t.user_id = $1
       ORDER BY t.created_at DESC
       LIMIT 20`,
      [req.userId]
    )
    res.json(result.rows.map((row) => ({
      ...row,
      has_receipt: row.has_legacy_receipt || row.attachment_count > 0,
    })))
  } catch (err) {
    serverError(res, err, 'GET support/mine error:')
  }
})

router.post('/', supportLimiter, async (req, res) => {
  const client = await pool.connect()
  try {
    const { category, subject, message, receiptBase64, attachmentsBase64 } = req.body

    const parsed = parseAttachmentsInput({ attachmentsBase64, receiptBase64 })
    if (parsed.error) return res.status(400).json({ error: parsed.error })
    const attachments = parsed.attachments || []

    const validationErr = validateTicketInput({
      category,
      subject,
      message,
      attachmentCount: attachments.length,
    })
    if (validationErr) return res.status(400).json({ error: validationErr })

    if (category === 'upgrade') {
      const openUpgrade = await pool.query(
        `SELECT id FROM support_tickets
         WHERE user_id = $1 AND category = 'upgrade' AND status IN ('open', 'in_progress')
         LIMIT 1`,
        [req.userId]
      )
      if (openUpgrade.rows.length) {
        return res.status(400).json({ error: 'มีคำขออัปเกรดที่รอตรวจอยู่แล้ว — รอทีมงานยืนยันก่อนส่งใหม่' })
      }
    }

    const recent = await pool.query(
      `SELECT COUNT(*)::int AS count FROM support_tickets
       WHERE user_id = $1 AND created_at > NOW() - INTERVAL '24 hours'`,
      [req.userId]
    )
    if (recent.rows[0].count >= MAX_TICKETS_PER_DAY) {
      return res.status(429).json({ error: 'ส่งคำร้องเกินจำนวนที่กำหนดต่อวัน (5 ครั้ง) — ลองใหม่พรุ่งนี้' })
    }

    await client.query('BEGIN')

    const firstAttachment = attachments[0] || null
    const result = await client.query(
      `INSERT INTO support_tickets (user_id, category, subject, message, receipt_mime, receipt_data)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [
        req.userId,
        category,
        String(subject).trim(),
        String(message).trim(),
        firstAttachment?.contentType || null,
        firstAttachment?.buffer || null,
      ]
    )
    const ticket = result.rows[0]

    if (attachments.length) {
      await insertTicketAttachments(client, ticket.id, attachments)
    }

    await client.query('COMMIT')

    const userResult = await pool.query(
      'SELECT id, email, name FROM users WHERE id = $1',
      [req.userId]
    )
    notifyAdmins(ticket, userResult.rows[0], attachments).catch((e) => {
      console.error('Support ticket email error:', e)
    })

    res.status(201).json(sanitizeTicketRow(ticket, attachments.length))
  } catch (err) {
    await client.query('ROLLBACK')
    serverError(res, err, 'POST support error:')
  } finally {
    client.release()
  }
})

export { MAX_ATTACHMENTS_PER_TICKET }
export default router
