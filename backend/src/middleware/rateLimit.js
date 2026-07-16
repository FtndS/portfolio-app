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

export const otpSendLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ขอรหัส OTP บ่อยเกินไป กรุณาลองใหม่ใน 1 ชั่วโมง' },
})

export const otpVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ลองยืนยัน OTP บ่อยเกินไป กรุณารอสักครู่' },
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

export const supportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ส่งคำร้องบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
})

export const csvImportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'นำเข้า CSV บ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
})

export const exportLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ส่งออกข้อมูลบ่อยเกินไป กรุณาลองใหม่ภายหลัง' },
})

export const historyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'โหลดประวัติพอร์ตบ่อยเกินไป กรุณารอสักครู่แล้วลองใหม่' },
})

export const placeSearchLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'ค้นหาสถานที่บ่อยเกินไป กรุณารอสักครู่' },
})
