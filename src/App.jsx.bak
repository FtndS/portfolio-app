import { useState, useEffect, useCallback } from 'react'
import { api } from './lib/api'

const inp = (extra={}) => ({width:'100%',padding:'10px 12px',marginBottom:'12px',background:'#1e1e1e',border:'1px solid #3a3a3a',borderRadius:'8px',color:'#fff',fontSize:'14px',boxSizing:'border-box',...extra})
const btnPrimary = {padding:'10px 20px',background:'#6c5ce7',border:'none',borderRadius:'8px',color:'#fff',fontSize:'14px',cursor:'pointer',width:'100%'}
const btnGhost = {padding:'10px 20px',background:'transparent',border:'1px solid #3a3a3a',borderRadius:'8px',color:'#888',fontSize:'14px',cursor:'pointer',width:'100%'}
const wrap = {minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a'}
const card = {background:'#141414',padding:'36px',borderRadius:'14px',width:'380px',border:'1px solid #2a2a2a'}

// Field with label outside
function Field({label,children}){
  return(
    <div style={{marginBottom:'12px'}}>
      <label style={{display:'block',fontSize:'11px',color:'#666',marginBottom:'5px',letterSpacing:'.05em',textTransform:'uppercase'}}>{label}</label>
      {children}
    </div>
  )
}

// Input with prefix/suffix symbol
function AmountInput({prefix,suffix,placeholder,value,onChange,type='number'}){
  return(
    <div style={{display:'flex',alignItems:'center',background:'#1e1e1e',border:'1px solid #3a3a3a',borderRadius:'8px',overflow:'hidden'}}>
      {prefix&&<span style={{padding:'0 10px',color:'#666',fontSize:'14px',flexShrink:0,borderRight:'1px solid #2a2a2a',lineHeight:'40px'}}>{prefix}</span>}
      <input type={type} placeholder={placeholder||'0.00'} value={value} onChange={onChange}
        style={{flex:1,padding:'10px 12px',background:'transparent',border:'none',color:'#fff',fontSize:'14px',outline:'none',width:'100%'}}/>
      {suffix&&<span style={{padding:'0 10px',color:'#666',fontSize:'14px',flexShrink:0,borderLeft:'1px solid #2a2a2a',lineHeight:'40px'}}>{suffix}</span>}
    </div>
  )
}

function Login({onLogin,onGoRegister}){
  const [form,setForm]=useState({email:'',password:''})
  const [error,setError]=useState('')
  const go=async()=>{
    const r=await api.post('/auth/login',form)
    if(r.token){localStorage.setItem('token',r.token);localStorage.setItem('user',JSON.stringify(r.user));onLogin(r.user)}
    else setError('Email หรือ Password ไม่ถูกต้อง')
  }
  return(
    <div style={wrap}><div style={card}>
      <div style={{marginBottom:'28px'}}>
        <h1 style={{color:'#fff',fontSize:'22px',fontWeight:600,marginBottom:'6px'}}>📓 Port Diary</h1>
        <p style={{color:'#555',fontSize:'13px'}}>บันทึกพอร์ตการลงทุน</p>
      </div>
      {error&&<p style={{color:'#e74c3c',fontSize:'13px',marginBottom:'16px'}}>{error}</p>}
      <Field label="Email"><input type="email" style={inp()} placeholder="you@email.com" onChange={e=>setForm({...form,email:e.target.value})}/></Field>
      <Field label="Password"><input type="password" style={inp({marginBottom:0})} placeholder="••••••••" onChange={e=>setForm({...form,password:e.target.value})}/></Field>
      <button onClick={go} style={{...btnPrimary,marginTop:'20px'}}>เข้าสู่ระบบ</button>
      <p style={{textAlign:'center',marginTop:'16px',fontSize:'13px',color:'#555'}}>ยังไม่มีบัญชี? <span onClick={onGoRegister} style={{color:'#a29bfe',cursor:'pointer'}}>สมัครสมาชิก</span></p>
    </div></div>
  )
}

function Register({onGoLogin}){
  const [form,setForm]=useState({name:'',email:'',password:'',confirm:''})
  const [error,setError]=useState('')
  const [ok,setOk]=useState(false)
  const go=async()=>{
    if(!form.name||!form.email||!form.password) return setError('กรุณากรอกข้อมูลให้ครบ')
    if(form.password!==form.confirm) return setError('Password ไม่ตรงกัน')
    if(form.password.length<8) return setError('Password ต้องมีอย่างน้อย 8 ตัว')
    const r=await api.post('/auth/register',{name:form.name,email:form.email,password:form.password})
    if(r.user) setOk(true); else setError(r.error||'สมัครไม่สำเร็จ')
  }
  if(ok) return <div style={wrap}><div style={{...card,textAlign:'center'}}><div style={{fontSize:'48px',marginBottom:'16px'}}>🎉</div><h2 style={{color:'#fff',marginBottom:'8px'}}>สมัครสำเร็จ!</h2><button onClick={onGoLogin} style={btnPrimary}>ไปหน้า Login</button></div></div>
  return(
    <div style={wrap}><div style={card}>
      <h1 style={{color:'#fff',fontSize:'20px',marginBottom:'24px'}}>สมัครสมาชิก</h1>
      {error&&<p style={{color:'#e74c3c',fontSize:'13px',marginBottom:'16px'}}>{error}</p>}
      <Field label="ชื่อ"><input type="text" style={inp()} placeholder="ชื่อของคุณ" onChange={e=>setForm({...form,name:e.target.value})}/></Field>
      <Field label="Email"><input type="email" style={inp()} placeholder="you@email.com" onChange={e=>setForm({...form,email:e.target.value})}/></Field>
      <Field label="Password"><input type="password" style={inp()} placeholder="อย่างน้อย 8 ตัว" onChange={e=>setForm({...form,password:e.target.value})}/></Field>
      <Field label="ยืนยัน Password"><input type="password" style={inp({marginBottom:0})} placeholder="พิมพ์อีกครั้ง" onChange={e=>setForm({...form,confirm:e.target.value})}/></Field>
      <button onClick={go} style={{...btnPrimary,marginTop:'20px'}}>สมัครสมาชิก</button>
      <p style={{textAlign:'center',marginTop:'16px',fontSize:'13px',color:'#555'}}>มีบัญชีแล้ว? <span onClick={onGoLogin} style={{color:'#a29bfe',cursor:'pointer'}}>เข้าสู่ระบบ</span></p>
    </div></div>
  )
}

function DonutChart({holdings,prices,displayCurrency,fxRate}){
  const getVal=h=>{
    const p=prices[h.ticker]||Number(h.avg_cost)
    const v=Number(h.shares)*p
    if(displayCurrency==='THB') return h.currency==='THB'?v:v*fxRate
    return h.currency==='THB'?v/fxRate:v
  }
  const total=holdings.reduce((s,h)=>s+getVal(h),0)
  if(!holdings.length||total===0) return null
  const colors=['#6c5ce7','#00b894','#e17055','#0984e3','#fdcb6e','#e84393','#55efc4','#fd79a8','#a29bfe','#74b9ff']
  const sorted=[...holdings].sort((a,b)=>getVal(b)-getVal(a))
  const CX=100,CY=100,R=80,ri=48
  let angle=-Math.PI/2
  const MIN_ANGLE=0.15 // minimum slice angle so tiny holdings are visible
  const slices=sorted.map((h,i)=>{
    const val=getVal(h)
    const rawPct=val/total
    const sweep=Math.max(rawPct*2*Math.PI, MIN_ANGLE)
    const x1=CX+R*Math.cos(angle),y1=CY+R*Math.sin(angle)
    angle+=sweep
    const x2=CX+R*Math.cos(angle),y2=CY+R*Math.sin(angle)
    const ix1=CX+ri*Math.cos(angle-sweep),iy1=CY+ri*Math.sin(angle-sweep)
    const ix2=CX+ri*Math.cos(angle),iy2=CY+ri*Math.sin(angle)
    const large=sweep>Math.PI?1:0
    const d=`M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${ri} ${ri} 0 ${large} 0 ${ix1} ${iy1} Z`
    return{...h,d,color:colors[i%colors.length],pct:(rawPct*100).toFixed(1)}
  })
  return(
    <div style={{display:'flex',gap:'24px',alignItems:'center',background:'#141414',border:'1px solid #2a2a2a',borderRadius:'12px',padding:'20px',marginBottom:'16px'}}>
      <svg viewBox="0 0 200 200" style={{width:'160px',flexShrink:0}}>
        {slices.map((s,i)=><path key={i} d={s.d} fill={s.color} stroke="#0a0a0a" strokeWidth="2"/>)}
        <text x={CX} y={CY-6} textAnchor="middle" fontSize="10" fill="#555" fontFamily="sans-serif">พอร์ตทั้งหมด</text>
        <text x={CX} y={CY+10} textAnchor="middle" fontSize="13" fontWeight="600" fill="#fff" fontFamily="sans-serif">{holdings.length} หลักทรัพย์</text>
      </svg>
      <div style={{flex:1,display:'flex',flexDirection:'column',gap:'10px'}}>
        {slices.map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'10px',height:'10px',borderRadius:'3px',background:s.color,flexShrink:0}}/>
            <span style={{fontSize:'13px',fontWeight:'500',minWidth:'55px',color:'#fff'}}>{s.ticker}</span>
            <div style={{flex:1,height:'4px',background:'#252525',borderRadius:'999px',overflow:'hidden'}}>
              <div style={{width:`${s.pct}%`,height:'100%',background:s.color,borderRadius:'999px'}}/>
            </div>
            <span style={{fontSize:'12px',color:'#666',minWidth:'42px',textAlign:'right'}}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function Treemap({holdings,prices,displayCurrency,fxRate}){
  const getVal=h=>{
    const p=prices[h.ticker]||Number(h.avg_cost)
    const v=Number(h.shares)*p
    if(displayCurrency==='THB') return h.currency==='THB'?v:v*fxRate
    return h.currency==='THB'?v/fxRate:v
  }
  const rawTotal=holdings.reduce((s,h)=>s+getVal(h),0)
  if(!holdings.length||rawTotal===0) return null
  const W=660,H=260
  const getColor=chg=>{
    if(chg<=-3)return'#c0392b';if(chg<=-1)return'#e74c3c';if(chg<0)return'#f1948a'
    if(chg===0)return'#2a2a2a';if(chg<1)return'#a9dfbf';if(chg<3)return'#27ae60';return'#1e8449'
  }
  // Give each holding a minimum 3% of display area so tiny ones are visible
  const MIN_PCT=0.03
  const sorted=[...holdings].sort((a,b)=>getVal(b)-getVal(a))
  const rawPcts=sorted.map(h=>getVal(h)/rawTotal)
  const needsBoost=rawPcts.map(p=>p<MIN_PCT)
  const boostTotal=needsBoost.reduce((s,b,i)=>b?s+(MIN_PCT-rawPcts[i]):s,0)
  const bigCount=needsBoost.filter(b=>!b).length
  const adjPcts=rawPcts.map((p,i)=>needsBoost[i]?MIN_PCT:p-boostTotal/bigCount)
  const items=sorted.map((h,i)=>({...h,adjPct:adjPcts[i],chg:prices[`${h.ticker}_chg`]||0}))

  // Simple row-based layout
  const rects=[]
  let remaining=[...items]
  let rx=0,ry=0,rw=W,rh=H
  while(remaining.length>0){
    const isH=rw>=rh
    const areaTotal=remaining.reduce((s,i)=>s+i.adjPct,0)
    const rowSize=isH?rh:rw
    let best=Infinity,cut=0,run=0
    for(let i=0;i<remaining.length;i++){
      run+=remaining[i].adjPct
      const len=(run/areaTotal)*(isH?rw:rh)
      let maxR=0,rt=0
      for(let j=0;j<=i;j++){rt+=remaining[j].adjPct;const l=(remaining[j].adjPct/run)*rowSize;const ratio=Math.max(l/len,len/l);if(ratio>maxR)maxR=ratio}
      if(maxR<best){best=maxR;cut=i+1}else break
    }
    const row=remaining.slice(0,cut);remaining=remaining.slice(cut)
    const rowSum=row.reduce((s,i)=>s+i.adjPct,0)
    const rowLen=(rowSum/areaTotal)*(isH?rw:rh)
    let pos=isH?ry:rx
    row.forEach(item=>{
      const len=(item.adjPct/rowSum)*rowSize
      if(isH){rects.push({...item,x:rx,y:pos,w:rowLen,h:len});pos+=len}
      else{rects.push({...item,x:pos,y:ry,w:len,h:rowLen});pos+=len}
    })
    if(isH){rx+=rowLen;rw-=rowLen}else{ry+=rowLen;rh-=rowLen}
  }
  return(
    <div style={{marginBottom:'16px'}}>
      <p style={{color:'#444',fontSize:'12px',marginBottom:'8px'}}>ขนาด = มูลค่า · สี = % เปลี่ยนแปลงวันนี้</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',borderRadius:'10px',display:'block'}}>
        {rects.map((r,i)=>(
          <g key={i}>
            <rect x={r.x+1} y={r.y+1} width={r.w-2} height={r.h-2} rx={5} fill={getColor(r.chg)}/>
            {r.w>35&&r.h>22&&<>
              <text x={r.x+r.w/2} y={r.y+r.h/2-(r.h>50?8:0)} textAnchor="middle" fontSize={Math.min(r.w/6,r.h/3,16)} fontWeight="600" fill="#fff" fontFamily="sans-serif" dominantBaseline="middle">{r.ticker}</text>
              {r.h>50&&<text x={r.x+r.w/2} y={r.y+r.h/2+14} textAnchor="middle" fontSize={10} fill="rgba(255,255,255,0.7)" fontFamily="sans-serif">{r.chg>=0?'+':''}{r.chg.toFixed(2)}%</text>}
            </>}
          </g>
        ))}
      </svg>
    </div>
  )
}

function Modal({title,onClose,children}){
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.8)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:100}}>
      <div style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'14px',padding:'28px',width:'440px',maxHeight:'92vh',overflowY:'auto'}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <h2 style={{color:'#fff',fontSize:'16px',fontWeight:600}}>{title}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:'22px',lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}

