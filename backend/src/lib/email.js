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

export async function sendEmail({ to, subject, html, text }) {
  const from = process.env.SMTP_FROM || 'Port Diary <noreply@portdiary.com>'
  const transport = getTransporter()

  if (!transport) {
    console.warn(`[email] SMTP not configured — would send to ${to}: ${subject}`)
    if (process.env.NODE_ENV !== 'production') {
      console.warn('[email] body:', text || html)
    }
    return false
  }

  await transport.sendMail({ from, to, subject, html, text })
  return true
}

export function buildOtpEmail({ code, purpose }) {
  const isRegister = purpose === 'register'
  const subject = isRegister
    ? 'รหัสยืนยันการสมัคร Port Diary'
    : 'รหัสยืนยันรีเซ็ตรหัสผ่าน Port Diary'
  const action = isRegister ? 'ยืนยันการสมัครสมาชิก' : 'รีเซ็ตรหัสผ่าน'
  const text = `รหัส OTP สำหรับ${action} Port Diary: ${code}\n\nรหัสหมดอายุใน 10 นาที\nถ้าคุณไม่ได้ขอรหัสนี้ ให้ละเว้นอีเมลนี้`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="color:#6c5ce7">📓 Port Diary</h2>
      <p>รหัส OTP สำหรับ${action}</p>
      <p style="font-size:32px;font-weight:700;letter-spacing:8px;color:#6c5ce7;margin:24px 0">${code}</p>
      <p style="font-size:13px;color:#666">รหัสหมดอายุใน <strong>10 นาที</strong></p>
      <p style="font-size:12px;color:#999;margin-top:24px">ถ้าคุณไม่ได้ขอรหัสนี้ ให้ละเว้นอีเมลนี้</p>
    </div>
  `
  return { subject, text, html }
}

export function isSmtpConfigured() {
  return !!process.env.SMTP_HOST
}

export function buildPasswordResetEmail(resetUrl) {
  const subject = 'รีเซ็ตรหัสผ่าน Port Diary'
  const text = `คลิกลิงก์นี้เพื่อตั้งรหัสผ่านใหม่ (หมดอายุใน 1 ชั่วโมง):\n\n${resetUrl}\n\nถ้าคุณไม่ได้ขอรีเซ็ต ให้ละเว้นอีเมลนี้`
  const html = `
    <div style="font-family:sans-serif;max-width:480px;margin:0 auto;color:#222">
      <h2 style="color:#6c5ce7">📓 Port Diary</h2>
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
