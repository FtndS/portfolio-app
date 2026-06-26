import { useState } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import { useTheme } from '../../lib/theme'
import ThemeToggle from '../ThemeToggle'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

export default function SettingsModal({ user, onClose, onUserUpdate }) {
  const { theme } = useTheme()
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

  return (
    <Modal title="ตั้งค่าบัญชี" onClose={onClose}>
      <div style={{ marginBottom: '20px' }}>
        <h3 className="dash-settings-section-title">ธีมการแสดงผล</h3>
        <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          เลือก Light หรือ Dark — บันทึกในเครื่องนี้ (ปัจจุบัน: {theme === 'light' ? 'สว่าง' : 'มืด'})
        </p>
        <ThemeToggle />
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
    </Modal>
  )
}
