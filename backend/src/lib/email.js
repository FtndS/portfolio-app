import nodemailer from 'nodemailer'

let transporter

function getTransporter() {
  if (!process.env.SMTP_HOST) return null
  if (!transporter) {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: Number(process.env.SMTP_PORT || 587),
      secure: process.env.SMTP_SECURE === 'true',
      auth: process.env.SMTP_USER
        ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
        : undefined,
    })
  }
  return transporter
}

export async function sendEmail({ to, subject, html, text, attachments }) {
  const from = process.env.SMTP_FROM || 'PortDiary <noreply@portdiary.com>'
  const transport = getTransporter()

  if (!transport) {
    console.warn(`[email] SMTP not configured — would send to ${to}: ${subject}`)
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[email] body:', text || html)
    }
    return false
  }

  await transport.sendMail({ from, to, subject, html, text, attachments })
  return true
}

export function buildOtpEmail({ code, purpose }) {
  const isRegister = purpose === 'register'
  const subject = isRegister
    ? 'รหัสยืนยันการสมัคร PortDiary'
    : 'รหัสยืนยันรีเซ็ตรหัสผ่าน PortDiary'
  const action = isRegister ? 'ยืนยันการสมัครสมาชิก' : 'รีเซ็ตรหัสผ่าน'
  const text = `รหัส OTP สำหรับ${action} PortDiary: ${code}\n\nรหัสหมดอายุใน 10 นาที\nถ้าคุณไม่ได้ขอรหัสนี้ ให้ละเว้นอีเมลนี้`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="color:#6c5ce7">PortDiary</h2>
      <p>รหัส OTP สำหรับ${action}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#6c5ce7;margin:24px 0">${code}</p>
      <p style="font-size:13px;color:#666">รหัสหมดอายุใน <strong>10 นาที</strong></p>
      <p style="font-size:12px;color:#999;margin-top:24px">ถ้าคุณไม่ได้ขอรหัสนี้ ให้ละเว้นอีเมลนี้</p>
    </div>
  `
  return { subject, text, html }
}

const CATEGORY_LABELS = {
  bug: 'แจ้งปัญหา / Bug',
  question: 'คำถามการใช้งาน',
  feature: 'ขอฟีเจอร์',
  upgrade: 'อัปเกรด Pro',
  other: 'อื่นๆ',
}

export function buildSupportTicketEmail({ ticket, user }) {
  const appUrl = process.env.APP_URL || 'https://portdiary.com'
  const category = CATEGORY_LABELS[ticket.category] || ticket.category
  const isUpgrade = ticket.category === 'upgrade'
  const subject = isUpgrade
    ? `[PortDiary] ขออัปเกรด Pro #${ticket.id} — ${user.email}`
    : `[PortDiary] คำร้องใหม่ #${ticket.id}: ${ticket.subject}`
  const text = [
    isUpgrade ? 'มีคำขออัปเกรด Pro พร้อมสลิปแนบ' : `มีคำร้องใหม่จาก ${user.name} (${user.email})`,
    '',
    `จาก: ${user.name} (${user.email})`,
    `ประเภท: ${category}`,
    `หัวข้อ: ${ticket.subject}`,
    '',
    ticket.message,
    '',
    `ดูใน Admin: ${appUrl}/admin`,
  ].join('\n')
  const html = `
    <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#222">
      <h2 style="color:#6c5ce7">${isUpgrade ? '🚀 PortDiary — ขออัปเกรด Pro' : '📋 PortDiary — คำร้องใหม่'}</h2>
      <p><strong>จาก:</strong> ${user.name} (${user.email})</p>
      <p><strong>ประเภท:</strong> ${category}</p>
      <p><strong>หัวข้อ:</strong> ${ticket.subject}</p>
      ${isUpgrade ? '<p style="color:#15803d"><strong>แนบสลิปการโอนในอีเมลนี้</strong> — เปิด Pro ได้ที่ Admin → จัดการแผน Pro</p>' : ''}
      <div style="background:#f5f5f5;padding:14px;border-radius:8px;margin:16px 0;white-space:pre-wrap;font-size:14px;line-height:1.6">${ticket.message.replace(/</g, '&lt;')}</div>
      <p><a href="${appUrl}/admin" style="color:#6c5ce7">เปิดหน้า Admin</a></p>
    </div>
  `
  return { subject, text, html }
}

function formatThaiDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

