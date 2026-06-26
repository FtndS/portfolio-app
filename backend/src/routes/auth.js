import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import pool from '../db/index.js'
import { ensureUserPortfolio } from '../lib/portfolio.js'
import { authMiddleware } from '../middleware/auth.js'
import {
  authLimiter,
  forgotPasswordLimiter,
  otpSendLimiter,
  otpVerifyLimiter,
} from '../middleware/rateLimit.js'
import { buildOtpEmail, isSmtpConfigured, sendEmail } from '../lib/email.js'
import {
  OTP_MAX_ATTEMPTS,
  OTP_TTL_MS,
  canResendOtp,
  deleteEmailOtp,
  findActiveEmailOtp,
  generateOtpCode,
  hashOtpCode,
  incrementOtpAttempts,
  resendCooldownSeconds,
  upsertEmailOtp,
  verifyOtpCode,
} from '../lib/otp.js'
import {
  normalizeEmail,
  validateEmail,
  validateName,
  validateOtpCode,
  validatePassword,
} from '../lib/validate.js'

const router = express.Router()

const OTP_LEGACY_MESSAGE = 'ลิงก์รีเซ็ตหมดอายุหรือไม่ถูกต้อง กรุณาขอรหัส OTP ใหม่จากหน้าลืมรหัสผ่าน'

function publicUser(row) {
  return { id: row.id, email: row.email, name: row.name }
}

function requireSmtpOrFail(res) {
  if (!isSmtpConfigured()) {
    if (process.env.NODE_ENV !== 'production') return true
    res.status(503).json({
      error: 'ระบบส่งอีเมลยังไม่พร้อม กรุณาติดต่อผู้ดูแลระบบ',
    })
    return false
  }
  return true
}

async function sendOtpEmail({ email, purpose }) {
  const code = generateOtpCode()
  const expiresAt = new Date(Date.now() + OTP_TTL_MS)
  const otpHash = hashOtpCode(code)
  const row = await upsertEmailOtp({ email, purpose, otpHash, expiresAt })
  const { subject, text, html } = buildOtpEmail({ code, purpose })
  const sent = await sendEmail({ to: email, subject, text, html })
  return { code, sent, createdAt: row.created_at }
}

async function verifyStoredOtp({ email, purpose, otp }) {
  const record = await findActiveEmailOtp(email, purpose)
  if (!record) {
    return { ok: false, error: 'รหัส OTP หมดอายุหรือไม่ถูกต้อง กรุณาขอรหัสใหม่' }
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    await deleteEmailOtp(record.id)
    return { ok: false, error: 'ใส่รหัส OTP ผิดเกินจำนวนที่กำหนด กรุณาขอรหัสใหม่' }
  }
  if (!verifyOtpCode(otp, record.otp_hash)) {
    await incrementOtpAttempts(record.id)
    return { ok: false, error: 'รหัส OTP ไม่ถูกต้อง' }
  }
  return { ok: true, record }
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

router.post('/register/send-otp', otpSendLimiter, async (req, res) => {
  const { email, password, name } = req.body

  const nameErr = validateName(name)
  if (nameErr) return res.status(400).json({ error: nameErr })

  const emailErr = validateEmail(email)
  if (emailErr) return res.status(400).json({ error: emailErr })

  const passwordErr = validatePassword(password)
  if (passwordErr) return res.status(400).json({ error: passwordErr })

  if (!requireSmtpOrFail(res)) return

  try {
    const normalizedEmail = normalizeEmail(email)
    const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail])
    if (existing.rows.length) {
      return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' })
    }

    const pending = await findActiveEmailOtp(normalizedEmail, 'register')
    if (pending && !canResendOtp(pending.created_at)) {
      return res.status(429).json({
        error: `กรุณารอ ${resendCooldownSeconds(pending.created_at)} วินาทีก่อนขอรหัสใหม่`,
        retryAfter: resendCooldownSeconds(pending.created_at),
      })
    }

    const passwordHash = await bcrypt.hash(password, 10)
    const code = generateOtpCode()
    const expiresAt = new Date(Date.now() + OTP_TTL_MS)
    await upsertEmailOtp({
      email: normalizedEmail,
      purpose: 'register',
      otpHash: hashOtpCode(code),
      meta: { name: name.trim(), password_hash: passwordHash },
      expiresAt,
    })

    const { subject, text, html } = buildOtpEmail({ code, purpose: 'register' })
    await sendEmail({ to: normalizedEmail, subject, text, html })

    const payload = {
      message: 'ส่งรหัส OTP ไปที่อีเมลแล้ว กรุณาตรวจสอบกล่องจดหมาย (รวมถึง Spam)',
      expiresIn: OTP_TTL_MS / 1000,
    }
    if (process.env.NODE_ENV !== 'production') {
      payload.devOtp = code
    }
    res.json(payload)
  } catch (err) {
    console.error('Register send OTP error:', err.message)
    res.status(500).json({ error: 'ส่งรหัส OTP ไม่สำเร็จ กรุณาลองใหม่' })
  }
})

