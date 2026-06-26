import rateLimit from 'express-rate-limit'

export const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'คำขอมากเกินไป กรุณารอสักครู่แล้วลองใหม่' },
})

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ขอรีเซ็ตรหัสผ่านบ่อยเกินไป กรุณาลองใหม่ใน 1 ชั่วโมง' },
})

export const aiLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ใช้งาน AI บ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
})

export const pricesLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'คำขอราคามากเกินไป กรุณารอสักครู่' },
})
