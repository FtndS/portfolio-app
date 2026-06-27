import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'

const router = express.Router()
router.use(authMiddleware)
router.use(requireAdmin)

const STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed'])

router.get('/tickets', async (req, res) => {
  try {
    const status = String(req.query.status || '').trim()
    const params = []
    let where = ''

    if (status && STATUSES.has(status)) {
      params.push(status)
      where = `WHERE t.status = $1`
    }

    const result = await pool.query(
      `SELECT t.id, t.category, t.subject, t.message, t.status, t.admin_notes,
              t.created_at, t.updated_at,
              u.id AS user_id, u.email AS user_email, u.name AS user_name
       FROM support_tickets t
       JOIN users u ON u.id = t.user_id
       ${where}
       ORDER BY t.created_at DESC
       LIMIT 200`,
      params
    )
    res.json(result.rows)
  } catch (err) {
    console.error('GET admin/tickets error:', err)
    res.status(500).json({ error: err.message })
  }
})

router.put('/tickets/:id', async (req, res) => {
  try {
    const id = Number(req.params.id)
    if (!id) return res.status(400).json({ error: 'รหัสคำร้องไม่ถูกต้อง' })

    const { status, admin_notes: adminNotes } = req.body
    if (status != null && !STATUSES.has(status)) {
      return res.status(400).json({ error: 'สถานะไม่ถูกต้อง' })
    }

    const notes = adminNotes != null ? String(adminNotes).trim().slice(0, 5000) : null

    const result = await pool.query(
      `UPDATE support_tickets
       SET status = COALESCE($2, status),
           admin_notes = COALESCE($3, admin_notes),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [id, status || null, notes]
    )

    if (!result.rows.length) {
      return res.status(404).json({ error: 'ไม่พบคำร้อง' })
    }

    const ticket = result.rows[0]
    const userResult = await pool.query(
      'SELECT email, name FROM users WHERE id = $1',
      [ticket.user_id]
    )

    res.json({
      ...ticket,
      user_email: userResult.rows[0]?.email,
      user_name: userResult.rows[0]?.name,
    })
  } catch (err) {
    console.error('PATCH admin/tickets error:', err)
    res.status(500).json({ error: err.message })
  }
})

export default router
