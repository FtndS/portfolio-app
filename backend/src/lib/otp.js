import crypto from 'crypto'
import pool from '../db/index.js'

export const OTP_LENGTH = 6
export const OTP_TTL_MS = 10 * 60 * 1000
export const OTP_MAX_ATTEMPTS = 5
export const OTP_RESEND_COOLDOWN_MS = 60 * 1000

function pepper() {
  return process.env.JWT_SECRET || 'dev-otp-pepper'
}

export function generateOtpCode() {
  const max = 10 ** OTP_LENGTH
  const n = crypto.randomInt(0, max)
  return String(n).padStart(OTP_LENGTH, '0')
}

export function hashOtpCode(code) {
  return crypto.createHmac('sha256', pepper()).update(String(code).trim()).digest('hex')
}

export function verifyOtpCode(code, hash) {
  if (!code || !hash) return false
  const a = Buffer.from(hashOtpCode(code))
  const b = Buffer.from(hash)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

export async function upsertEmailOtp({ email, purpose, otpHash, meta = {}, expiresAt }) {
  await pool.query('DELETE FROM email_otps WHERE email = $1 AND purpose = $2', [email, purpose])
  const result = await pool.query(
    `INSERT INTO email_otps (email, purpose, otp_hash, meta, expires_at)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, created_at`,
    [email, purpose, otpHash, JSON.stringify(meta), expiresAt]
  )
  return result.rows[0]
}

export async function findActiveEmailOtp(email, purpose) {
  const result = await pool.query(
    `SELECT * FROM email_otps
     WHERE email = $1 AND purpose = $2 AND expires_at > NOW()
     ORDER BY created_at DESC
     LIMIT 1`,
    [email, purpose]
  )
  const row = result.rows[0]
  if (!row) return null
  const meta = typeof row.meta === 'string' ? JSON.parse(row.meta) : (row.meta || {})
  return { ...row, meta }
}

export async function incrementOtpAttempts(id) {
  await pool.query('UPDATE email_otps SET attempts = attempts + 1 WHERE id = $1', [id])
}

export async function deleteEmailOtp(id) {
  await pool.query('DELETE FROM email_otps WHERE id = $1', [id])
}

export function canResendOtp(createdAt) {
  if (!createdAt) return true
  return Date.now() - new Date(createdAt).getTime() >= OTP_RESEND_COOLDOWN_MS
}

export function resendCooldownSeconds(createdAt) {
  if (!createdAt) return 0
  const left = OTP_RESEND_COOLDOWN_MS - (Date.now() - new Date(createdAt).getTime())
  return Math.max(0, Math.ceil(left / 1000))
}
