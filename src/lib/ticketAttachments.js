export const MAX_TICKET_ATTACHMENTS = 3
export const MAX_TICKET_ATTACHMENT_BYTES = 5 * 1024 * 1024

export function formatTicketAttachmentLimitMb() {
  return MAX_TICKET_ATTACHMENT_BYTES / (1024 * 1024)
}
export const TICKET_IMAGE_ACCEPT = 'image/png,image/jpeg,image/webp'

export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

export function validateTicketImageFile(file) {
  if (!file) return 'ไม่พบไฟล์'
  if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
    return 'ใช้ไฟล์รูป JPG, PNG หรือ WebP เท่านั้น'
  }
  if (file.size > MAX_TICKET_ATTACHMENT_BYTES) {
    return `ไฟล์ใหญ่เกิน ${formatTicketAttachmentLimitMb()} MB`
  }
  return null
}