const sectors=['Technology','Finance','Healthcare','Energy','Consumer','Real Estate','Bonds & Gold','Diversified','Other']

function HoldingModal({holding,onClose,onSave}){
  const [f,setF]=useState({ticker:holding?.ticker||'',name:holding?.name||'',shares:holding?.shares||'',avg_cost:holding?.avg_cost||'',sector:holding?.sector||'',currency:holding?.currency||'USD'})
  const [loading,setLoading]=useState(false)
  const isEdit=!!holding
  const save=async()=>{
    if(!f.ticker||!f.shares||!f.avg_cost) return
    setLoading(true)
    const b={ticker:f.ticker.toUpperCase(),name:f.name,shares:parseFloat(f.shares),avg_cost:parseFloat(f.avg_cost),sector:f.sector,currency:f.currency}
    const r=isEdit?await api.put(`/holdings/${holding.id}`,b):await api.post('/holdings',b)
    setLoading(false)
    if(r.id){onSave();onClose()}
  }
  const sym=f.currency==='THB'?'฿':'$'
  return(
    <Modal title={isEdit?'แก้ไข Holding':'เพิ่ม Holding'} onClose={onClose}>
      <Field label="Ticker"><input style={inp()} placeholder="เช่น AAPL, PTT" value={f.ticker} onChange={e=>setF({...f,ticker:e.target.value})}/></Field>
      <Field label="ชื่อเต็ม (optional)"><input style={inp()} placeholder="เช่น Apple Inc." value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field>
      <Field label="สกุลเงิน">
        <div style={{display:'flex',gap:'8px'}}>
          {['USD','THB'].map(c=><button key={c} onClick={()=>setF({...f,currency:c})} style={{flex:1,padding:'9px',border:`1px solid ${f.currency===c?'#6c5ce7':'#3a3a3a'}`,borderRadius:'8px',background:f.currency===c?'#2d2a5e':'transparent',color:f.currency===c?'#a29bfe':'#666',cursor:'pointer',fontSize:'13px',fontWeight:500}}>{c==='USD'?'$ USD':'฿ THB'}</button>)}
        </div>
      </Field>
      <Field label="จำนวนหุ้น"><AmountInput suffix="shares" placeholder="100" value={f.shares} onChange={e=>setF({...f,shares:e.target.value})}/></Field>
      <Field label={`ราคาทุนเฉลี่ย (${f.currency})`}><AmountInput prefix={sym} placeholder="0.00" value={f.avg_cost} onChange={e=>setF({...f,avg_cost:e.target.value})}/></Field>
      <Field label="Sector">
        <select style={inp({marginBottom:0})} value={f.sector} onChange={e=>setF({...f,sector:e.target.value})}>
          <option value="">-- เลือก Sector --</option>
          {sectors.map(s=><option key={s} value={s}>{s}</option>)}
        </select>
      </Field>
      <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
        <button onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':isEdit?'บันทึกการแก้ไข':'บันทึก'}</button>
      </div>
    </Modal>
  )
}

