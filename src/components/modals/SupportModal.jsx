import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import TicketImagePicker, { buildAttachmentsPayload } from '../support/TicketImagePicker'

const SUPPORT_CATEGORIES = [
  ['bug', 'แจ้งปัญหา / Bug'],
  ['question', 'คำถามการใช้งาน'],
  ['feature', 'ขอฟีเจอร์'],
  ['other', 'อื่นๆ'],
]

const TICKET_STATUS = {
  open: 'เปิดใหม่',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิด',
}

export default function SupportModal({ onClose, initial = null, onOpenSubscription = null }) {
  const [category, setCategory] = useState(initial?.category || 'bug')
  const [subject, setSubject] = useState(initial?.subject || '')
  const [message, setMessage] = useState(initial?.message || '')
  const [attachmentFiles, setAttachmentFiles] = useState([])
  const [attachErr, setAttachErr] = useState('')
  const [err, setErr] = useState('')
  const [msg, setMsg] = useState('')
  const [loading, setLoading] = useState(false)
  const [myTickets, setMyTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)

  const loadMyTickets = async () => {
    setLoadingTickets(true)
    const rows = await api.get('/support/mine')
    setMyTickets(Array.isArray(rows) ? rows : [])
    setLoadingTickets(false)
  }

  useEffect(() => {
    loadMyTickets()
  }, [])

  const submit = async () => {
    setErr('')
    setMsg('')
    if (!subject.trim()) return setErr('กรุณาระบุหัวข้อ')
    if (message.trim().length < 10) return setErr('รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร')
    setLoading(true)
    try {
      const attachmentsBase64 = await buildAttachmentsPayload(attachmentFiles)
      const r = await api.post('/support', {
        category,
        subject: subject.trim(),
        message: message.trim(),
        attachmentsBase64,
      })
      if (r.error) {
        setErr(r.error)
        return
      }
      setMsg('ส่งคำร้องแล้ว — ทีมงานจะติดต่อกลับทางอีเมล')
      setSubject('')
      setMessage('')
      setAttachmentFiles([])
      loadMyTickets()
    } catch {
      setErr('ส่งคำร้องไม่สำเร็จ — ลองใหม่อีกครั้ง')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal title="ช่วยเหลือ / แจ้งปัญหา" onClose={onClose}>
      <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
        แจ้ง bug, ถามการใช้งาน หรือขอฟีเจอร์ — แนบรูปหน้าจอได้สูงสุด 3 ไฟล์ (ไฟล์ละ 5 MB)
        {onOpenSubscription && (
          <>
            {' '}· อัปเกรด Pro ไปที่{' '}
            <button type="button" className="dash-link-btn" onClick={() => { onClose(); onOpenSubscription() }}>
              หน้าแผน Pro
            </button>
          </>
        )}
      </p>
      {err && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{err}</p>}
      {msg && <p className="dash-text-gain" style={{ fontSize: '13px', marginBottom: '12px' }}>{msg}</p>}
      <Field label="ประเภท">
        <select style={inp()} value={category} onChange={(e) => setCategory(e.target.value)}>
          {SUPPORT_CATEGORIES.map(([v, label]) => (
            <option key={v} value={v}>{label}</option>
          ))}
        </select>
      </Field>
      <Field label="หัวข้อ">
        <input style={inp()} value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="สรุปปัญหาสั้นๆ" maxLength={200} />
      </Field>
      <Field label="รายละเอียด">
        <textarea
          style={{ ...inp(), height: '120px', resize: 'vertical', marginBottom: 0 }}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          placeholder="อธิบายปัญหา ขั้นตอนที่ทำให้เกิด หรือสิ่งที่ต้องการ..."
          maxLength={5000}
        />
      </Field>

      <TicketImagePicker
        files={attachmentFiles}
        onChange={setAttachmentFiles}
        err={attachErr}
        setErr={setAttachErr}
      />

      <button type="button" onClick={submit} style={{ ...btnPrimary, marginTop: '12px' }} disabled={loading}>
        {loading ? 'กำลังส่ง...' : 'ส่งคำร้อง'}
      </button>

      {loadingTickets ? (
        <p className="dash-text-faint" style={{ fontSize: '12px', marginTop: '20px' }}>กำลังโหลดคำร้องของคุณ...</p>
      ) : myTickets.length > 0 && (
        <div style={{ marginTop: '20px' }}>
          <p className="dash-text-muted" style={{ fontSize: '12px', marginBottom: '8px' }}>คำร้องล่าสุดของคุณ</p>
          {myTickets.slice(0, 5).map((t) => (
            <div key={t.id} className="dash-inset" style={{ padding: '10px 12px', marginBottom: '8px', fontSize: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                <strong>{t.subject}</strong>
                <span className="dash-text-faint">{TICKET_STATUS[t.status] || t.status}</span>
              </div>
              <span className="dash-text-faint">
                {new Date(t.created_at).toLocaleDateString('th-TH')}
                {(t.has_receipt || t.attachment_count > 0) && ' · มีรูปแนบ'}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: '16px' }}>
        <button type="button" onClick={onClose} style={btnGhost}>ปิด</button>
      </div>
    </Modal>
  )
}