router.post('/register/verify', otpVerifyLimiter, async (req, res) => {
  const { email, otp, name, password } = req.body

  const nameErr = validateName(name)
  if (nameErr) return res.status(400).json({ error: nameErr })

  const emailErr = validateEmail(email)
  if (emailErr) return res.status(400).json({ error: emailErr })

  const passwordErr = validatePassword(password)
  if (passwordErr) return res.status(400).json({ error: passwordErr })

  const otpErr = validateOtpCode(otp)
  if (otpErr) return res.status(400).json({ error: otpErr })

  try {
    const normalizedEmail = normalizeEmail(email)
    const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail])
    if (existing.rows.length) {
      return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' })
    }

    const check = await verifyStoredOtp({
      email: normalizedEmail,
      purpose: 'register',
      otp: otp.trim().replace(/\s/g, ''),
    })
    if (!check.ok) return res.status(400).json({ error: check.error })

    const meta = check.record.meta || {}
    if (meta.name !== name.trim()) {
      return res.status(400).json({ error: 'ข้อมูลไม่ตรงกับที่ขอ OTP กรุณาเริ่มสมัครใหม่' })
    }

    const validPassword = await bcrypt.compare(password, meta.password_hash || '')
    if (!validPassword) {
      return res.status(400).json({ error: 'ข้อมูลไม่ตรงกับที่ขอ OTP กรุณาเริ่มสมัครใหม่' })
    }

    const result = await pool.query(
      `INSERT INTO users (email, password, name, email_verified)
       VALUES ($1, $2, $3, true)
       RETURNING id, email, name`,
      [normalizedEmail, meta.password_hash, name.trim()]
    )
    const user = result.rows[0]
    await deleteEmailOtp(check.record.id)

    try {
      await ensureUserPortfolio(user.id)
    } catch (e) {
      console.warn('Default portfolio not created:', e.message)
    }

    const token = jwt.sign({ userId: user.id }, process.env.JWT_SECRET, { expiresIn: '30d' })
    res.json({ token, user: publicUser(user), message: 'สมัครสมาชิกสำเร็จ' })
  } catch (err) {
    console.error('Register verify error:', err.message)
    res.status(500).json({ error: 'ยืนยัน OTP ไม่สำเร็จ กรุณาลองใหม่' })
  }
})

router.post('/register', authLimiter, async (req, res) => {
  res.status(400).json({
    error: 'กรุณายืนยันอีเมลด้วย OTP ก่อนสมัคร — ใช้ /auth/register/send-otp',
  })
})

router.post('/login', authLimiter, async (req, res) => {
  const { email, password } = req.body

  const emailErr = validateEmail(email)
  if (emailErr) return res.status(400).json({ error: emailErr })
  if (!password) return res.status(400).json({ error: 'กรุณาระบุรหัสผ่าน' })

  try {
    const normalizedEmail = normalizeEmail(email)
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]
    if (!user) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })

    const valid = await bcrypt.compare(password, user.password)
    if (!valid) return res.status(401).json({ error: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' })

    if (user.email_verified === false) {
      return res.status(403).json({ error: 'กรุณายืนยันอีเมลก่อนเข้าสู่ระบบ' })
    }

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
    'ถ้าอีเมลนี้มีในระบบ เราจะส่งรหัส OTP ไปให้ภายในไม่กี่นาที'

  if (!requireSmtpOrFail(res)) return

  try {
    const normalizedEmail = normalizeEmail(email)
    const result = await pool.query('SELECT id, email FROM users WHERE email = $1', [normalizedEmail])
    const user = result.rows[0]

    if (user) {
      const pending = await findActiveEmailOtp(normalizedEmail, 'reset_password')
      if (pending && !canResendOtp(pending.created_at)) {
        return res.json({
          message: genericMessage,
          retryAfter: resendCooldownSeconds(pending.created_at),
        })
      }

      const { code } = await sendOtpEmail({ email: normalizedEmail, purpose: 'reset_password' })
      if (process.env.NODE_ENV !== 'production') {
        console.warn(`[dev] reset OTP for ${normalizedEmail}: ${code}`)
      }
    }

    res.json({ message: genericMessage, expiresIn: OTP_TTL_MS / 1000 })
  } catch (err) {
    console.error('Forgot password error:', err.message)
    res.status(500).json({ error: 'ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่ภายหลัง' })
  }
})