const journalTags=['บันทึกความคิด','rebalance','ซื้อ','ขาย','วิเคราะห์','ข่าว','อื่นๆ']

function JournalModal({entry,onClose,onSave}){
  const today=new Date().toISOString().split('T')[0]
  const [f,setF]=useState({title:entry?.title||'',content:entry?.content||'',tickers:entry?.tickers||'',tag:entry?.tag||'',date:entry?.date?.split('T')[0]||today})
  const [loading,setLoading]=useState(false)
  const isEdit=!!entry
  const save=async()=>{
    if(!f.content) return
    setLoading(true)
    const r=isEdit?await api.put(`/journal/${entry.id}`,f):await api.post('/journal',f)
    setLoading(false)
    if(r.id){onSave();onClose()}
  }
  return(
    <Modal title={isEdit?'แก้ไข Journal':'เขียน Journal ใหม่'} onClose={onClose}>
      <Field label="หัวข้อ (optional)"><input style={inp()} placeholder="เช่น ทบทวนพอร์ต Q2" value={f.title} onChange={e=>setF({...f,title:e.target.value})}/></Field>
      <Field label="บันทึก *">
        <textarea placeholder="ความคิด การวิเคราะห์ หรือเหตุการณ์..." style={{...inp(),height:'110px',resize:'vertical',fontFamily:'sans-serif',marginBottom:0}} value={f.content} onChange={e=>setF({...f,content:e.target.value})}/>
      </Field>
      <Field label="Tickers ที่เกี่ยวข้อง"><input style={inp()} placeholder="เช่น VOO, AAPL, PTT" value={f.tickers} onChange={e=>setF({...f,tickers:e.target.value})}/></Field>
      <div style={{display:'flex',gap:'8px'}}>
        <div style={{flex:1}}>
          <Field label="Tag">
            <select style={inp({marginBottom:0})} value={f.tag} onChange={e=>setF({...f,tag:e.target.value})}>
              <option value="">-- ไม่มี Tag --</option>
              {journalTags.map(t=><option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div style={{flex:1}}>
          <Field label="วันที่">
            <input type="date" style={inp({marginBottom:0})} value={f.date} onChange={e=>setF({...f,date:e.target.value})}/>
          </Field>
        </div>
      </div>
      <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
        <button onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':'บันทึก'}</button>
      </div>
    </Modal>
  )
}

function TransactionModal({holdings,onClose,onSave}){
  const today=new Date().toISOString().split('T')[0]
  const [f,setF]=useState({ticker:'',type:'BUY',shares:'',price:'',note:'',date:today,holding_id:'',currency:'USD'})
  const [loading,setLoading]=useState(false)
  const selHolding=e=>{
    const h=holdings.find(h=>String(h.id)===e.target.value)
    if(h) setF({...f,holding_id:e.target.value,ticker:h.ticker,currency:h.currency||'USD'})
    else setF({...f,holding_id:''})
  }
  const save=async()=>{
    if(!f.ticker||!f.shares||!f.price||!f.date) return
    setLoading(true)
    const r=await api.post('/transactions',{ticker:f.ticker.toUpperCase(),type:f.type,shares:parseFloat(f.shares),price:parseFloat(f.price),note:f.note,date:f.date,holding_id:f.holding_id||null})
    setLoading(false)
    if(r.id){onSave();onClose()} else alert(r.error||'บันทึกไม่สำเร็จ')
  }
  const sym=f.currency==='THB'?'฿':'$'
  const total=f.shares&&f.price?parseFloat(f.shares)*parseFloat(f.price):0
  return(
    <Modal title="บันทึก Transaction" onClose={onClose}>
      <Field label="เลือก Holding ที่มีอยู่ (optional)">
        <select style={inp()} onChange={selHolding}>
          <option value="">-- หรือพิมพ์ Ticker เองด้านล่าง --</option>
          {holdings.map(h=><option key={h.id} value={h.id}>{h.ticker} — {h.name||h.ticker}</option>)}
        </select>
      </Field>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}}>
        <div style={{flex:1}}>
          <Field label="Ticker">
            <input style={inp({marginBottom:0})} placeholder="เช่น VOO" value={f.ticker} onChange={e=>setF({...f,ticker:e.target.value.toUpperCase()})}/>
          </Field>
        </div>
        <div style={{flex:'none',width:'120px'}}>
          <Field label="ประเภท">
            <div style={{display:'flex',background:'#1e1e1e',border:'1px solid #3a3a3a',borderRadius:'8px',overflow:'hidden',height:'40px'}}>
              {['BUY','SELL'].map(t=><button key={t} onClick={()=>setF({...f,type:t})} style={{flex:1,border:'none',background:f.type===t?(t==='BUY'?'#1a3a2a':'#3a1a1a'):'transparent',color:f.type===t?(t==='BUY'?'#55efc4':'#ff7675'):'#555',cursor:'pointer',fontSize:'12px',fontWeight:600}}>{t==='BUY'?'🟢 BUY':'🔴 SELL'}</button>)}
            </div>
          </Field>
        </div>
      </div>
      <Field label="สกุลเงิน">
        <div style={{display:'flex',gap:'8px'}}>
          {['USD','THB'].map(c=><button key={c} onClick={()=>setF({...f,currency:c})} style={{flex:1,padding:'8px',border:`1px solid ${f.currency===c?'#6c5ce7':'#3a3a3a'}`,borderRadius:'8px',background:f.currency===c?'#2d2a5e':'transparent',color:f.currency===c?'#a29bfe':'#666',cursor:'pointer',fontSize:'13px',fontWeight:500}}>{c==='USD'?'$ USD':'฿ THB'}</button>)}
        </div>
      </Field>
      <div style={{display:'flex',gap:'8px'}}>
        <div style={{flex:1}}><Field label="จำนวนหุ้น"><AmountInput suffix="shares" placeholder="100" value={f.shares} onChange={e=>setF({...f,shares:e.target.value})}/></Field></div>
        <div style={{flex:1}}><Field label={`ราคา/หุ้น (${f.currency})`}><AmountInput prefix={sym} placeholder="0.00" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></Field></div>
      </div>
      {total>0&&<div style={{background:'#1a2a1a',border:'1px solid #2a4a2a',borderRadius:'8px',padding:'10px 14px',marginBottom:'12px'}}>
        <span style={{fontSize:'12px',color:'#55efc4'}}>มูลค่ารวม: </span>
        <span style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{sym}{total.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
      </div>}
      <Field label="วันที่"><input type="date" style={inp()} value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
      <Field label="หมายเหตุ (optional)"><input style={inp({marginBottom:0})} placeholder="เช่น DCA รายเดือน" value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></Field>
      <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
        <button onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':'บันทึก'}</button>
      </div>
    </Modal>
  )
}

function Dashboard({user,onLogout}){
  const [holdings,setHoldings]=useState([])
  const [journal,setJournal]=useState([])
  const [transactions,setTransactions]=useState([])
  const [prices,setPrices]=useState({})
  const [tab,setTab]=useState('overview')
  const [modal,setModal]=useState(null)
  const [editH,setEditH]=useState(null)
  const [editJ,setEditJ]=useState(null)
  const [loadingP,setLoadingP]=useState(false)
  const [displayCurrency,setDisplayCurrency]=useState('USD')
  const [journalFilter,setJournalFilter]=useState('')

  const fxRate=prices['USDTHB=X']||35

  const fetchAll=useCallback(async()=>{
    const [h,j,t]=await Promise.all([api.get('/holdings'),api.get('/journal'),api.get('/transactions')])
    const hl=Array.isArray(h)?h:[]
    setHoldings(hl);setJournal(Array.isArray(j)?j:[]);setTransactions(Array.isArray(t)?t:[])
    return hl
  },[])

  const fetchPrices=useCallback(async(hl)=>{
    if(!hl?.length) return
    setLoadingP(true)
    try{const r=await fetch(`/api/prices?tickers=${hl.map(h=>h.ticker).join(',')}`);setPrices(await r.json())}catch(e){}
    setLoadingP(false)
  },[])

  useEffect(()=>{fetchAll().then(fetchPrices)},[])

  const delH=async id=>{if(!confirm('ลบ holding นี้?'))return;await api.delete(`/holdings/${id}`);fetchAll().then(fetchPrices)}
  const delJ=async id=>{if(!confirm('ลบ journal entry?'))return;await api.delete(`/journal/${id}`);fetchAll()}
  const delT=async id=>{if(!confirm('ลบ transaction นี้?'))return;await api.delete(`/transactions/${id}`);fetchAll().then(fetchPrices)}

  const getVal=useCallback(h=>{
    const p=prices[h.ticker]||Number(h.avg_cost),v=Number(h.shares)*p
    return displayCurrency==='THB'?(h.currency==='THB'?v:v*fxRate):(h.currency==='THB'?v/fxRate:v)
  },[prices,displayCurrency,fxRate])

  const getCost=useCallback(h=>{
    const v=Number(h.shares)*Number(h.avg_cost)
    return displayCurrency==='THB'?(h.currency==='THB'?v:v*fxRate):(h.currency==='THB'?v/fxRate:v)
  },[displayCurrency,fxRate])

  const totVal=holdings.reduce((s,h)=>s+getVal(h),0)
  const totCost=holdings.reduce((s,h)=>s+getCost(h),0)
  const totPnL=totVal-totCost
  const totPct=totCost>0?(totPnL/totCost)*100:0

  const sym=displayCurrency==='THB'?'฿':'$'
  const fmt=n=>sym+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
  const aBtn=(label,onClick,color)=><button onClick={onClick} style={{padding:'4px 10px',fontSize:'12px',border:`1px solid ${color}`,borderRadius:'6px',background:'transparent',color,cursor:'pointer',marginLeft:'6px'}}>{label}</button>

  const filteredJournal=journalFilter?journal.filter(j=>j.tag===journalFilter):journal

  return(
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff',fontFamily:'system-ui,sans-serif'}}>
      <div style={{maxWidth:'1060px',margin:'0 auto',padding:'24px'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'28px'}}>
          <div>
            <h1 style={{fontSize:'17px',fontWeight:600,marginBottom:'2px'}}>📓 Port Diary</h1>
            <p style={{color:'#444',fontSize:'13px'}}>สวัสดี, {user.name}</p>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <div style={{display:'flex',background:'#141414',border:'1px solid #2a2a2a',borderRadius:'8px',overflow:'hidden'}}>
              {['USD','THB'].map(c=><button key={c} onClick={()=>setDisplayCurrency(c)} style={{padding:'7px 16px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:500,background:displayCurrency===c?'#6c5ce7':'transparent',color:displayCurrency===c?'#fff':'#555'}}>{c==='USD'?'$ USD':'฿ THB'}</button>)}
            </div>
            <button onClick={onLogout} style={{...btnGhost,width:'auto',padding:'7px 14px',fontSize:'13px'}}>ออก</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:'6px',marginBottom:'24px',flexWrap:'wrap'}}>
          {[['overview','Overview'],['holdings','Holdings'],['transactions','Transactions'],['journal','Journal']].map(([k,l])=>(
            <button key={k} onClick={()=>setTab(k)} style={{padding:'7px 18px',borderRadius:'8px',border:'1px solid #2a2a2a',background:tab===k?'#6c5ce7':'transparent',color:tab===k?'#fff':'#555',cursor:'pointer',fontSize:'13px',fontWeight:tab===k?500:400}}>{l}</button>
          ))}
        </div>

        {/* Overview */}
        {tab==='overview'&&<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'12px',marginBottom:'20px'}}>
            {[
              ['มูลค่าพอร์ตรวม',fmt(totVal),`${holdings.length} holdings`,null],
              ['กำไร/ขาดทุน',fmt(totPnL),`${totPct>=0?'+':''}${totPct.toFixed(2)}% จากทุน`,totPnL>=0?'#27ae60':'#e74c3c'],
              ['USD/THB',loadingP?'กำลังโหลด...':`$1 = ฿${fxRate.toFixed(2)}`,'Real-time','#a29bfe']
            ].map(([label,val,sub,color],i)=>(
              <div key={i} style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'16px 18px'}}>
                <div style={{color:'#555',fontSize:'12px',marginBottom:'6px'}}>{label}</div>
                <div style={{color:color||'#fff',fontSize:'20px',fontWeight:500}}>{val}</div>
                <div style={{color:'#444',fontSize:'12px',marginTop:'3px'}}>{sub}</div>
              </div>
            ))}
          </div>
          {holdings.length>0&&<>
            <DonutChart holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate}/>
            <Treemap holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate}/>
          </>}
          {holdings.length===0&&<div style={{textAlign:'center',padding:'60px',color:'#444'}}>
            <p style={{fontSize:'36px',marginBottom:'12px'}}>📊</p>
            <p style={{fontSize:'14px',marginBottom:'20px'}}>เริ่มบันทึก Transaction แรกเพื่อสร้าง portfolio</p>
            <button onClick={()=>{setTab('transactions');setModal('tx')}} style={{...btnPrimary,width:'auto',padding:'10px 24px'}}>+ บันทึก Transaction แรก</button>
          </div>}
        </>}

        {/* Holdings */}
        {tab==='holdings'&&<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <p style={{color:'#444',fontSize:'13px'}}>{holdings.length} holdings · อัปเดตจาก Transactions อัตโนมัติ</p>
            <button onClick={()=>setModal('h')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ เพิ่ม Holding ตรงๆ</button>
          </div>
          <div style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'10px',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',minWidth:'820px'}}>
              <thead><tr style={{borderBottom:'1px solid #2a2a2a'}}>
                {['Ticker','ชื่อ','Shares','สกุลเงิน','Avg Cost','ราคาปัจจุบัน',`มูลค่า (${displayCurrency})`,`กำไร/ขาดทุน (${displayCurrency})`,''].map((h,i)=>(
                  <th key={i} style={{padding:'11px 13px',textAlign:'left',color:'#444',fontWeight:400,whiteSpace:'nowrap'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {holdings.length===0?<tr><td colSpan={9} style={{padding:'28px',textAlign:'center',color:'#333'}}>ยังไม่มี holdings</td></tr>
                :holdings.map(h=>{
                  const cur=prices[h.ticker]||Number(h.avg_cost)
                  const val=getVal(h),cost=getCost(h),pnl=val-cost,pct=cost>0?(pnl/cost)*100:0
                  const os=h.currency==='THB'?'฿':'$'
                  return(<tr key={h.id} style={{borderBottom:'1px solid #1a1a1a'}}>
                    <td style={{padding:'11px 13px',fontWeight:600}}>{h.ticker}</td>
                    <td style={{padding:'11px 13px',color:'#666'}}>{h.name||'—'}</td>
                    <td style={{padding:'11px 13px'}}>{Number(h.shares).toLocaleString('en-US',{maximumFractionDigits:4})}</td>
                    <td style={{padding:'11px 13px'}}><span style={{fontSize:'11px',padding:'2px 8px',borderRadius:'999px',background:h.currency==='USD'?'#1a2a4a':'#1a3a2a',color:h.currency==='USD'?'#74b9ff':'#55efc4'}}>{h.currency}</span></td>
                    <td style={{padding:'11px 13px',color:'#666'}}>{os}{Number(h.avg_cost).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td style={{padding:'11px 13px'}}>{os}{Number(cur).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td style={{padding:'11px 13px'}}>{fmt(val)}</td>
                    <td style={{padding:'11px 13px',color:pnl>=0?'#27ae60':'#e74c3c'}}>{fmt(pnl)}<span style={{fontSize:'11px',marginLeft:'4px'}}>({pct>=0?'+':''}{pct.toFixed(2)}%)</span></td>
                    <td style={{padding:'11px 13px',whiteSpace:'nowrap'}}>
                      {aBtn('แก้ไข',()=>{setEditH(h);setModal('eh')},'#a29bfe')}
                      {aBtn('ลบ',()=>delH(h.id),'#e74c3c')}
                    </td>
                  </tr>)
                })}
              </tbody>
            </table>
          </div>
        </>}

        {/* Transactions */}
        {tab==='transactions'&&<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px'}}>
            <p style={{color:'#444',fontSize:'13px'}}>{transactions.length} transactions · Avg cost คำนวณอัตโนมัติ</p>
            <button onClick={()=>setModal('tx')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ บันทึก Transaction</button>
          </div>
          <div style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'10px',overflowX:'auto'}}>
            <table style={{width:'100%',borderCollapse:'collapse',fontSize:'13px',minWidth:'680px'}}>
              <thead><tr style={{borderBottom:'1px solid #2a2a2a'}}>
                {['วันที่','Ticker','ประเภท','Shares','ราคา/หุ้น','มูลค่ารวม','หมายเหตุ',''].map((h,i)=>(
                  <th key={i} style={{padding:'11px 13px',textAlign:'left',color:'#444',fontWeight:400}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {transactions.length===0?<tr><td colSpan={8} style={{padding:'28px',textAlign:'center',color:'#333'}}>ยังไม่มี transactions</td></tr>
                :transactions.map(t=>(
                  <tr key={t.id} style={{borderBottom:'1px solid #1a1a1a'}}>
                    <td style={{padding:'11px 13px',color:'#555'}}>{t.date?.split('T')[0]||t.date}</td>
                    <td style={{padding:'11px 13px',fontWeight:600}}>{t.ticker}</td>
                    <td style={{padding:'11px 13px'}}><span style={{fontSize:'11px',padding:'2px 9px',borderRadius:'999px',background:t.type==='BUY'?'#1a3a2a':'#3a1a1a',color:t.type==='BUY'?'#55efc4':'#ff7675'}}>{t.type}</span></td>
                    <td style={{padding:'11px 13px'}}>{Number(t.shares).toLocaleString('en-US',{maximumFractionDigits:4})}</td>
                    <td style={{padding:'11px 13px'}}>{Number(t.price).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td style={{padding:'11px 13px',fontWeight:500}}>{Number(t.total).toLocaleString('en-US',{minimumFractionDigits:2})}</td>
                    <td style={{padding:'11px 13px',color:'#555'}}>{t.note||'—'}</td>
                    <td style={{padding:'11px 13px'}}>{aBtn('ลบ',()=>delT(t.id),'#e74c3c')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>}

        {/* Journal */}
        {tab==='journal'&&<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',flexWrap:'wrap',gap:'10px'}}>
            <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
              <p style={{color:'#444',fontSize:'13px'}}>{filteredJournal.length} entries</p>
              <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
                <button onClick={()=>setJournalFilter('')} style={{padding:'4px 10px',fontSize:'12px',borderRadius:'999px',border:'1px solid #2a2a2a',background:journalFilter===''?'#6c5ce7':'transparent',color:journalFilter===''?'#fff':'#555',cursor:'pointer'}}>ทั้งหมด</button>
                {journalTags.map(tag=>(
                  <button key={tag} onClick={()=>setJournalFilter(journalFilter===tag?'':tag)} style={{padding:'4px 10px',fontSize:'12px',borderRadius:'999px',border:`1px solid ${journalFilter===tag?'#6c5ce7':'#2a2a2a'}`,background:journalFilter===tag?'#2d2a5e':'transparent',color:journalFilter===tag?'#a29bfe':'#555',cursor:'pointer'}}>{tag}</button>
                ))}
              </div>
            </div>
            <button onClick={()=>setModal('j')} style={{...btnPrimary,width:'auto',padding:'7px 16px',fontSize:'13px'}}>+ เขียน Journal</button>
          </div>
          {filteredJournal.length===0?<p style={{color:'#333',fontSize:'13px',textAlign:'center',padding:'40px'}}>ไม่มี entry {journalFilter?`ใน tag "${journalFilter}"`:''}</p>
          :filteredJournal.map(j=>(
            <div key={j.id} style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'16px',marginBottom:'10px'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap',alignItems:'center'}}>
                  <span style={{fontSize:'12px',color:'#444'}}>{j.date?.split('T')[0]||j.date}</span>
                  {j.tag&&<span style={{fontSize:'11px',background:'#2d2d5e',color:'#a29bfe',padding:'2px 9px',borderRadius:'999px'}}>{j.tag}</span>}
                  {j.tickers&&j.tickers.split(',').map(t=><span key={t} style={{fontSize:'11px',background:'#1e1e1e',color:'#555',padding:'2px 7px',borderRadius:'5px'}}>{t.trim()}</span>)}
                </div>
                <div style={{flexShrink:0}}>
                  {aBtn('แก้ไข',()=>{setEditJ(j);setModal('ej')},'#a29bfe')}
                  {aBtn('ลบ',()=>delJ(j.id),'#e74c3c')}
                </div>
              </div>
              {j.title&&<p style={{fontWeight:600,marginBottom:'6px',fontSize:'14px'}}>{j.title}</p>}
              <p style={{fontSize:'13px',color:'#bbb',lineHeight:1.8,whiteSpace:'pre-wrap'}}>{j.content}</p>
            </div>
          ))}
        </>}
      </div>

      {modal==='h'&&<HoldingModal onClose={()=>setModal(null)} onSave={()=>fetchAll().then(fetchPrices)}/>}
      {modal==='eh'&&editH&&<HoldingModal holding={editH} onClose={()=>{setModal(null);setEditH(null)}} onSave={()=>fetchAll().then(fetchPrices)}/>}
      {modal==='j'&&<JournalModal onClose={()=>setModal(null)} onSave={fetchAll}/>}
      {modal==='ej'&&editJ&&<JournalModal entry={editJ} onClose={()=>{setModal(null);setEditJ(null)}} onSave={fetchAll}/>}
      {modal==='tx'&&<TransactionModal holdings={holdings} onClose={()=>setModal(null)} onSave={()=>fetchAll().then(fetchPrices)}/>}
    </div>
  )
}

export default function App(){
  const [user,setUser]=useState(()=>{const u=localStorage.getItem('user');return u?JSON.parse(u):null})
  const [page,setPage]=useState('login')
  const logout=()=>{localStorage.removeItem('token');localStorage.removeItem('user');setUser(null);setPage('login')}
  if(user) return <Dashboard user={user} onLogout={logout}/>
  if(page==='register') return <Register onGoLogin={()=>setPage('login')}/>
  return <Login onLogin={setUser} onGoRegister={()=>setPage('register')}/>
}
