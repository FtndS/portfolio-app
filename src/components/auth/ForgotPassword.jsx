import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import OtpInput from '../auth/OtpInput'

export default function ForgotPassword({onGoLogin,onGoHome}){
  const [email,setEmail]=useState('')
  const [otp,setOtp]=useState('')
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [step,setStep]=useState('email')
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  const [resendIn,setResendIn]=useState(0)

  useEffect(()=>{
    if(resendIn<=0) return undefined
    const t=setTimeout(()=>setResendIn(s=>s-1),1000)
    return ()=>clearTimeout(t)
  },[resendIn])

  const sendOtp=async()=>{
    setError('');setMessage('')
    if(!email.trim()) return setError('กรุณาระบุอีเมล')
    setLoading(true)
    try{
      const r=await api.post('/auth/forgot-password',{email:email.trim()})
      if(r.message){
        setMessage(r.message)
        setStep('otp')
        setResendIn(r.retryAfter||60)
      } else setError(r.error||'ส่ง OTP ไม่สำเร็จ')
    }catch(e){setError('เชื่อมต่อเซิร์verไม่ได้')}
    setLoading(false)
  }

  const resendOtp=async()=>{
    if(resendIn>0) return
    setError('')
    setLoading(true)
    try{
      const r=await api.post('/auth/resend-otp',{email:email.trim(),purpose:'reset_password'})
      if(r.message){
        setMessage(r.message)
        setResendIn(r.retryAfter||60)
        if(r.devOtp) setMessage(`${r.message} (dev OTP: ${r.devOtp})`)
      } else setError(r.error||'ส่ง OTP ไม่สำเร็จ')
    }catch(e){setError('เชื่อมต่อเซิร์verไม่ได้')}
    setLoading(false)
  }

  const resetWithOtp=async()=>{
    setError('');setMessage('')
    if(otp.length!==6) return setError('กรุณาใส่รหัส OTP 6 หลัก')
    if(password.length<8) return setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัว')
    if(password!==confirm) return setError('รหัสผ่านไม่ตรงกัน')
    setLoading(true)
    try{
      const r=await api.post('/auth/reset-password',{email:email.trim(),otp,password})
      if(r.message) setStep('done')
      else setError(r.error||'ตั้งรหัสผ่านไม่สำเร็จ')
    }catch(e){setError('เชื่อมต่อเซิร์verไม่ได้')}
    setLoading(false)
  }

  if(step==='done') return (
    <div className="auth-wrap"><div className="auth-card" style={{textAlign:'center'}}>
      <div style={{fontSize:'48px',marginBottom:'16px'}}>✅</div>
      <p style={{color:'#55efc4',marginBottom:'20px'}}>ตั้งรหัสผ่านใหม่สำเร็จ กรุณาเข้าสู่ระบบ</p>
      <button onClick={onGoLogin} style={btnPrimary}>ไปหน้า Login</button>
    </div></div>
  )

  if(step==='otp') return (
    <div className="auth-wrap"><div className="auth-card">
      <h1 style={{color:'#fff',fontSize:'20px',marginBottom:'8px'}}>ตั้งรหัสผ่านใหม่</h1>
      <p style={{color:'#555',fontSize:'13px',marginBottom:'20px'}}>ใส่รหัส OTP ที่ส่งไปที่ <strong style={{color:'#aaa'}}>{email}</strong></p>
      {error&&<p style={{color:'#e74c3c',fontSize:'13px',marginBottom:'16px'}}>{error}</p>}
      {message&&<p style={{color:'#55efc4',fontSize:'13px',marginBottom:'16px'}}>{message}</p>}
      <Field label="รหัส OTP"><OtpInput value={otp} onChange={setOtp} onKeyDown={e=>e.key==='Enter'&&resetWithOtp()}/></Field>
      <Field label="รหัสผ่านใหม่"><input type="password" style={inp()} placeholder="อย่างน้อย 8 ตัว" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
      <Field label="ยืนยันรหัสผ่าน"><input type="password" style={inp({marginBottom:0})} placeholder="พิมพ์อีกครั้ง" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&resetWithOtp()}/></Field>
      <button onClick={resetWithOtp} style={{...btnPrimary,marginTop:'20px'}} disabled={loading}>{loading?'กำลังบันทึก...':'บันทึกรหัสผ่านใหม่'}</button>
      <p style={{textAlign:'center',marginTop:'14px',fontSize:'12px',color:'#555'}}>
        {resendIn>0?`ขอรหัสใหม่ได้ใน ${resendIn} วินาที`:<span onClick={resendOtp} style={{color:'#a29bfe',cursor:'pointer'}}>ส่งรหัส OTP อีกครั้ง</span>}
      </p>
      <p style={{textAlign:'center',marginTop:'10px',fontSize:'13px',color:'#555'}}><span onClick={()=>{setStep('email');setOtp('');setPassword('');setConfirm('')}} style={{color:'#a29bfe',cursor:'pointer'}}>← เปลี่ยนอีเมล</span></p>
    </div></div>
  )

  return(
    <div className="auth-wrap"><div className="auth-card">
      <h1 style={{color:'#fff',fontSize:'20px',marginBottom:'8px'}}>ลืมรหัสผ่าน</h1>
      <p style={{color:'#555',fontSize:'13px',marginBottom:'20px'}}>ใส่อีเมลที่ใช้สมัคร เราจะส่งรหัส OTP 6 หลักไปให้</p>
      {error&&<p style={{color:'#e74c3c',fontSize:'13px',marginBottom:'16px'}}>{error}</p>}
      {message&&<p style={{color:'#55efc4',fontSize:'13px',marginBottom:'16px'}}>{message}</p>}
      <Field label="Email"><input type="email" style={inp({marginBottom:0})} placeholder="you@gmail.com" value={email} onChange={e=>setEmail(e.target.value)} onKeyDown={e=>e.key==='Enter'&&sendOtp()}/></Field>
      <button onClick={sendOtp} style={{...btnPrimary,marginTop:'20px'}} disabled={loading}>{loading?'กำลังส่ง...':'ส่งรหัส OTP'}</button>
      <p style={{textAlign:'center',marginTop:'16px',fontSize:'13px',color:'#555'}}><span onClick={onGoLogin} style={{color:'#a29bfe',cursor:'pointer'}}>← กลับหน้า Login</span></p>
      {onGoHome&&<p style={{textAlign:'center',marginTop:'12px',fontSize:'12px',color:'#444'}}><span onClick={onGoHome} style={{cursor:'pointer'}}>← กลับหน้าแรก</span></p>}
    </div></div>
  )
}