export function buildSlipReceivedEmail({ userName, ticketId }) {
  const appUrl = process.env.APP_URL || 'https://portdiary.com'
  const subject = `รับสลิปแล้ว — คำขอ Pro #${ticketId}`
  const text = [
    `สวัสดี ${userName || ''}`.trim(),
    '',
    'เราได้รับสลิปการโอนของคุณแล้ว',
    `หมายเลขคำขอ: #${ticketId}`,
    '',
    'ทีมงานจะตรวจสอบและเปิดแผน Pro ภายใน 1 วันทำการ',
    'คุณจะได้รับอีเมลแจ้งอีกครั้งเมื่อเปิด Pro สำเร็จ',
    '',
    `ตรวจสอบสถานะ: ${appUrl}`,
  ].join('\n')
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="color:#6c5ce7">PortDiary</h2>
      <p>สวัสดี${userName ? ` ${userName}` : ''}</p>
      <p>เราได้รับสลิปการโอนของคุณแล้ว — <strong>คำขอ #${ticketId}</strong></p>
      <p>ทีมงานจะตรวจสอบและเปิดแผน <strong>Pro</strong> ภายใน <strong>1 วันทำการ</strong></p>
      <p style="font-size:13px;color:#666">คุณจะได้รับอีเมลแจ้งอีกครั้งเมื่อเปิด Pro สำเร็จ</p>
      <p><a href="${appUrl}" style="color:#6c5ce7">เปิด PortDiary</a></p>
    </div>
  `
  return { subject, text, html }
}

export function buildProActivatedEmail({ userName, planExpiresAt, source = 'manual' }) {
  const appUrl = (process.env.APP_URL || 'https://portdiary.com').replace(/\/$/, '')
  const expires = formatThaiDate(planExpiresAt)
  const sourceNote = source === 'stripe'
    ? 'การชำระด้วยบัตรสำเร็จ'
    : 'การชำระผ่าน PromptPay'
  const subject = 'เปิดแผน PortDiary Pro แล้ว'
  const text = [
    `สวัสดี ${userName || ''}`.trim(),
    '',
    `${sourceNote} — บัญชีของคุณเป็นแผน Pro แล้ว`,
    `ใช้งานได้ถึง: ${expires}`,
    '',
    `เข้าใช้งาน: ${appUrl}`,
  ].join('\n')
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="color:#6c5ce7">PortDiary Pro</h2>
      <p>สวัสดี${userName ? ` ${userName}` : ''}</p>
      <p>${sourceNote} — บัญชีของคุณเป็นแผน <strong>Pro</strong> แล้ว</p>
      <p>ใช้งานได้ถึง: <strong>${expires}</strong></p>
      <p><a href="${appUrl}" style="color:#6c5ce7">เปิด PortDiary</a></p>
    </div>
  `
  return { subject, text, html }
}

export async function sendSlipReceivedEmail(user, ticketId) {
  if (!user?.email) return false
  const { subject, html, text } = buildSlipReceivedEmail({
    userName: user.name,
    ticketId,
  })
  return sendEmail({ to: user.email, subject, html, text })
}

export async function sendProActivatedEmail(user, { source = 'manual' } = {}) {
  if (!user?.email) return false
  const { subject, html, text } = buildProActivatedEmail({
    userName: user.name,
    planExpiresAt: user.plan_expires_at,
    source,
  })
  return sendEmail({ to: user.email, subject, html, text })
}

export function isSmtpConfigured() {
  return !!process.env.SMTP_HOST
}

export function buildPasswordResetEmail(resetUrl) {
  const subject = 'รีเซ็ตรหัสผ่าน PortDiary'
  const text = `คลิกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (หมดอายุใน 1 ชั่วโมง):\n\n${resetUrl}\n\nถ้าคุณไม่ได้ขอรีเซ็ต ให้ละเว้นอีเมลนี้`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="color:#6c5ce7">PortDiary</h2>
      <p>คุณขอรีเซ็ตรหัสผ่าน คลิกปุ่มด้านล่างเพื่อตั้งรหัสผ่านใหม่ (ลิงก์หมดอายุใน 1 ชั่วโมง)</p>
      <p style="margin:24px 0">
        <a href="${resetUrl}" style="display:inline-block;padding:12px 24px;background:#6c5ce7;color:#fff;text-decoration:none;border-radius:8px;font-weight:600">
          ตั้งรหัสผ่านใหม่
        </a>
      </p>
      <p style="font-size:13px;color:#666">ถ้าปุ่มไม่ทำงาน คัดลอกลิงก์นี้ไปวางในเบราว์เซอร์:<br>${resetUrl}</p>
      <p style="font-size:12px;color:#999;margin-top:24px">ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ให้ละเว้นอีเมลนี้</p>
    </div>
  `
  return { subject, text, html }
}
