import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import OtpInput from '../auth/OtpInput'

export default function Register({ onGoLogin, onGoHome, onLogin }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' })
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState('form')
  const [error, setError] = useState('')
  const [info, setInfo] = useState('')
  const [loading, setLoading] = useState(false)
  const [resendIn, setResendIn] = useState(0)

  useEffect(() => {
    if (resendIn <= 0) return undefined
    const t = setTimeout(() => setResendIn((s) => s - 1), 1000)
    return () => clearTimeout(t)
  }, [resendIn])

  const validateForm = () => {
    if (!form.name || !form.email || !form.password) return 'กรุณากรอกข้อมูลให้ครบ'
    if (form.password !== form.confirm) return 'Password ไม่ตรงกัน'
    if (form.password.length < 8) return 'Password ต้องมีอย่างน้อย 8 ตัว'
    return null
  }

  const sendOtp = async () => {
    setError('')
    setInfo('')
    const err = validateForm()
    if (err) return setError(err)
    setLoading(true)
    try {
      const r = await api.post('/auth/register/send-otp', {
        name: form.name,
        email: form.email,
        password: form.password,
      })
      if (r.message) {
        setStep('otp')
        setInfo(r.message)
        setResendIn(r.retryAfter || 60)
        if (r.devOtp) setInfo(`${r.message} (dev OTP: ${r.devOtp})`)
      } else setError(r.error || 'ส่ง OTP ไม่สำเร็จ')
    } catch (e) {
      setError('เชื่อมต่อเซิร์verไม่ได้ — ลองใหม่หรือติดต่อ admin')
    }
    setLoading(false)
  }

  const resendOtp = async () => {
    if (resendIn > 0) return
    setError('')
    setLoading(true)
    try {
      const r = await api.post('/auth/resend-otp', {
        email: form.email,
        purpose: 'register',
        name: form.name,
        password: form.password,
      })
      if (r.message) {
        setInfo(r.message)
        setResendIn(r.retryAfter || 60)
        if (r.devOtp) setInfo(`${r.message} (dev OTP: ${r.devOtp})`)
      } else setError(r.error || 'ส่ง OTP ไม่สำเร็จ')
    } catch (e) {
      setError('เชื่อมต่อเซิร์verไม่ได้')
    }
    setLoading(false)
  }

  const verifyOtp = async () => {
    setError('')
    setInfo('')
    if (otp.length !== 6) return setError('กรุณาใส่รหัส OTP 6 หลัก')
    setLoading(true)
    try {
      const r = await api.post('/auth/register/verify', {
        name: form.name,
        email: form.email,
        password: form.password,
        otp,
      })
      if (r.token) {
        localStorage.setItem('token', r.token)
        localStorage.setItem('user', JSON.stringify(r.user))
        if (onLogin) onLogin(r.user)
        else setStep('done')
      } else setError(r.error || 'ยืนยัน OTP ไม่สำเร็จ')
    } catch (e) {
      setError('เชื่อมต่อเซิร์verไม่ได้')
    }
    setLoading(false)
  }

  const onKeyDown = (e) => { if (e.key === 'Enter') step === 'form' ? sendOtp() : verifyOtp() }

  if (step === 'done') {
    return (
      <div className="auth-wrap"><div className="auth-card" style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '48px', marginBottom: '16px' }}>🎉</div>
        <h2 style={{ color: '#fff', marginBottom: '8px' }}>สมัครสำเร็จ!</h2>
        <p style={{ color: '#666', fontSize: '13px', marginBottom: '20px' }}>ยืนยันอีเมลเรียบร้อยแล้ว</p>
        <button onClick={onGoLogin} style={btnPrimary}>ไปหน้า Login</button>
      </div></div>
    )
  }

  if (step === 'otp') {
    return (
      <div className="auth-wrap"><div className="auth-card">
        <h1 style={{ color: 'var(--text)', fontSize: '20px', marginBottom: '8px' }}>ยืนยันอีเมล</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginBottom: '20px' }}>
          ส่งรหัส OTP 6 หลักไปที่ <strong style={{ color: 'var(--text)' }}>{form.email}</strong>
        </p>
        {error && <p style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
        {info && <p style={{ color: 'var(--accent)', fontSize: '13px', marginBottom: '16px' }}>{info}</p>}
        <Field label="รหัส OTP">
          <OtpInput value={otp} onChange={setOtp} onKeyDown={onKeyDown} />
        </Field>
        <button onClick={verifyOtp} style={{ ...btnPrimary, marginTop: '8px' }} disabled={loading}>
          {loading ? 'กำลังยืนยัน...' : 'ยืนยันและสมัครสมาชิก'}
        </button>
        <p style={{ textAlign: 'center', marginTop: '14px', fontSize: '12px', color: 'var(--text-muted)' }}>
          {resendIn > 0 ? `ขอรหัสใหม่ได้ใน ${resendIn} วินาที` : (
            <span onClick={resendOtp} style={{ color: '#a29bfe', cursor: 'pointer' }}>ส่งรหัส OTP อีกครั้ง</span>
          )}
        </p>
        <p style={{ textAlign: 'center', marginTop: '10px', fontSize: '12px', color: 'var(--text-faint)' }}>
          <span onClick={() => { setStep('form'); setOtp(''); setError('') }} style={{ cursor: 'pointer' }}>← แก้ไขข้อมูลสมัคร</span>
        </p>
      </div></div>
    )
  }

  return (
    <div className="auth-wrap"><div className="auth-card">
      <h1 style={{ color: '#fff', fontSize: '20px', marginBottom: '8px' }}>สมัครสมาชิก</h1>
      <p style={{ color: '#555', fontSize: '13px', marginBottom: '20px' }}>ใช้อีเมลจริง — เราจะส่งรหัส OTP เพื่อยืนยันก่อนเปิดบัญชี</p>
      {error && <p style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
      {info && <p style={{ color: '#55efc4', fontSize: '13px', marginBottom: '16px' }}>{info}</p>}
      <Field label="ชื่อ"><input type="text" style={inp()} placeholder="ชื่อของคุณ" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} onKeyDown={onKeyDown} /></Field>
      <Field label="Email"><input type="email" style={inp()} placeholder="you@gmail.com" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} onKeyDown={onKeyDown} /></Field>
      <Field label="Password"><input type="password" style={inp()} placeholder="อย่างน้อย 8 ตัว" value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} onKeyDown={onKeyDown} /></Field>
      <Field label="ยืนยัน Password"><input type="password" style={inp({ marginBottom: 0 })} placeholder="พิมพ์อีกครั้ง" value={form.confirm} onChange={(e) => setForm({ ...form, confirm: e.target.value })} onKeyDown={onKeyDown} /></Field>
      <button onClick={sendOtp} style={{ ...btnPrimary, marginTop: '20px' }} disabled={loading}>{loading ? 'กำลังส่ง OTP...' : 'ส่งรหัส OTP ยืนยันอีเมล'}</button>
      <p style={{ textAlign: 'center', marginTop: '16px', fontSize: '12px', color: '#555' }}>
        การสมัครถือว่ายอมรับ <a href="/terms.html" target="_blank" rel="noopener noreferrer" style={{ color: '#a29bfe' }}>ข้อกำหนด</a> และ <a href="/privacy.html" target="_blank" rel="noopener noreferrer" style={{ color: '#a29bfe' }}>นโยบายความเป็นส่วนตัว</a>
      </p>
      <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '13px', color: '#555' }}>มีบัญชีแล้ว? <span onClick={onGoLogin} style={{ color: '#a29bfe', cursor: 'pointer' }}>เข้าสู่ระบบ</span></p>
      {onGoHome && <p style={{ textAlign: 'center', marginTop: '12px', fontSize: '12px', color: '#444' }}><span onClick={onGoHome} style={{ cursor: 'pointer' }}>← กลับหน้าแรก</span></p>}
    </div></div>
  )
}