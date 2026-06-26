import { useState } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'

export default function Login({onLogin,onGoRegister,onGoForgot,onGoHome}){
  const [form,setForm]=useState({email:'',password:''})
  const [error,setError]=useState('')
  const go=async()=>{
    setError('')
    try{
      const r=await api.post('/auth/login',form)
      if(r.token){localStorage.setItem('token',r.token);localStorage.setItem('user',JSON.stringify(r.user));onLogin(r.user)}
      else setError(r.error||'Email หรือ Password ไม่ถูกต้อง')
    }catch(e){setError('เชื่อมต่อเซิร์verไม่ได้ — ลองใหม่หรือติดต่อ admin')}
  }
  const onKeyDown=e=>{ if(e.key==='Enter') go() }
  return(
    <div className="auth-wrap"><div className="auth-card">
      <div style={{marginBottom:'28px'}}>
        <h1 style={{color:'#fff',fontSize:'22px',fontWeight:600,marginBottom:'6px'}}>📓 Port Diary</h1>
        <p style={{color:'#555',fontSize:'13px'}}>บันทึกพอร์ตการลงทุน</p>
      </div>
      {error&&<p style={{color:'#e74c3c',fontSize:'13px',marginBottom:'16px'}}>{error}</p>}
      <Field label="Email"><input type="email" style={inp()} placeholder="you@email.com" onChange={e=>setForm({...form,email:e.target.value})} onKeyDown={onKeyDown}/></Field>
      <Field label="Password"><input type="password" style={inp({marginBottom:0})} placeholder="••••••••" onChange={e=>setForm({...form,password:e.target.value})} onKeyDown={onKeyDown}/></Field>
      <p style={{textAlign:'right',marginTop:'10px',fontSize:'12px'}}>
        <span onClick={onGoForgot} style={{color:'#a29bfe',cursor:'pointer'}}>ลืมรหัสผ่าน?</span>
      </p>
      <button onClick={go} style={{...btnPrimary,marginTop:'12px'}}>เข้าสู่ระบบ</button>
      <p style={{textAlign:'center',marginTop:'16px',fontSize:'13px',color:'#555'}}>ยังไม่มีบัญชี? <span onClick={onGoRegister} style={{color:'#a29bfe',cursor:'pointer'}}>สมัครสมาชิก</span></p>
      {onGoHome&&<p style={{textAlign:'center',marginTop:'12px',fontSize:'12px',color:'#444'}}><span onClick={onGoHome} style={{cursor:'pointer'}}>← กลับหน้าแรก</span></p>}
    </div></div>
  )
}