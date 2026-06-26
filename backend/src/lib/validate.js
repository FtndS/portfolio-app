const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export function validateEmail(email) {
  if (!email || typeof email !== 'string') return 'กรุณาระบุอีเมล'
  if (!EMAIL_RE.test(email.trim())) return 'รูปแบบอีเมลไม่ถูกต้อง'
  return null
}

export function validatePassword(password, { minLength = 8 } = {}) {
  if (!password || typeof password !== 'string') return 'กรุณาระบุรหัสผ่าน'
  if (password.length < minLength) return `รหัสผ่านต้องมีอย่างน้อย ${minLength} ตัว`
  return null
}

export function validateName(name) {
  if (!name || typeof name !== 'string' || !name.trim()) return 'กรุณาระบุชื่อ'
  if (name.trim().length > 100) return 'ชื่อยาวเกินไป'
  return null
}
