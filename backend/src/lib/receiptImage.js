export const MAX_RECEIPT_BYTES = 1.5 * 1024 * 1024

export function parseReceiptBase64(receiptBase64) {
  if (!receiptBase64) return null
  const raw = String(receiptBase64).trim()
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i)
  if (!match) return { error: 'รูปสลิปไม่ถูกต้อง — ใช้ไฟล์ JPG หรือ PNG' }

  let contentType = match[1].toLowerCase()
  if (contentType === 'image/jpg') contentType = 'image/jpeg'

  let buffer
  try {
    buffer = Buffer.from(match[2], 'base64')
  } catch {
    return { error: 'อ่านไฟล์สลิปไม่สำเร็จ' }
  }
  if (!buffer.length) return { error: 'ไฟล์สลิปว่างเปล่า' }
  if (buffer.length > MAX_RECEIPT_BYTES) {
    return { error: 'ไฟล์สลิปใหญ่เกินไป (สูงสุด 1.5 MB)' }
  }

  return { buffer, contentType }
}
