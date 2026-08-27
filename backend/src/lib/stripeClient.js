import Stripe from 'stripe'

let client = null
let clientKey = null

export function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY?.trim()
  if (!key) return null
  if (!client || clientKey !== key) {
    client = new Stripe(key)
    clientKey = key
  }
  return client
}

export function isStripeConfigured() {
  return !!(
    process.env.STRIPE_ENABLED === 'true'
    && process.env.STRIPE_SECRET_KEY?.trim()
    && process.env.STRIPE_PRICE_ID?.trim()
  )
}

export function appBaseUrl() {
  return (process.env.APP_URL || 'http://localhost:5173').replace(/\/$/, '')
}

/** Safe user-facing message from Stripe SDK / API errors (no secrets). */
export function formatStripeError(err, fallback = 'เปิดหน้าชำระเงิน Stripe ไม่สำเร็จ') {
  const msg = String(err?.raw?.message || err?.message || '').trim()
  const code = String(err?.code || err?.raw?.code || '').trim()
  if (!msg) return fallback

  if (/No such price/i.test(msg) || (code === 'resource_missing' && /price/i.test(msg))) {
    return 'STRIPE_PRICE_ID ไม่ถูกต้อง หรือไม่ตรงกับโหมด test/live ของ secret key'
  }
  if (/Invalid API Key/i.test(msg) || /api[_ ]?key/i.test(msg)) {
    return 'STRIPE_SECRET_KEY ไม่ถูกต้อง — ตรวจ key แล้ว recreate backend'
  }
  if (/test mode.*live|live mode.*test/i.test(msg)) {
    return 'คีย์ Stripe กับ Price คนละโหมด (test/live) — ให้ตรงกันทั้งคู่'
  }
  if (/customer/i.test(msg) && /missing|deleted|no such/i.test(msg)) {
    return 'ข้อมูลลูกค้า Stripe เก่า/ถูกลบ — ลองชำระอีกครั้ง'
  }
  // Keep Stripe's message; it's meant for merchants/users and has no secrets
  return msg.length > 240 ? `${msg.slice(0, 240)}…` : msg
}
