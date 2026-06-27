import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import ThemeToggle from '../ThemeToggle'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

export default function SettingsModal({ user, onClose, onUserUpdate, onLogout }) {
  const [name, setName] = useState(user.name || '')
  const [profileMsg, setProfileMsg] = useState('')
  const [profileErr, setProfileErr] = useState('')
  const [loadingProfile, setLoadingProfile] = useState(false)

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [pwMsg, setPwMsg] = useState('')
  const [pwErr, setPwErr] = useState('')
  const [loadingPw, setLoadingPw] = useState(false)

  const [deletePassword, setDeletePassword] = useState('')
  const [deleteConfirm, setDeleteConfirm] = useState('')
  const [deleteErr, setDeleteErr] = useState('')
  const [loadingDelete, setLoadingDelete] = useState(false)
  const [exportMsg, setExportMsg] = useState('')
  const [exportErr, setExportErr] = useState('')
  const [loadingExport, setLoadingExport] = useState(false)

  const [supportCategory, setSupportCategory] = useState('bug')
  const [supportSubject, setSupportSubject] = useState('')
  const [supportMessage, setSupportMessage] = useState('')
  const [supportErr, setSupportErr] = useState('')
  const [supportMsg, setSupportMsg] = useState('')
  const [loadingSupport, setLoadingSupport] = useState(false)
  const [myTickets, setMyTickets] = useState([])
  const [loadingTickets, setLoadingTickets] = useState(false)

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

  const loadMyTickets = async () => {
    setLoadingTickets(true)
    const rows = await api.get('/support/mine')
    setMyTickets(Array.isArray(rows) ? rows : [])
    setLoadingTickets(false)
  }

  useEffect(() => {
    loadMyTickets()
  }, [])

  const submitSupport = async () => {
    setSupportErr('')
    setSupportMsg('')
    if (!supportSubject.trim()) return setSupportErr('กรุณาระบุหัวข้อ')
    if (supportMessage.trim().length < 10) return setSupportErr('รายละเอียดต้องมีอย่างน้อย 10 ตัวอักษร')
    setLoadingSupport(true)
    const r = await api.post('/support', {
      category: supportCategory,
      subject: supportSubject.trim(),
      message: supportMessage.trim(),
    })
    setLoadingSupport(false)
    if (r.error) {
      setSupportErr(r.error)
      return
    }
    setSupportMsg('ส่งคำร้องแล้ว — ทีมงานจะติดต่อกลับทางอีเมล')
    setSupportSubject('')
    setSupportMessage('')
    loadMyTickets()
  }

  const saveProfile = async () => {
    setProfileErr('')
    setProfileMsg('')
    if (!name.trim()) return setProfileErr('กรุณาระบุชื่อ')
    setLoadingProfile(true)
    const r = await api.put('/auth/profile', { name: name.trim() })
    setLoadingProfile(false)
    if (r.user) {
      onUserUpdate(r.user)
      localStorage.setItem('user', JSON.stringify(r.user))
      setProfileMsg(r.message || 'บันทึกชื่อสำเร็จ')
    } else {
      setProfileErr(r.error || 'บันทึกไม่สำเร็จ')
    }
  }

  const savePassword = async () => {
    setPwErr('')
    setPwMsg('')
    if (!currentPassword) return setPwErr('กรุณาระบุรหัสผ่านปัจจุบัน')
    if (newPassword.length < 8) return setPwErr('รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัว')
    if (newPassword !== confirmPassword) return setPwErr('รหัสผ่านใหม่ไม่ตรงกัน')
    setLoadingPw(true)
    const r = await api.put('/auth/change-password', { currentPassword, newPassword })
    setLoadingPw(false)
    if (r.message) {
      setPwMsg(r.message)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } else {
      setPwErr(r.error || 'เปลี่ยนรหัสผ่านไม่สำเร็จ')
    }
  }

  const exportData = async () => {
    setExportErr('')
    setExportMsg('')
    setLoadingExport(true)
    try {
      const res = await api.fetch('/auth/export')
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setExportErr(data.error || 'ส่งออกข้อมูลไม่สำเร็จ')
        return
      }
      const blob = await res.blob()
      const stamp = new Date().toISOString().slice(0, 10)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `portdiary-export-${stamp}.json`
      a.click()
      URL.revokeObjectURL(url)
      setExportMsg('ดาวน์โหลดข้อมูลสำเร็จ')
    } catch {
      setExportErr('ส่งออกข้อมูลไม่สำเร็จ')
    } finally {
      setLoadingExport(false)
    }
  }

  const deleteAccount = async () => {
    setDeleteErr('')
    if (deleteConfirm !== 'DELETE') return setDeleteErr('กรุณาพิมพ์ DELETE เพื่อยืนยัน')
    if (!deletePassword) return setDeleteErr('กรุณาระบุรหัสผ่านปัจจุบัน')
    if (!window.confirm('ลบบัญชีถาวรและข้อมูลทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้')) return

    setLoadingDelete(true)
    const r = await api.delete('/auth/account', { password: deletePassword, confirmation: deleteConfirm })
    setLoadingDelete(false)
    if (r.message) {
      onLogout?.()
      onClose()
    } else {
      setDeleteErr(r.error || 'ลบบัญชีไม่สำเร็จ')
    }
  }

  return (
    <Modal title="ตั้งค่าบัญชี" onClose={onClose}>
      <div style={{ marginBottom: '20px' }}>
        <h3 className="dash-settings-section-title">ธีมการแสดงผล</h3>
        <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          เลือก Light หรือ Dark — บันทึกในเครื่องนี้
        </p>
        <ThemeToggle className="dash-settings-theme-toggle" />
      </div>

      <div className="dash-settings-divider" style={{ marginBottom: '20px' }}>
        <h3 className="dash-settings-section-title">ข้อมูลส่วนตัว</h3>
        {profileErr && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{profileErr}</p>}
        {profileMsg && <p className="dash-text-gain" style={{ fontSize: '13px', marginBottom: '12px' }}>{profileMsg}</p>}
        <Field label="ชื่อที่แสดง">
          <input style={inp()} value={name} onChange={(e) => setName(e.target.value)} placeholder="ชื่อของคุณ" />
        </Field>
        <Field label="อีเมล">
          <input style={inp({ marginBottom: 0, color: 'var(--text-muted)', cursor: 'not-allowed' })} value={user.email || ''} readOnly />
        </Field>
        <p className="dash-text-faint" style={{ fontSize: '11px', marginTop: '6px', marginBottom: '12px' }}>เปลี่ยนอีเมลยังไม่รองรับ — ใช้อีเมลนี้เข้าสู่ระบบ</p>
        <button type="button" onClick={saveProfile} style={btnPrimary} disabled={loadingProfile}>
          {loadingProfile ? 'กำลังบันทึก...' : 'บันทึกชื่อ'}
        </button>
      </div>

      <div className="dash-settings-divider">
        <h3 className="dash-settings-section-title">เปลี่ยนรหัสผ่าน</h3>
        {pwErr && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{pwErr}</p>}
        {pwMsg && <p className="dash-text-gain" style={{ fontSize: '13px', marginBottom: '12px' }}>{pwMsg}</p>}
        <Field label="รหัสผ่านปัจจุบัน">
          <input type="password" style={inp()} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Field label="รหัสผ่านใหม่">
          <input type="password" style={inp()} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="อย่างน้อย 8 ตัว" />
        </Field>
        <Field label="ยืนยันรหัสผ่านใหม่">
          <input type="password" style={inp({ marginBottom: 0 })} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="พิมพ์อีกครั้ง" />
        </Field>
        <button type="button" onClick={savePassword} style={{ ...btnPrimary, marginTop: '12px' }} disabled={loadingPw}>
          {loadingPw ? 'กำลังเปลี่ยน...' : 'เปลี่ยนรหัสผ่าน'}
        </button>
      </div>

      <div className="dash-settings-divider" style={{ marginTop: '20px' }}>
        <h3 className="dash-settings-section-title">ข้อมูลและความเป็นส่วนตัว</h3>
        <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          ดาวน์โหลดข้อมูลพอร์ต ธุรกรรม journal และปันผลของคุณเป็นไฟล์ JSON
        </p>
        {exportErr && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{exportErr}</p>}
        {exportMsg && <p className="dash-text-gain" style={{ fontSize: '13px', marginBottom: '12px' }}>{exportMsg}</p>}
        <button type="button" onClick={exportData} style={btnGhost} disabled={loadingExport}>
          {loadingExport ? 'กำลังส่งออก...' : 'ดาวน์โหลดข้อมูลของฉัน'}
        </button>
      </div>

      <div className="dash-settings-divider" style={{ marginTop: '20px' }}>
        <h3 className="dash-settings-section-title">แจ้งปัญหา / ติดต่อทีมงาน</h3>
        <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          แจ้ง bug, คำถาม หรือขอฟีเจอร์ — ทีมงานจะได้รับแจ้งทางอีเมล
        </p>
        {supportErr && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{supportErr}</p>}
        {supportMsg && <p className="dash-text-gain" style={{ fontSize: '13px', marginBottom: '12px' }}>{supportMsg}</p>}
        <Field label="ประเภท">
          <select style={inp()} value={supportCategory} onChange={(e) => setSupportCategory(e.target.value)}>
            {SUPPORT_CATEGORIES.map(([v, label]) => (
              <option key={v} value={v}>{label}</option>
            ))}
          </select>
        </Field>
        <Field label="หัวข้อ">
          <input style={inp()} value={supportSubject} onChange={(e) => setSupportSubject(e.target.value)} placeholder="สรุปปัญหาสั้นๆ" maxLength={200} />
        </Field>
        <Field label="รายละเอียด">
          <textarea
            style={{ ...inp(), height: '100px', resize: 'vertical', marginBottom: 0 }}
            value={supportMessage}
            onChange={(e) => setSupportMessage(e.target.value)}
            placeholder="อธิบายปัญหา ขั้นตอนที่ทำให้เกิด หรือสิ่งที่ต้องการ..."
            maxLength={5000}
          />
        </Field>
        <button type="button" onClick={submitSupport} style={{ ...btnPrimary, marginTop: '12px' }} disabled={loadingSupport}>
          {loadingSupport ? 'กำลังส่ง...' : 'ส่งคำร้อง'}
        </button>
        {loadingTickets ? (
          <p className="dash-text-faint" style={{ fontSize: '12px', marginTop: '16px' }}>กำลังโหลดคำร้องของคุณ...</p>
        ) : myTickets.length > 0 && (
          <div style={{ marginTop: '16px' }}>
            <p className="dash-text-muted" style={{ fontSize: '12px', marginBottom: '8px' }}>คำร้องล่าสุดของคุณ</p>
            {myTickets.slice(0, 5).map((t) => (
              <div key={t.id} className="dash-inset" style={{ padding: '10px 12px', marginBottom: '8px', fontSize: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: '8px', marginBottom: '4px' }}>
                  <strong>{t.subject}</strong>
                  <span className="dash-text-faint">{TICKET_STATUS[t.status] || t.status}</span>
                </div>
                <span className="dash-text-faint">{new Date(t.created_at).toLocaleDateString('th-TH')}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="dash-settings-divider" style={{ marginTop: '20px' }}>
        <h3 className="dash-settings-section-title" style={{ color: 'var(--loss)' }}>ลบบัญชีถาวร</h3>
        <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          ลบบัญชีและข้อมูลทั้งหมดอย่างถาวร ไม่สามารถกู้คืนได้
        </p>
        {deleteErr && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{deleteErr}</p>}
        <Field label="รหัสผ่านปัจจุบัน">
          <input type="password" style={inp()} value={deletePassword} onChange={(e) => setDeletePassword(e.target.value)} placeholder="••••••••" />
        </Field>
        <Field label='พิมพ์ DELETE เพื่อยืนยัน'>
          <input style={inp({ marginBottom: 0 })} value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
        </Field>
        <button
          type="button"
          onClick={deleteAccount}
          style={{ ...btnGhost, marginTop: '12px', color: 'var(--loss)', borderColor: 'var(--loss)' }}
          disabled={loadingDelete}
        >
          {loadingDelete ? 'กำลังลบ...' : 'ลบบัญชีถาวร'}
        </button>
      </div>
    </Modal>
  )
}
