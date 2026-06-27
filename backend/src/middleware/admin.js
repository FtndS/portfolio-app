import { isAdminRole } from '../lib/admin.js'

export function requireAdmin(req, res, next) {
  if (!isAdminRole(req.userRole)) {
    return res.status(403).json({ error: 'ไม่มีสิทธิ์เข้าถึง — สำหรับ Admin เท่านั้น' })
  }
  next()
}
