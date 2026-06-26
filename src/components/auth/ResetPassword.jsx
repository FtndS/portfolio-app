import { useState } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'

export default function ResetPassword({token,onGoLogin,onGoHome}){
  const [password,setPassword]=useState('')
  const [confirm,setConfirm]=useState('')
  const [error,setError]=useState('')
  const [message,setMessage]=useState('')
  const [loading,setLoading]=useState(false)
  const go=async()=>{
    setError('');setMessage('')
    if(!token) return setError('ลิงก์รีเซ็ตไม่ถูกต้อง กรุณาขอใหม่')
    if(password.length<8) return setError('รหัสผ่านต้องมีอย่างน้อย 8 ตัว')
    if(password!==confirm) return setError('รหัสผ่านไม่ตรงกัน')
    setLoading(true)
    try{
      const r=await api.post('/auth/reset-password',{token,password})
      if(r.message){ setMessage(r.message) }
      else setError(r.error||'ตั้งรหัสผ่านไม่สำเร็จ')
    }catch(e){setError('เชื่อมต่อเซิร์verไม่ได้')}
    setLoading(false)
  }
  if(message) return (
    <div className="auth-wrap"><div className="auth-card" style={{textAlign:'center'}}>
      <div style={{fontSize:'48px',marginBottom:'16px'}}>✅</div>
      <p style={{color:'#55efc4',marginBottom:'20px'}}>{message}</p>
      <button onClick={onGoLogin} style={btnPrimary}>ไปหน้า Login</button>
    </div></div>
  )
  return(
    <div className="auth-wrap"><div className="auth-card">
      <h1 style={{color:'#fff',fontSize:'20px',marginBottom:'8px'}}>ตั้งรหัสผ่านใหม่</h1>
      {error&&<p style={{color:'#e74c3c',fontSize:'13px',marginBottom:'16px'}}>{error}</p>}
      <Field label="รหัสผ่านใหม่"><input type="password" style={inp()} placeholder="อย่างน้อย 8 ตัว" value={password} onChange={e=>setPassword(e.target.value)}/></Field>
      <Field label="ยืนยันรหัสผ่าน"><input type="password" style={inp({marginBottom:0})} placeholder="พิมพ์อีกครั้ง" value={confirm} onChange={e=>setConfirm(e.target.value)} onKeyDown={e=>e.key==='Enter'&&go()}/></Field>
      <button onClick={go} style={{...btnPrimary,marginTop:'20px'}} disabled={loading}>{loading?'กำลังบันทึก...':'บันทึกรหัสผ่านใหม่'}</button>
      <p style={{textAlign:'center',marginTop:'16px',fontSize:'13px',color:'#555'}}><span onClick={onGoLogin} style={{color:'#a29bfe',cursor:'pointer'}}>← กลับหน้า Login</span></p>
      {onGoHome&&<p style={{textAlign:'center',marginTop:'12px',fontSize:'12px',color:'#444'}}><span onClick={onGoHome} style={{cursor:'pointer'}}>← กลับหน้าแรก</span></p>}
    </div></div>
  )
}