export const MAX_ATTACHMENTS_PER_TICKET = 3
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024
/** @deprecated use MAX_ATTACHMENT_BYTES */
export const MAX_RECEIPT_BYTES = MAX_ATTACHMENT_BYTES

export function parseImageBase64(dataUrl) {
  if (!dataUrl) return null
  const raw = String(dataUrl).trim()
  const match = raw.match(/^data:(image\/(?:png|jpeg|jpg|webp));base64,(.+)$/i)
  if (!match) return { error: 'รูปไม่ถูกต้อง — ใช้ไฟล์ JPG, PNG หรือ WebP' }

  let contentType = match[1].toLowerCase()
  if (contentType === 'image/jpg') contentType = 'image/jpeg'

  let buffer
  try {
    buffer = Buffer.from(match[2], 'base64')
  } catch {
    return { error: 'อ่านไฟล์รูปไม่สำเร็จ' }
  }
  if (!buffer.length) return { error: 'ไฟล์รูปว่างเปล่า' }
  if (buffer.length > MAX_ATTACHMENT_BYTES) {
    return { error: `ไฟล์รูปใหญ่เกินไป (สูงสุด ${MAX_ATTACHMENT_BYTES / (1024 * 1024)} MB ต่อไฟล์)` }
  }

  return { buffer, contentType }
}

/** @deprecated use parseImageBase64 / parseAttachmentsInput */
export function parseReceiptBase64(receiptBase64) {
  if (!receiptBase64) return null
  const parsed = parseImageBase64(receiptBase64)
  if (parsed?.error) return parsed
  return parsed
}

export function parseAttachmentsInput({ attachmentsBase64, receiptBase64 }) {
  const attachments = []

  if (Array.isArray(attachmentsBase64)) {
    for (const item of attachmentsBase64) {
      const parsed = parseImageBase64(item)
      if (parsed?.error) return parsed
      if (parsed) attachments.push(parsed)
    }
  }

  if (receiptBase64) {
    const legacy = parseReceiptBase64(receiptBase64)
    if (legacy?.error) return legacy
    if (legacy) attachments.push(legacy)
  }

  if (attachments.length > MAX_ATTACHMENTS_PER_TICKET) {
    return { error: `แนบรูปได้สูงสุด ${MAX_ATTACHMENTS_PER_TICKET} ไฟล์` }
  }

  return { attachments }
}

export function attachmentFilename(id, contentType, index = 0) {
  const ext = contentType?.includes('png') ? 'png' : contentType?.includes('webp') ? 'webp' : 'jpg'
  return `attachment-${id}-${index + 1}.${ext}`
}
