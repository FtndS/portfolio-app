import { isDisposableEmail } from './disposableDomains.js'

const EMAIL_RE = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+$/

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'กรุณาระบุอีเมล'
  const trimmed = email.trim().toLowerCase()
  if (!EMAIL_RE.test(trimmed)) return 'รูปแบบอีเมลไม่ถูกต้อง'
  if (trimmed.length > 254) return 'อีเมลยาวเกินไป'
  const [local, domain] = trimmed.split('@')
  if (!local || !domain || local.length > 64) return 'รูปแบบอีเมลไม่ถูกต้อง'
  if (isDisposableEmail(trimmed)) return 'กรุณาใช้อีเมลจริง ไม่รองรับอีเมลชั่วคราว'
  return null
}

export function normalizeEmail(email) {
  return email.trim().toLowerCase()
}

export function validateOtpCode(code) {
  if (!code || typeof code !== 'string') return 'กรุณาระบุรหัส OTP'
  const digits = code.trim().replace(/\s/g, '')
  if (!/^\d{6}$/.test(digits)) return 'รหัส OTP ต้องเป็นตัวเลข 6 หลัก'
  return null
}

export function validatePassword(password, { minLength = 8 } = {}) {
  if (!password || typeof password !== 'string') return 'กรุณาระบุรหัสผ่าน'
  if (password.length < minLength) return `รหัสผ่านต้องมีอย่างน้อย ${minLength} ตัว`
  return null
}

/** Parse optional transaction fee; returns null if invalid. */
export function parseFee(value) {
  if (value == null || value === '') return 0
  const n = parseFloat(value)
  if (!Number.isFinite(n) || n < 0) return null
  return Math.round(n * 100) / 100
}

export function validateName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) return 'กรุณาระบุชื่อ'
  if (name.trim().length > 100) return 'ชื่อยาวเกินไป'
  return null
}