router.post('/reset-password', authLimiter, async (req, res) => {
  const { token, email, otp, password } = req.body

  const passwordErr = validatePassword(password)
  if (passwordErr) return res.status(400).json({ error: passwordErr })

  if (otp && email) {
    const emailErr = validateEmail(email)
    if (emailErr) return res.status(400).json({ error: emailErr })
    const otpErr = validateOtpCode(otp)
    if (otpErr) return res.status(400).json({ error: otpErr })

    try {
      const normalizedEmail = normalizeEmail(email)
      const check = await verifyStoredOtp({
        email: normalizedEmail,
        purpose: 'reset_password',
        otp: otp.trim().replace(/\s/g, ''),
      })
      if (!check.ok) return res.status(400).json({ error: check.error })

      const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
      const user = userResult.rows[0]
      if (!user) return res.status(400).json({ error: 'ไม่พบบัญชีอีเมลนี้' })

      const hash = await bcrypt.hash(password, 10)
      await pool.query(
        `UPDATE users
         SET password = $1, password_reset_token = NULL, password_reset_expires = NULL
         WHERE id = $2`,
        [hash, user.id]
      )
      await deleteEmailOtp(check.record.id)

      return res.json({ message: 'ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ' })
    } catch (err) {
      console.error('Reset password OTP error:', err.message)
      return res.status(500).json({ error: 'ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่' })
    }
  }

  if (!token || typeof token !== 'string') {
    return res.status(400).json({ error: 'กรุณาระบุรหัส OTP หรือลิงก์รีเซ็ต' })
  }

  try {
    const result = await pool.query(
      `SELECT id FROM users
       WHERE password_reset_token = $1
         AND password_reset_expires > NOW()`,
      [token]
    )
    const user = result.rows[0]
    if (!user) {
      return res.status(400).json({ error: OTP_LEGACY_MESSAGE })
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

router.post('/resend-otp', otpSendLimiter, async (req, res) => {
  const { email, purpose, name, password } = req.body

  const emailErr = validateEmail(email)
  if (emailErr) return res.status(400).json({ error: emailErr })

  if (!['register', 'reset_password'].includes(purpose)) {
    return res.status(400).json({ error: 'ประเภท OTP ไม่ถูกต้อง' })
  }

  if (!requireSmtpOrFail(res)) return

  try {
    const normalizedEmail = normalizeEmail(email)

    if (purpose === 'register') {
      const nameErr = validateName(name)
      if (nameErr) return res.status(400).json({ error: nameErr })
      const passwordErr = validatePassword(password)
      if (passwordErr) return res.status(400).json({ error: passwordErr })

      const existing = await pool.query('SELECT 1 FROM users WHERE email = $1', [normalizedEmail])
      if (existing.rows.length) {
        return res.status(409).json({ error: 'อีเมลนี้ถูกใช้งานแล้ว' })
      }

      const pending = await findActiveEmailOtp(normalizedEmail, 'register')
      if (pending && !canResendOtp(pending.created_at)) {
        return res.status(429).json({
          error: `กรุณารอ ${resendCooldownSeconds(pending.created_at)} วินาทีก่อนขอรหัสใหม่`,
          retryAfter: resendCooldownSeconds(pending.created_at),
        })
      }

      const passwordHash = await bcrypt.hash(password, 10)
      const code = generateOtpCode()
      const expiresAt = new Date(Date.now() + OTP_TTL_MS)
      await upsertEmailOtp({
        email: normalizedEmail,
        purpose: 'register',
        otpHash: hashOtpCode(code),
        meta: { name: name.trim(), password_hash: passwordHash },
        expiresAt,
      })
      const { subject, text, html } = buildOtpEmail({ code, purpose: 'register' })
      await sendEmail({ to: normalizedEmail, subject, text, html })

      const payload = { message: 'ส่งรหัส OTP ใหม่แล้ว', expiresIn: OTP_TTL_MS / 1000 }
      if (process.env.NODE_ENV !== 'production') payload.devOtp = code
      return res.json(payload)
    }

    const userResult = await pool.query('SELECT id FROM users WHERE email = $1', [normalizedEmail])
    if (!userResult.rows.length) {
      return res.json({ message: 'ถ้าอีเมลนี้มีในระบบ เราจะส่งรหัส OTP ไปให้' })
    }

    const pending = await findActiveEmailOtp(normalizedEmail, 'reset_password')
    if (pending && !canResendOtp(pending.created_at)) {
      return res.status(429).json({
        error: `กรุณารอ ${resendCooldownSeconds(pending.created_at)} วินาทีก่อนขอรหัสใหม่`,
        retryAfter: resendCooldownSeconds(pending.created_at),
      })
    }

    const { code } = await sendOtpEmail({ email: normalizedEmail, purpose: 'reset_password' })
    const payload = { message: 'ส่งรหัส OTP ใหม่แล้ว', expiresIn: OTP_TTL_MS / 1000 }
    if (process.env.NODE_ENV !== 'production') payload.devOtp = code
    if (process.env.NODE_ENV !== 'production') console.warn(`[dev] resent reset OTP: ${code}`)
    res.json(payload)
  } catch (err) {
    console.error('Resend OTP error:', err.message)
    res.status(500).json({ error: 'ส่งรหัส OTP ไม่สำเร็จ' })
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
