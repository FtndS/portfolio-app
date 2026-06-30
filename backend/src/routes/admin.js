import express from 'express'
import pool from '../db/index.js'
import { authMiddleware } from '../middleware/auth.js'
import { requireAdmin } from '../middleware/admin.js'
import { computeProExpiry, normalizePlanId } from '../lib/subscriptionAdmin.js'
import { resolveEffectivePlan } from '../lib/aiPlan.js'

const router = express.Router()
router.use(authMiddleware)
router.use(requireAdmin)

const STATUSES = new Set(['open', 'in_progress', 'resolved', 'closed'])

router.get('/users', async (req, res) => {
  try {
    const q = String(req.query.q || '').trim().toLowerCase()
    const planFilter = String(req.query.plan || 'all').trim()
    const params = []
    const where = []

    if (q) {
      params.push(`%${q}%`)
      where.push(`(LOWER(email) LIKE $${params.length} OR LOWER(name) LIKE $${params.length})`)
    }
    if (planFilter === 'pro' || planFilter === 'free') {
      params.push(planFilter)
      where.push(`plan = $${params.length}`)
    }

    const sql = `
      SELECT id, email, name, role, plan, plan_expires_at, plan_note, plan_updated_at, created_at
      FROM users
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}
      ORDER BY
        CASE WHEN plan = 'pro' THEN 0 ELSE 1 END,
        plan_expires_at ASC NULLS LAST,
        created_at DESC
      LIMIT 100`

    const result = await pool.query(sql, params)
    const rows = result.rows.map((row) => ({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      plan: resolveEffectivePlan(row.plan, row.plan_expires_at),
      rawPlan: row.plan,
      planExpiresAt: row.plan_expires_at,
      planNote: row.plan_note,
      planUpdatedAt: row.plan_updated_at,
      createdAt: row.created_at,
    }))
    res.json(rows)
  } catch (err) {
    console.error('GET admin/users error:', err)
    res.status(500).json({ error: 'โหลดรายชื่อผู้ใช้ไม่สำเร็จ' })
  }
})

router.patch('/users/:id/plan', async (req, res) => {
  try {
    const userId = Number(req.params.id)
    if (!userId) return res.status(400).json({ error: 'รหัสผู้ใช้ไม่ถูกต้อง' })

    const { plan, extendMonths, planExpiresAt, planNote } = req.body
    const nextPlan = normalizePlanId(plan)

    const existing = await pool.query(
      'SELECT id, email, name, role, plan, plan_expires_at FROM users WHERE id = $1',
      [userId]
    )
    if (!existing.rows.length) {
      return res.status(404).json({ error: 'ไม่พบผู้ใช้' })
    }

    let expiresAt = null
    if (nextPlan === 'pro') {
      expiresAt = computeProExpiry({
        currentExpiresAt: existing.rows[0].plan_expires_at,
        extendMonths,
        planExpiresAt,
      })
      if (!expiresAt) {
        return res.status(400).json({ error: 'วันหมดอายุไม่ถูกต้อง' })
      }
    }

    const note = planNote != null ? String(planNote).trim().slice(0, 2000) : null

    const result = await pool.query(
      `UPDATE users
       SET plan = $1,
           plan_expires_at = $2,
           plan_note = COALESCE($3, plan_note),
           plan_updated_at = NOW()
       WHERE id = $4
       RETURNING id, email, name, role, plan, plan_expires_at, plan_note, plan_updated_at, created_at`,
      [nextPlan, expiresAt, note, userId]
    )

    const row = result.rows[0]
    res.json({
      id: row.id,
      email: row.email,
      name: row.name,
      role: row.role,
      plan: resolveEffectivePlan(row.plan, row.plan_expires_at),
      rawPlan: row.plan,
      planExpiresAt: row.plan_expires_at,
      planNote: row.plan_note,
      planUpdatedAt: row.plan_updated_at,
      createdAt: row.created_at,
      message: nextPlan === 'pro' ? 'เปิดแผน Pro แล้ว' : 'เปลี่ยนเป็น Free แล้ว',
    })
  } catch (err) {
    console.error('PATCH admin/users plan error:', err)
    res.status(500).json({ error: 'อัปเดตแผนไม่สำเร็จ' })
  }
})

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
