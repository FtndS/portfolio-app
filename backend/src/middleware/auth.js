import jwt from 'jsonwebtoken'
import pool from '../db/index.js'
import { isTokenVersionValid } from '../lib/authToken.js'

export const authMiddleware = async (req, res, next) => {
  const token = req.headers.authorization?.split(' ')[1]
  if (!token) return res.status(401).json({ error: 'No token provided' })

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    const result = await pool.query(
      `SELECT id, email, email_verified, role, plan, plan_expires_at, token_version
       FROM users WHERE id = $1`,
      [decoded.userId]
    )
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'Invalid token' })
    if (!isTokenVersionValid(decoded.tv, user.token_version)) {
      return res.status(401).json({ error: 'Session expired — please log in again' })
    }
    if (user.email_verified !== true) {
      return res.status(403).json({ error: 'กรุณายืนยันอีเมลก่อนใช้งาน' })
    }
    req.userId = user.id
    req.userEmail = user.email
    req.userRole = user.role || 'user'
    req.userPlan = user.plan || 'free'
    req.userPlanExpiresAt = user.plan_expires_at || null
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}
