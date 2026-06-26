import { useState, useEffect, useCallback } from 'react'
import { api } from './lib/api'
import Landing from './components/Landing'

const inp = (extra={}) => ({width:'100%',padding:'10px 12px',marginBottom:'12px',background:'#1e1e1e',border:'1px solid #3a3a3a',borderRadius:'8px',color:'#fff',fontSize:'14px',boxSizing:'border-box',...extra})
const btnPrimary = {padding:'10px 20px',background:'#6c5ce7',border:'none',borderRadius:'8px',color:'#fff',fontSize:'14px',cursor:'pointer',width:'100%'}
const btnGhost = {padding:'10px 20px',background:'transparent',border:'1px solid #3a3a3a',borderRadius:'8px',color:'#888',fontSize:'14px',cursor:'pointer',width:'100%'}
const wrap = {minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#0a0a0a'}
const card = {background:'#141414',padding:'36px',borderRadius:'14px',width:'380px',border:'1px solid #2a2a2a'}

const sanitizeTicker = (ticker) => {
  if (!ticker) return ''
  return ticker.trim().toUpperCase().replace(/\s+/g, '-').replace(/\./g, '-')
}

const MARKETS = [
  { id: 'US', label: 'US / Global', currencies: ['USD'] },
  { id: 'SET', label: 'Thailand (SET)', currencies: ['THB'] },
  { id: 'HK', label: 'Hong Kong', currencies: ['HKD'] },
  { id: 'CN', label: 'China (Shanghai)', currencies: ['CNY'] },
  { id: 'SZ', label: 'China (Shenzhen)', currencies: ['CNY'] },
]

const CURRENCY_SYMBOL = { USD: '$', THB: '฿', HKD: 'HK$', CNY: '¥' }
const symFor = (c) => CURRENCY_SYMBOL[c] || '$'

const SECTOR_COLORS = ['#6c5ce7','#00b894','#e17055','#0984e3','#fdcb6e','#e84393','#55efc4','#fd79a8','#a29bfe','#74b9ff']

// ฟังก์ชันช่วยดึง RSS จากหน้าบ้านโดยใช้ Yahoo RSS และแปลง XML แบบง่าย
async function clientFetchRSS(tickerSymbol = null) {
  try {
    const url = tickerSymbol 
      ? `https://feeds.finance.yahoo.com/rss/2.0/headline?s=${tickerSymbol.replace('.', '-')}`
      : `https://finance.yahoo.com/news/rssindex`;
    
    // ดึงข้อมูลผ่าน Proxy เพื่อเลี่ยง CORS
    const res = await fetch(`https://api.allorigins.win/get?url=${encodeURIComponent(url)}`);
    const data = await res.json();
    const xmlText = data.contents;
    
    if (!xmlText) return [];

    // ใช้ DOMParser ของบราว์เซอร์แกะ XML แทน Regex เพื่อความเร็วและป้องกันการค้าง
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "text/xml");
    const items = xmlDoc.getElementsByTagName("item");
    const result = [];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const title = item.getElementsByTagName("title")[0]?.textContent || "";
      const link = item.getElementsByTagName("link")[0]?.textContent || "";
      const pubDate = item.getElementsByTagName("pubDate")[0]?.textContent || "";
      const source = item.getElementsByTagName("source")[0]?.textContent || "Yahoo Finance";

      if (title && link) {
        result.push({
          title: title,
          url: link.trim(),
          publishedAt: pubDate,
          source: { name: source }
        });
      }
    }
    return result;
  } catch (e) {
    console.error('Client RSS Error:', e);
    return [];
  }
}

function NewsCard({ article }) {
  return (
    <a href={article.url} target="_blank" rel="noopener noreferrer" style={{ display: 'block', background: '#141414', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px', marginBottom: '10px', textDecoration: 'none', color: '#fff', transition: 'borderColor 0.2s' }}
       onMouseEnter={e => e.currentTarget.style.borderColor = '#6c5ce7'} onMouseLeave={e => e.currentTarget.style.borderColor = '#2a2a2a'}>
      <div>
        <h4 style={{ fontSize: '13px', fontWeight: 500, margin: '0 0 6px 0', lineHeight: 1.4, color: '#fff' }}>{article.title}</h4>
        <p style={{ fontSize: '11px', color: '#555', margin: 0 }}>{article.source?.name || 'Yahoo Finance'} · {article.publishedAt ? article.publishedAt.replace(' +0000', '') : ''}</p>
      </div>
    </a>
  )
}

function Field({label,children}){
  return(
    <div style={{marginBottom:'12px'}}>
      <label style={{display:'block',fontSize:'11px',color:'#666',marginBottom:'5px',letterSpacing:'.05em',textTransform:'uppercase'}}>{label}</label>
      {children}
    </div>
  )
}

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

function Login({onLogin,onGoRegister,onGoHome}){
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
      {onGoHome&&<p style={{textAlign:'center',marginTop:'12px',fontSize:'12px',color:'#444'}}><span onClick={onGoHome} style={{cursor:'pointer'}}>← กลับหน้าแรก</span></p>}
    </div></div>
  )
}

function Register({onGoLogin,onGoHome}){
  const [form,setForm]=useState({name:'',email:'',password:'',confirm:''})
  const [error,setError]=useState('')
  const [ok,setOk]=useState(false)
  const go=async()=>{
    if(!form.name||!form.email||!form.password) return setError('กรุณากรอกข้อมูลให้ครบ')
    if(form.password!==form.confirm) return setError('Password ไม่ตรงกัน')
    if(form.password.length<8) return setError('Password ต้องมีอย่างน้อย 8 ตัว')
    try{
      const r=await api.post('/auth/register',{name:form.name,email:form.email,password:form.password})
      if(r.user) setOk(true); else setError(r.error||'สมัครไม่สำเร็จ')
    }catch(e){setError('เชื่อมต่อเซิร์verไม่ได้ — ลองใหม่หรือติดต่อ admin')}
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
      {onGoHome&&<p style={{textAlign:'center',marginTop:'12px',fontSize:'12px',color:'#444'}}><span onClick={onGoHome} style={{cursor:'pointer'}}>← กลับหน้าแรก</span></p>}
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
  const isSingleHolding = sorted.length === 1;

  let angle=-Math.PI/2
  const MIN_ANGLE=0.15 
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
        {isSingleHolding ? (
          <circle cx={CX} cy={CY} r={(R + ri) / 2} fill="none" stroke={colors[0]} strokeWidth={R - ri} />
        ) : (
          slices.map((s,i)=><path key={i} d={s.d} fill={s.color} stroke="#0a0a0a" strokeWidth="2"/>)
        )}
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

function Treemap({holdings,prices,displayCurrency,fxRate,heatmapMode='today'}){
  const getVal=h=>{
    const p=prices[h.ticker]||Number(h.avg_cost)
    const v=Number(h.shares)*p
    if(displayCurrency==='THB') return h.currency==='THB'?v:v*fxRate
    if(displayCurrency==='USD') return h.currency==='USD'?v:h.currency==='THB'?v/fxRate:v
    return v
  }
  const getChg=h=>{
    if(heatmapMode==='invested'){
      const cur=prices[h.ticker]||Number(h.avg_cost)
      const cost=Number(h.avg_cost)
      return cost>0?((cur-cost)/cost)*100:0
    }
    return prices[`${h.ticker}_chg`]||0
  }
  const rawTotal=holdings.reduce((s,h)=>s+getVal(h),0)
  if(!holdings.length||rawTotal===0) return null
  const W=660,H=260
  const getColor=chg=>{
    if(chg<=-3)return'#c0392b';if(chg<=-1)return'#e74c3c';if(chg<0)return'#f1948a'
    if(chg===0)return'#2a2a2a';if(chg<1)return'#a9dfbf';if(chg<3)return'#27ae60';return'#1e8449'
  }
  const MIN_PCT=0.03
  const sorted=[...holdings].sort((a,b)=>getVal(b)-getVal(a))
  const rawPcts=sorted.map(h=>getVal(h)/rawTotal)
  const needsBoost=rawPcts.map(p=>p<MIN_PCT)
  const boostTotal=needsBoost.reduce((s,b,i)=>b?s+(MIN_PCT-rawPcts[i]):s,0)
  const bigCount=needsBoost.filter(b=>!b).length
  const adjPcts=rawPcts.map((p,i)=>needsBoost[i]?MIN_PCT:p-boostTotal/bigCount)
  const items=sorted.map((h,i)=>({...h,adjPct:adjPcts[i],chg:getChg(h)}))

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
      <p style={{color:'#444',fontSize:'12px',marginBottom:'8px'}}>
        ขนาด = มูลค่า · สี = {heatmapMode==='today'?'% เปลี่ยนแปลงวันนี้':'% จากราคาทุนเฉลี่ย'}
      </p>
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

function SectorAreaChart({holdings,prices,displayCurrency,fxRate}){
  const getVal=h=>{
    const p=prices[h.ticker]||Number(h.avg_cost)
    const v=Number(h.shares)*p
    if(displayCurrency==='THB') return h.currency==='THB'?v:v*fxRate
    return h.currency==='THB'?v/fxRate:v
  }
  const total=holdings.reduce((s,h)=>s+getVal(h),0)
  if(!holdings.length||total===0) return null
  const sectorMap={}
  holdings.forEach(h=>{
    const s=h.sector||'Other'
    sectorMap[s]=(sectorMap[s]||0)+getVal(h)
  })
  const sectors=Object.entries(sectorMap).map(([name,value])=>({
    name,value,pct:(value/total)*100
  })).sort((a,b)=>b.value-a.value)
  const W=660,H=120
  let x=0
  return(
    <div style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'12px',padding:'20px',marginBottom:'16px'}}>
      <h3 style={{fontSize:'14px',fontWeight:600,color:'#fff',marginBottom:'4px'}}>Sector Allocation</h3>
      <p style={{color:'#444',fontSize:'12px',marginBottom:'14px'}}>สัดส่วน sector ในพอร์ตปัจจุบัน</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',display:'block',borderRadius:'8px'}}>
        {sectors.map((s,i)=>{
          const w=(s.pct/100)*W
          const rect=<rect key={i} x={x} y={0} width={w} height={H} fill={SECTOR_COLORS[i%SECTOR_COLORS.length]}/>
          x+=w
          return rect
        })}
      </svg>
      <div style={{display:'flex',flexWrap:'wrap',gap:'10px',marginTop:'12px'}}>
        {sectors.map((s,i)=>(
          <div key={i} style={{display:'flex',alignItems:'center',gap:'6px',fontSize:'12px'}}>
            <div style={{width:10,height:10,borderRadius:3,background:SECTOR_COLORS[i%SECTOR_COLORS.length]}}/>
            <span style={{color:'#aaa'}}>{s.name}</span>
            <span style={{color:'#666'}}>{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}

function PortfolioChart({history,displayCurrency}){
  if(!history?.length) return(
    <div style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'12px',padding:'20px',marginBottom:'16px',textAlign:'center',color:'#444',fontSize:'13px'}}>
      📈 บันทึก Transaction เพื่อดูกราฟมูลค่าพอร์ต
    </div>
  )
  const W=660,H=200,pad=30
  const vals=history.map(d=>Number(d.total_value))
  const costs=history.map(d=>Number(d.total_cost||0))
  const allVals=[...vals,...costs].filter(v=>v>0)
  const min=allVals.length?Math.min(...allVals)*0.98:0
  const max=allVals.length?Math.max(...allVals)*1.02:1
  const range=max-min||1
  const toPts=(arr)=>arr.map((v,i)=>{
    const x=history.length<2?W/2:pad+(i/(history.length-1))*(W-pad*2)
    const y=H-pad-((Number(v)-min)/range)*(H-pad*2)
    return `${x},${y}`
  }).join(' ')
  const sym=symFor(displayCurrency==='THB'?'THB':'USD')
  const latest=vals[vals.length-1]
  const first=vals[0]
  const chg=first>0?((latest-first)/first)*100:0
  return(
    <div style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'12px',padding:'20px',marginBottom:'16px'}}>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'baseline',marginBottom:'12px'}}>
        <div>
          <h3 style={{fontSize:'14px',fontWeight:600,color:'#fff',marginBottom:'2px'}}>Portfolio Value</h3>
          <p style={{color:'#444',fontSize:'12px'}}>มูลค่าพอร์ตจาก transaction + ราคาย้อนหลัง</p>
        </div>
        <div style={{textAlign:'right'}}>
          <div style={{fontSize:'18px',fontWeight:600,color:'#fff'}}>{sym}{latest.toLocaleString('en-US',{minimumFractionDigits:2})}</div>
          <div style={{fontSize:'12px',color:chg>=0?'#27ae60':'#e74c3c'}}>{chg>=0?'+':''}{chg.toFixed(2)}% ในช่วงที่แสดง</div>
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} style={{width:'100%',display:'block'}}>
        <polyline points={toPts(costs)} fill="none" stroke="#555" strokeWidth="1.5" strokeDasharray="4,4" strokeLinejoin="round"/>
        <polyline points={toPts(vals)} fill="none" stroke="#6c5ce7" strokeWidth="2.5" strokeLinejoin="round"/>
      </svg>
      <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',fontSize:'11px',color:'#555',marginTop:'6px'}}>
        <span>{history[0].date?.split('T')[0]||history[0].date}</span>
        <span style={{display:'flex',gap:'12px'}}>
          <span><span style={{color:'#6c5ce7'}}>—</span> มูลค่า</span>
          <span><span style={{color:'#555'}}>- -</span> ทุน</span>
        </span>
        <span>{history[history.length-1].date?.split('T')[0]||history[history.length-1].date}</span>
      </div>
    </div>
  )
}

function PortfolioManageModal({portfolio,portfolios,onClose,onUpdated,onDeleted}){
  const [name,setName]=useState(portfolio?.name||'')
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const canDelete=portfolios.length>1
  const save=async()=>{
    if(!name.trim()) return setError('กรุณาระบุชื่อพอร์ต')
    setLoading(true);setError('')
    const r=await api.put(`/portfolios/${portfolio.id}`,{name:name.trim()})
    setLoading(false)
    if(r.id){onUpdated();onClose()} else setError(r.error||'บันทึกไม่สำเร็จ')
  }
  const setDefault=async()=>{
    setLoading(true)
    const r=await api.put(`/portfolios/${portfolio.id}/default`,{})
    setLoading(false)
    if(r.id){onUpdated();onClose()} else setError(r.error||'ตั้งค่าไม่สำเร็จ')
  }
  const del=async()=>{
    if(!confirm(`ลบพอร์ต "${portfolio.name}"?\nข้อมูล holdings, transactions, journal ในพอร์ตนี้จะถูกลบด้วย`)) return
    setLoading(true)
    const r=await api.delete(`/portfolios/${portfolio.id}`)
    setLoading(false)
    if(r.message){onDeleted(portfolio.id);onClose()} else setError(r.error||'ลบไม่สำเร็จ')
  }
  return(
    <Modal title="จัดการพอร์ต" onClose={onClose}>
      <div style={{background:'#0f0f0f',border:'1px solid #2a2a2a',borderRadius:'8px',padding:'12px',marginBottom:'16px',fontSize:'13px',color:'#888'}}>
        <div>{portfolio.holding_count||0} holdings · ทุน {symFor(portfolio.currency||'USD')}{Number(portfolio.total_invested||0).toLocaleString('en-US',{minimumFractionDigits:2})}</div>
        {portfolio.is_default&&<div style={{color:'#a29bfe',marginTop:'4px',fontSize:'12px'}}>★ พอร์ตหลัก (Default)</div>}
      </div>
      {error&&<p style={{color:'#e74c3c',fontSize:'13px',marginBottom:'12px'}}>{error}</p>}
      <Field label="ชื่อพอร์ต"><input style={inp()} value={name} onChange={e=>setName(e.target.value)}/></Field>
      <div style={{display:'flex',flexDirection:'column',gap:'8px',marginTop:'16px'}}>
        <button onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':'บันทึกชื่อ'}</button>
        {!portfolio.is_default&&<button onClick={setDefault} style={{...btnGhost,borderColor:'#6c5ce7',color:'#a29bfe'}} disabled={loading}>ตั้งเป็นพอร์ตหลัก</button>}
        {canDelete&&!portfolio.is_default&&<button onClick={del} style={{...btnGhost,borderColor:'#e74c3c',color:'#e74c3c'}} disabled={loading}>ลบพอร์ตนี้</button>}
        {!canDelete&&<p style={{fontSize:'12px',color:'#555',textAlign:'center'}}>ต้องมีอย่างน้อย 1 พอร์ต</p>}
      </div>
    </Modal>
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

function HoldingModal({holding,onClose,onSave,portfolioId}){
  const [f,setF]=useState({
    ticker:holding?.ticker||'',name:holding?.name||'',shares:holding?.shares||'',
    avg_cost:holding?.avg_cost||'',currency:holding?.currency||'USD',market:holding?.market||'US'
  })
  const [loading,setLoading]=useState(false)
  const isEdit=!!holding
  const marketDef=MARKETS.find(m=>m.id===f.market)||MARKETS[0]
  const save=async()=>{
    if(!f.ticker || !f.shares || !f.avg_cost) return
    setLoading(true)
    const cleanTicker = sanitizeTicker(f.ticker)
    const b={ticker:cleanTicker,name:f.name,shares:parseFloat(f.shares),avg_cost:parseFloat(f.avg_cost),
      currency:f.currency,market:f.market,portfolio_id:portfolioId}
    const r=isEdit?await api.put(`/holdings/${holding.id}`,b):await api.post('/holdings',b)
    setLoading(false)
    if(r.id){onSave();onClose()}
  }
  const sym=symFor(f.currency)
  return(
    <Modal title={isEdit?'แก้ไข Holding':'เพิ่ม Holding'} onClose={onClose}>
      <Field label="ตลาด">
        <select style={inp()} value={f.market} onChange={e=>{
          const m=MARKETS.find(x=>x.id===e.target.value)
          setF({...f,market:e.target.value,currency:m?.currencies[0]||'USD'})
        }}>
          {MARKETS.map(m=><option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>
      <Field label="Ticker"><input style={inp()} placeholder={f.market==='SET'?'PTT':'AAPL, 0700'} value={f.ticker} onChange={e=>setF({...f,ticker:e.target.value})} disabled={isEdit}/></Field>
      <Field label="ชื่อเต็ม (optional)"><input style={inp()} placeholder="เช่น Apple Inc." value={f.name} onChange={e=>setF({...f,name:e.target.value})}/></Field>
      <Field label="สกุลเงิน">
        <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
          {marketDef.currencies.map(c=><button key={c} type="button" onClick={()=>setF({...f,currency:c})} style={{flex:1,minWidth:'70px',padding:'9px',border:`1px solid ${f.currency===c?'#6c5ce7':'#3a3a3a'}`,borderRadius:'8px',background:f.currency===c?'#2d2a5e':'transparent',color:f.currency===c?'#a29bfe':'#666',cursor:'pointer',fontSize:'13px',fontWeight:500}}>{symFor(c)} {c}</button>)}
        </div>
      </Field>
      <Field label="จำนวนหุ้น"><AmountInput suffix="shares" placeholder="100" value={f.shares} onChange={e=>setF({...f,shares:e.target.value})}/></Field>
      <Field label={`ราคาทุนเฉลี่ย (${f.currency})`}><AmountInput prefix={sym} placeholder="0.00" value={f.avg_cost} onChange={e=>setF({...f,avg_cost:e.target.value})}/></Field>
      
      <div style={{display:'flex',gap:'10px',marginTop:'20px'}}>
        <button type="button" onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button type="button" onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':isEdit?'บันทึกการแก้ไข':'บันทึก'}</button>
      </div>
    </Modal>
  )
}

const journalTags=['บันทึกความคิด','rebalance','ซื้อ','ขาย','วิเคราะห์','ข่าว','อื่นๆ']

function JournalModal({entry,onClose,onSave,portfolioId}){
  const today=new Date().toISOString().split('T')[0]
  const [f,setF]=useState({title:entry?.title||'',content:entry?.content||'',tickers:entry?.tickers||'',tag:entry?.tag||'',date:entry?.date?.split('T')[0]||today})
  const [loading,setLoading]=useState(false)
  const isEdit=!!entry
  const save=async()=>{
    if(!f.content) return
    setLoading(true)
    const r=isEdit?await api.put(`/journal/${entry.id}`,f):await api.post('/journal',{...f,portfolio_id:portfolioId})
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

function TransactionModal({holdings,onClose,onSave,portfolioId}){
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
    const cleanTicker = sanitizeTicker(f.ticker)
    const r=await api.post('/transactions',{ticker:cleanTicker,type:f.type,shares:parseFloat(f.shares),price:parseFloat(f.price),note:f.note,date:f.date,holding_id:f.holding_id||null,portfolio_id:portfolioId})
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
            <input style={inp({marginBottom:0})} placeholder="เช่น VOO" value={f.ticker} onChange={e=>setF({...f,ticker:e.target.value})}/></Field>
        </div>
        <div style={{flex:'none',width:'120px'}}>
          <Field label="ประเภท">
            <div style={{display:'flex',background:'#1e1e1e',border:'1px solid #3a3a3a',borderRadius:'8px',overflow:'hidden',height:'40px'}}>
              {['BUY','SELL'].map(t=><button key={t} type="button" onClick={()=>setF({...f,type:t})} style={{flex:1,border:'none',background:f.type===t?(t==='BUY'?'#1a3a2a':'#3a1a1a'):'transparent',color:f.type===t?(t==='BUY'?'#55efc4':'#ff7675'):'#555',cursor:'pointer',fontSize:'12px',fontWeight:600}}>{t==='BUY'?'🟢 BUY':'🔴 SELL'}</button>)}
            </div>
          </Field>
        </div>
      </div>
      <Field label="สกุลเงิน">
        <div style={{display:'flex',gap:'8px'}}>
          {['USD','THB'].map(c=><button key={c} type="button" onClick={()=>setF({...f,currency:c})} style={{flex:1,padding:'8px',border:`1px solid ${f.currency===c?'#6c5ce7':'#3a3a3a'}`,borderRadius:'8px',background:f.currency===c?'#2d2a5e':'transparent',color:f.currency===c?'#a29bfe':'#666',cursor:'pointer',fontSize:'13px',fontWeight:500}}>{c==='USD'?'$ USD':'฿ THB'}</button>)}
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
        <button type="button" onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button type="button" onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':'บันทึก'}</button>
      </div>
    </Modal>
  )
}

function AIPanel({ holdings, prices, displayCurrency, fxRate, inSectorNews }) {
  const [analysis, setAnalysis] = useState(null)
  const [newsSummary, setNewsSummary] = useState(null)
  const [loading, setLoading] = useState(false)
  const [loadingNews, setLoadingNews] = useState(false)
  const [error, setError] = useState('')

  const analyze = async () => {
    if (!holdings.length) return
    setLoading(true)
    setError('')
    try {
      const res = await api.post('/ai/analyze', {
        holdings, prices, displayCurrency, fxRate
      })
      if (res.error) setError(res.error)
      else setAnalysis(res)
    } catch (e) {
      setError('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
    setLoading(false)
  }

  const summarizeNews = async () => {
    if (!inSectorNews.length) return
    setLoadingNews(true)
    try {
      const res = await api.post('/ai/news-summary', {
        holdings, news: inSectorNews
      })
      setNewsSummary(res)
    } catch (e) {}
    setLoadingNews(false)
  }

  const scoreColor = (s) => s >= 8 ? '#27ae60' : s >= 6 ? '#f39c12' : '#e74c3c'
  const impactColor = (i) => i === 'positive' ? '#27ae60' : i === 'negative' ? '#e74c3c' : '#f39c12'
  const impactLabel = (i) => i === 'positive' ? '📈 บวก' : i === 'negative' ? '📉 ลบ' : '➡️ กลางๆ'

  return (
    <div style={{ marginTop: '8px' }}>
      {/* AI Portfolio Analysis */}
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>
              🤖 AI วิเคราะห์พอร์ต
            </h3>
            <p style={{ fontSize: '12px', color: '#555' }}>Claude วิเคราะห์ risk, concentration และแนะนำ rebalancing</p>
          </div>
          <button onClick={analyze} disabled={loading || !holdings.length} style={{
            padding: '8px 18px', background: loading ? '#2a2a2a' : '#6c5ce7',
            border: 'none', borderRadius: '8px', color: loading ? '#555' : '#fff',
            fontSize: '13px', cursor: loading ? 'not-allowed' : 'pointer', fontWeight: 500,
            whiteSpace: 'nowrap'
          }}>
            {loading ? '⏳ กำลังวิเคราะห์...' : '✨ วิเคราะห์พอร์ต'}
          </button>
        </div>

        {error && <p style={{ color: '#e74c3c', fontSize: '13px', marginBottom: '12px' }}>{error}</p>}

        {!analysis && !loading && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#444' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>🧠</p>
            <p style={{ fontSize: '13px' }}>กด "วิเคราะห์พอร์ต" เพื่อให้ Claude ช่วยวิเคราะห์</p>
          </div>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
            <p style={{ fontSize: '24px', marginBottom: '8px' }}>⏳</p>
            <p style={{ fontSize: '13px' }}>Claude กำลังวิเคราะห์พอร์ตของคุณ...</p>
          </div>
        )}

        {analysis && (
          <div>
            {/* Score */}
            <div style={{ display: 'flex', gap: '12px', marginBottom: '16px', flexWrap: 'wrap' }}>
              <div style={{ background: '#0f0f0f', border: `1px solid ${scoreColor(analysis.score)}`, borderRadius: '10px', padding: '14px 18px', flex: '0 0 auto' }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '4px' }}>คะแนนพอร์ต</div>
                <div style={{ fontSize: '28px', fontWeight: 700, color: scoreColor(analysis.score) }}>{analysis.score}<span style={{ fontSize: '14px', color: '#555' }}>/10</span></div>
                <div style={{ fontSize: '11px', color: '#666', marginTop: '2px' }}>{analysis.scoreReason}</div>
              </div>
              <div style={{ background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '10px', padding: '14px 18px', flex: 1 }}>
                <div style={{ fontSize: '11px', color: '#555', marginBottom: '6px' }}>สรุปภาพรวม</div>
                <p style={{ fontSize: '13px', color: '#ccc', lineHeight: 1.7 }}>{analysis.summary}</p>
              </div>
            </div>

            {/* Strengths & Risks */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>
              <div style={{ background: '#0f1f0f', border: '1px solid #1a3a1a', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#27ae60', marginBottom: '10px' }}>✅ จุดแข็ง</div>
                {analysis.strengths?.map((s, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid #27ae60' }}>{s}</div>
                ))}
              </div>
              <div style={{ background: '#1f0f0f', border: '1px solid #3a1a1a', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#e74c3c', marginBottom: '10px' }}>⚠️ ความเสี่ยง</div>
                {analysis.risks?.map((r, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#aaa', marginBottom: '6px', paddingLeft: '8px', borderLeft: '2px solid #e74c3c' }}>{r}</div>
                ))}
              </div>
            </div>

            {/* Recommendations */}
            {analysis.recommendations?.length > 0 && (
              <div style={{ marginBottom: '16px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#a29bfe', marginBottom: '10px' }}>💡 คำแนะนำรายหุ้น</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {analysis.recommendations.map((r, i) => {
                    const typeColor = r.type === 'hold' ? '#27ae60' : r.type === 'reduce' ? '#e74c3c' : '#f39c12'
                    const typeLabel = r.type === 'hold' ? '✋ Hold' : r.type === 'reduce' ? '📉 Reduce' : '⚖️ Rebalance'
                    return (
                      <div key={i} style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', background: '#0f0f0f', border: '1px solid #2a2a2a', borderRadius: '8px', padding: '12px' }}>
                        <div style={{ flexShrink: 0 }}>
                          <span style={{ fontWeight: 700, fontSize: '13px' }}>{r.ticker}</span>
                          <span style={{ display: 'block', fontSize: '11px', color: typeColor, marginTop: '2px' }}>{typeLabel}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: '13px', color: '#fff', marginBottom: '3px' }}>{r.action}</p>
                          <p style={{ fontSize: '12px', color: '#666' }}>{r.reason}</p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Rebalance suggestion */}
            {analysis.rebalanceSuggestion && (
              <div style={{ background: '#1a1a2e', border: '1px solid #2d2d5e', borderRadius: '10px', padding: '14px' }}>
                <div style={{ fontSize: '12px', fontWeight: 600, color: '#a29bfe', marginBottom: '8px' }}>🔄 แนะนำ Rebalance</div>
                <p style={{ fontSize: '13px', color: '#bbb', lineHeight: 1.7 }}>{analysis.rebalanceSuggestion}</p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* AI News Summary */}
      <div style={{ background: '#141414', border: '1px solid #2a2a2a', borderRadius: '12px', padding: '20px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div>
            <h3 style={{ fontSize: '15px', fontWeight: 600, color: '#fff', marginBottom: '2px' }}>
              📰 AI สรุปข่าวกระทบพอร์ต
            </h3>
            <p style={{ fontSize: '12px', color: '#555' }}>Claude วิเคราะห์ข่าวล่าสุดและผลกระทบต่อ holdings</p>
          </div>
          <button onClick={summarizeNews} disabled={loadingNews || !inSectorNews.length} style={{
            padding: '8px 18px', background: loadingNews ? '#2a2a2a' : '#00b894',
            border: 'none', borderRadius: '8px', color: loadingNews ? '#555' : '#fff',
            fontSize: '13px', cursor: loadingNews ? 'not-allowed' : 'pointer', fontWeight: 500,
            whiteSpace: 'nowrap'
          }}>
            {loadingNews ? '⏳ กำลังสรุป...' : '📋 สรุปข่าว'}
          </button>
        </div>

        {!newsSummary && !loadingNews && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#444' }}>
            <p style={{ fontSize: '32px', marginBottom: '8px' }}>📰</p>
            <p style={{ fontSize: '13px' }}>กด "สรุปข่าว" เพื่อให้ Claude วิเคราะห์ข่าวที่กระทบพอร์ต</p>
          </div>
        )}

        {loadingNews && (
          <div style={{ textAlign: 'center', padding: '24px', color: '#666' }}>
            <p style={{ fontSize: '13px' }}>Claude กำลังอ่านข่าวและวิเคราะห์ผลกระทบ...</p>
          </div>
        )}

        {newsSummary && (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
              <span style={{ fontSize: '13px', fontWeight: 600, color: impactColor(newsSummary.impact) }}>
                {impactLabel(newsSummary.impact)}
              </span>
              <span style={{ fontSize: '12px', color: '#555' }}>ผลกระทบต่อพอร์ต</span>
            </div>
            <p style={{ fontSize: '13px', color: '#ccc', lineHeight: 1.7, marginBottom: '14px' }}>{newsSummary.summary}</p>
            {newsSummary.highlights?.length > 0 && (
              <div style={{ marginBottom: '12px' }}>
                {newsSummary.highlights.map((h, i) => (
                  <div key={i} style={{ fontSize: '13px', color: '#aaa', padding: '6px 0 6px 12px', borderLeft: '2px solid #a29bfe', marginBottom: '6px' }}>{h}</div>
                ))}
              </div>
            )}
            {newsSummary.watchOut && (
              <div style={{ background: '#1f1a0f', border: '1px solid #3a2a0a', borderRadius: '8px', padding: '12px' }}>
                <span style={{ fontSize: '12px', color: '#f39c12', fontWeight: 600 }}>⚠️ ควรระวัง: </span>
                <span style={{ fontSize: '13px', color: '#bbb' }}>{newsSummary.watchOut}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function Dashboard({user,onLogout}){
  const [portfolios,setPortfolios]=useState([])
  const [activePortfolioId,setActivePortfolioId]=useState(null)
  const [portfolioHistory,setPortfolioHistory]=useState([])
  const [heatmapMode,setHeatmapMode]=useState('today')
  const [newPortName,setNewPortName]=useState('')
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
  const [searchQuery, setSearchQuery] = useState('')

  const [inSectorNews, setInSectorNews] = useState([])
  const [outSectorNews, setOutSectorNews] = useState([])
  const [tickerNews, setTickerNews] = useState([])
  const [selectedTicker, setSelectedTicker] = useState(null)
  const [loadingNews, setLoadingNews] = useState(false)

  const fxRate=prices['USDTHB=X']||35
  const pid=activePortfolioId

  const fetchPortfolios=useCallback(async()=>{
    const p=await api.get('/portfolios')
    const list=Array.isArray(p)?p:[]
    setPortfolios(list)
    if(list.length&&!activePortfolioId){
      const def=list.find(x=>x.is_default)||list[0]
      setActivePortfolioId(Number(def.id))
    }
    return list
  },[activePortfolioId])

  const fetchAll=useCallback(async(portfolioId)=>{
    const id=portfolioId||activePortfolioId
    if(!id) return []
    const params={portfolio_id:id}
    const [h,j,t]=await Promise.all([
      api.get('/holdings',params),api.get('/journal',params),api.get('/transactions',params)
    ])
    const hl=Array.isArray(h)?h:[]
    setHoldings(hl);setJournal(Array.isArray(j)?j:[]);setTransactions(Array.isArray(t)?t:[])
    return hl
  },[activePortfolioId])

  const fetchHistory=useCallback(async(portfolioId)=>{
    if(!portfolioId) return
    const h=await api.get(`/portfolios/${portfolioId}/history`,{days:90})
    setPortfolioHistory(Array.isArray(h)?h:[])
  },[])

  const recordSnapshot=useCallback(async(portfolioId,hl,pricesMap)=>{
    if(!portfolioId||!hl?.length) return
    const getVal=h=>{
      const p=pricesMap[h.ticker]||Number(h.avg_cost)
      return Number(h.shares)*p
    }
    const getCost=h=>Number(h.shares)*Number(h.avg_cost)
    const totalValue=hl.reduce((s,h)=>s+getVal(h),0)
    const totalCost=hl.reduce((s,h)=>s+getCost(h),0)
    const sectorMap={}
    hl.forEach(h=>{
      const s=h.sector||'Other'
      sectorMap[s]=(sectorMap[s]||0)+getVal(h)
    })
    const sectorData=Object.entries(sectorMap).map(([sector,value])=>({
      sector,pct:totalValue>0?(value/totalValue)*100:0
    }))
    await api.post(`/portfolios/${portfolioId}/snapshot`,{total_value:totalValue,total_cost:totalCost,sector_data:sectorData})
    fetchHistory(portfolioId)
  },[fetchHistory])

  const fetchPrices=useCallback(async(hl,portfolioId)=>{
    if(!hl?.length) return
    setLoadingP(true)
    try{
      const r=await fetch(`/api/prices?tickers=${hl.map(h=>h.ticker).join(',')}`)
      const p=await r.json()
      setPrices(p)
      if(portfolioId) await recordSnapshot(portfolioId,hl,p)
    }catch(e){}
    setLoadingP(false)
  },[recordSnapshot])

  const loadClientNews = useCallback(async (hl) => {
    if (!hl?.length) return
    try {
      const sectors = hl.map(h => h.sector || '').filter(Boolean).join(',')
      const tickers = hl.map(h => h.ticker).join(',')
      const res = await api.fetch(`/news/dashboard`,{sectors,tickers})
      if (!res.ok) return
      const data = await res.json()
      setInSectorNews(data.inSectorNews || [])
      setOutSectorNews(data.outSectorNews || [])
    } catch (e) {
      console.error('News fetch error:', e)
    }
  }, [])

  const handleOpenTickerNews = async (ticker) => {
    setSelectedTicker(ticker)
    setLoadingNews(true)
    setTickerNews([])
    try {
      const res = await api.fetch(`/news/ticker/${ticker}`)
      if (res.ok) {
        const data = await res.json()
        setTickerNews(Array.isArray(data) ? data : [])
      }
    } catch (e) {
      console.error('Ticker news error:', e)
    }
    setLoadingNews(false)
  }

  const createPortfolio=async()=>{
    if(!newPortName.trim()) return
    const r=await api.post('/portfolios',{name:newPortName.trim()})
    if(r.id){
      setNewPortName('')
      setModal(null)
      await fetchPortfolios()
      setActivePortfolioId(Number(r.id))
    }
  }

  const handlePortfolioDeleted=async(deletedId)=>{
    const list=await fetchPortfolios()
    const def=list.find(x=>x.is_default)||list[0]
    if(def) setActivePortfolioId(Number(def.id))
    else if(list.length) setActivePortfolioId(Number(list[0].id))
    if(def||list[0]) fetchAll(Number((def||list[0]).id))
  }

  useEffect(()=>{ fetchPortfolios() },[])

  useEffect(()=>{
    if(!activePortfolioId) return
    fetchAll(activePortfolioId).then(hl=>{
      fetchPrices(hl,activePortfolioId)
      loadClientNews(hl)
      fetchHistory(activePortfolioId)
    })
    const priceInterval=setInterval(()=>{
      if(holdings.length>0) fetchPrices(holdings,activePortfolioId)
    },5*60*1000)
    const newsInterval=setInterval(()=>{
      if(holdings.length>0) loadClientNews(holdings)
    },15*60*1000)
    return()=>{clearInterval(priceInterval);clearInterval(newsInterval)}
  },[activePortfolioId])

  const delH=async id=>{if(!confirm('ลบ holding นี้?'))return;await api.delete(`/holdings/${id}`);fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}
  const delJ=async id=>{if(!confirm('ลบ journal entry?'))return;await api.delete(`/journal/${id}`);fetchAll(activePortfolioId)}
  const delT=async id=>{if(!confirm('ลบ transaction นี้?'))return;await api.delete(`/transactions/${id}`);fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}

  const convertToDisplay=(amount,currency)=>{
    if(displayCurrency==='THB') return currency==='THB'?amount:amount*fxRate
    return currency==='THB'?amount/fxRate:amount
  }

  const getVal=useCallback(h=>{
    const p=prices[h.ticker]||Number(h.avg_cost),v=Number(h.shares)*p
    return convertToDisplay(v,h.currency||'USD')
  },[prices,displayCurrency,fxRate])

  const getCost=useCallback(h=>{
    const v=Number(h.shares)*Number(h.avg_cost)
    return convertToDisplay(v,h.currency||'USD')
  },[displayCurrency,fxRate])

  const totVal=holdings.reduce((s,h)=>s+getVal(h),0)
  const totCost=holdings.reduce((s,h)=>s+getCost(h),0)
  const totPnL=totVal-totCost
  const totPct=totCost>0?(totPnL/totCost)*100:0

  const allInvested=portfolios.reduce((s,p)=>s+convertToDisplay(Number(p.total_invested||0),p.currency||'USD'),0)
  const activePort=portfolios.find(p=>p.id===activePortfolioId)

  const sym=symFor(displayCurrency)
  const fmt=n=>sym+Number(n).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2})
  const aBtn=(label,onClick,color)=><button onClick={onClick} style={{padding:'4px 10px',fontSize:'12px',border:`1px solid ${color}`,borderRadius:'6px',background:'transparent',color,cursor:'pointer',marginLeft:'6px'}}>{label}</button>

  const filteredJournal=journalFilter?journal.filter(j=>j.tag===journalFilter):journal

  const filteredHoldings = holdings.filter(h => 
    h.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (h.name && h.name.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const filteredTransactions = transactions.filter(t =>
    t.ticker.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.note && t.note.toLowerCase().includes(searchQuery.toLowerCase()))
  )

  const renderNewsGrid = () => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px', marginTop: '24px' }}>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#a29bfe', marginBottom: '14px', borderBottom: '1px solid #2a2a2a', paddingBottom: '6px' }}>
          🔥 Real-Time News (เฉพาะกลุ่ม Sector ที่ถือ)
        </h3>
        {!inSectorNews.length ? <p style={{ color: '#444', fontSize: '13px' }}>กำลังอัปเดตข่าวสารจากระบบ...</p>
        : inSectorNews.map((article, idx) => <NewsCard key={idx} article={article} />)}
      </div>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, color: '#666', marginBottom: '14px', borderBottom: '1px solid #2a2a2a', paddingBottom: '6px' }}>
          🌐 Market Insights (ข่าวน่าสนใจเกี่ยวกับหุ้นอื่นๆ)
        </h3>
        {!outSectorNews.length ? <p style={{ color: '#444', fontSize: '13px' }}>ไม่มีข้อมูลข่าวสารธุรกิจในขณะนี้</p>
        : outSectorNews.map((article, idx) => <NewsCard key={idx} article={article} />)}
      </div>
    </div>
  )

  return(
    <div style={{minHeight:'100vh',background:'#0a0a0a',color:'#fff',fontFamily:'system-ui,sans-serif'}}>
      <div style={{maxWidth:'1060px',margin:'0 auto',padding:'24px'}}>

        {/* Header */}
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'28px',flexWrap:'wrap',gap:'12px'}}>
          <div>
            <h1 style={{fontSize:'17px',fontWeight:600,marginBottom:'2px'}}>📓 Port Diary</h1>
            <p style={{color:'#444',fontSize:'13px'}}>สวัสดี, {user.name}</p>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
            <div style={{display:'flex',background:'#141414',border:'1px solid #2a2a2a',borderRadius:'8px',overflow:'hidden',maxWidth:'320px'}}>
              <select value={activePortfolioId||''} onChange={e=>setActivePortfolioId(Number(e.target.value))}
                style={{padding:'7px 12px',background:'#141414',border:'none',color:'#fff',fontSize:'13px',cursor:'pointer',flex:1,minWidth:'140px'}}>
                {portfolios.map(p=><option key={p.id} value={p.id}>{p.name}{p.is_default?' ★':''}</option>)}
              </select>
              <button onClick={()=>setModal('managePort')} style={{padding:'7px 12px',border:'none',borderLeft:'1px solid #2a2a2a',background:'transparent',color:'#888',cursor:'pointer',fontSize:'14px',lineHeight:1}} title="จัดการพอร์ต">⚙️</button>
              <button onClick={()=>setModal('newPort')} style={{padding:'7px 12px',border:'none',borderLeft:'1px solid #2a2a2a',background:'#2d2a5e',color:'#a29bfe',cursor:'pointer',fontSize:'16px',lineHeight:1}} title="สร้างพอร์ตใหม่">+</button>
            </div>
            <div style={{display:'flex',background:'#141414',border:'1px solid #2a2a2a',borderRadius:'8px',overflow:'hidden'}}>
              {['USD','THB'].map(c=><button key={c} onClick={()=>setDisplayCurrency(c)} style={{padding:'7px 16px',border:'none',cursor:'pointer',fontSize:'13px',fontWeight:500,background:displayCurrency===c?'#6c5ce7':'transparent',color:displayCurrency===c?'#fff':'#555'}}>{c==='USD'?'$ USD':'฿ THB'}</button>)}
            </div>
            <button onClick={onLogout} style={{...btnGhost,width:'auto',padding:'7px 14px',fontSize:'13px'}}>ออก</button>
          </div>
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:'6px',marginBottom:'24px',flexWrap:'wrap'}}>
          {[
            ['overview','Overview'],
            ['holdings','Holdings'],
            ['transactions','Transactions'],
            ['journal','Journal'],
            ['news','News']
          ].map(([k,l])=>(
            <button key={k} onClick={() => { setTab(k); setSearchQuery(''); }} style={{padding:'7px 18px',borderRadius:'8px',border:'1px solid #2a2a2a',background:tab===k?'#6c5ce7':'transparent',color:tab===k?'#fff':'#555',cursor:'pointer',fontSize:'13px',fontWeight:tab===k?500:400}}>{l}</button>
          ))}
        </div>

        {/* Overview */}
        {tab==='overview'&&<>
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:'12px',marginBottom:'20px'}}>
            {[
              ['มูลค่าพอร์ตรวม',fmt(totVal),`${holdings.length} holdings · ${activePort?.name||''}`,null],
              ['เงินลงทุนทั้งหมด (ทุกพอร์ต)',fmt(allInvested),`${portfolios.length} พอร์ต · ไม่รวม P&L`,'#a29bfe'],
              ['กำไร/ขาดทุน (พอร์ตนี้)',fmt(totPnL),`${totPct>=0?'+':''}${totPct.toFixed(2)}% จากทุน`,totPnL>=0?'#27ae60':'#e74c3c'],
              ['USD/THB',loadingP?'กำลังโหลด...':`$1 = ฿${fxRate.toFixed(2)}`,'Real-time','#74b9ff']
            ].map(([label,val,sub,color],i)=>(
              <div key={i} style={{background:'#141414',border:'1px solid #2a2a2a',borderRadius:'10px',padding:'16px 18px'}}>
                <div style={{color:'#555',fontSize:'12px',marginBottom:'6px'}}>{label}</div>
                <div style={{color:color||'#fff',fontSize:'20px',fontWeight:500}}>{val}</div>
                <div style={{color:'#444',fontSize:'12px',marginTop:'3px'}}>{sub}</div>
              </div>
            ))}
          </div>
          {holdings.length>0&&<>
            <PortfolioChart history={portfolioHistory} displayCurrency={displayCurrency}/>
            <SectorAreaChart holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate}/>
            <DonutChart holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate}/>
            <div style={{display:'flex',justifyContent:'flex-end',marginBottom:'8px',gap:'6px'}}>
              <span style={{fontSize:'12px',color:'#555',alignSelf:'center'}}>Heatmap:</span>
              {[['today','% วันนี้'],['invested','% จากทุน']].map(([k,l])=>(
                <button key={k} onClick={()=>setHeatmapMode(k)} style={{padding:'5px 12px',fontSize:'12px',borderRadius:'6px',border:`1px solid ${heatmapMode===k?'#6c5ce7':'#2a2a2a'}`,background:heatmapMode===k?'#2d2a5e':'transparent',color:heatmapMode===k?'#a29bfe':'#555',cursor:'pointer'}}>{l}</button>
              ))}
            </div>
            <Treemap holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate} heatmapMode={heatmapMode}/>
            <AIPanel holdings={holdings} prices={prices} displayCurrency={displayCurrency} fxRate={fxRate} inSectorNews={inSectorNews} />
            {renderNewsGrid()}
          </>}
          {holdings.length===0&&<div style={{textAlign:'center',padding:'60px',color:'#444'}}>
            <p style={{fontSize:'36px',marginBottom:'12px'}}>📊</p>
            <p style={{fontSize:'14px',marginBottom:'20px'}}>เริ่มบันทึก Transaction แรกเพื่อสร้าง portfolio</p>
            <button onClick={()=>{setTab('transactions');setModal('tx')}} style={{...btnPrimary,width:'auto',padding:'10px 24px'}}>+ บันทึก Transaction แรก</button>
          </div>}
        </>}

        {/* Holdings */}
        {tab==='holdings'&&<>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',gap:'16px',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:'12px',alignItems:'center',flex:1}}>
              <p style={{color:'#444',fontSize:'13px',whiteSpace:'nowrap'}}>{filteredHoldings.length} / {holdings.length} holdings</p>
              <input type="text" placeholder="🔍 ค้นหา Ticker หรือชื่อหุ้นในพอร์ต..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{maxHeight:'34px',padding:'6px 12px',background:'#141414',border:'1px solid #2a2a2a',borderRadius:'6px',color:'#fff',fontSize:'13px',width:'260px'}} />
            </div>
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
                {filteredHoldings.length===0?<tr><td colSpan={9} style={{padding:'28px',textAlign:'center',color:'#333'}}>ไม่พบรายการ holdings</td></tr>
                :filteredHoldings.map(h=>{
                  const cur=prices[h.ticker]||Number(h.avg_cost)
                  const val=getVal(h),cost=getCost(h),pnl=val-cost,pct=cost>0?(pnl/cost)*100:0
                  const os=symFor(h.currency||'USD')
                  return(<tr key={h.id} style={{borderBottom:'1px solid #1a1a1a'}}>
                    <td style={{padding:'11px 13px',fontWeight:600, color: '#6c5ce7', cursor: 'pointer', textDecoration: 'underline'}} onClick={() => handleOpenTickerNews(h.ticker)}>{h.ticker}</td>
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
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'16px',gap:'16px',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:'12px',alignItems:'center',flex:1}}>
              <p style={{color:'#444',fontSize:'13px',whiteSpace:'nowrap'}}>{filteredTransactions.length} / {transactions.length} transactions</p>
              <input type="text" placeholder="🔍 ค้นหาด้วยชื่อย่อ Ticker หรือข้อความ..." value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} style={{maxHeight:'34px',padding:'6px 12px',background:'#141414',border:'1px solid #2a2a2a',borderRadius:'6px',color:'#fff',fontSize:'13px',width:'260px'}} />
            </div>
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
                {filteredTransactions.length===0?<tr><td colSpan={8} style={{padding:'28px',textAlign:'center',color:'#333'}}>ไม่พบรายการ transactions</td></tr>
                :filteredTransactions.map(t=>(
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

        {/* News Tab Section */}
        {tab==='news' && renderNewsGrid()}

      </div>

      {modal==='h'&&<HoldingModal portfolioId={activePortfolioId} onClose={()=>setModal(null)} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='eh'&&editH&&<HoldingModal portfolioId={activePortfolioId} holding={editH} onClose={()=>{setModal(null);setEditH(null)}} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='j'&&<JournalModal portfolioId={activePortfolioId} onClose={()=>setModal(null)} onSave={()=>fetchAll(activePortfolioId)}/>}
      {modal==='ej'&&editJ&&<JournalModal portfolioId={activePortfolioId} entry={editJ} onClose={()=>{setModal(null);setEditJ(null)}} onSave={()=>fetchAll(activePortfolioId)}/>}
      {modal==='tx'&&<TransactionModal portfolioId={activePortfolioId} holdings={holdings} onClose={()=>setModal(null)} onSave={()=>fetchAll(activePortfolioId).then(hl=>fetchPrices(hl,activePortfolioId))}/>}
      {modal==='newPort'&&(
        <Modal title="สร้างพอร์ตใหม่" onClose={()=>setModal(null)}>
          <Field label="ชื่อพอร์ต"><input style={inp()} placeholder="เช่น US Growth, หุ้นไทย" value={newPortName} onChange={e=>setNewPortName(e.target.value)}/></Field>
          <button onClick={createPortfolio} style={{...btnPrimary,marginTop:'8px'}}>สร้างพอร์ต</button>
        </Modal>
      )}
      {modal==='managePort'&&activePort&&(
        <PortfolioManageModal
          portfolio={activePort}
          portfolios={portfolios}
          onClose={()=>setModal(null)}
          onUpdated={()=>{fetchPortfolios();fetchHistory(activePortfolioId)}}
          onDeleted={handlePortfolioDeleted}
        />
      )}

      {/* Modal ดูข่าวสารรายหุ้นเจาะจง */}
      {selectedTicker && (
        <Modal title={`ข่าวสารล่าสุดของหุ้น ${selectedTicker}`} onClose={() => setSelectedTicker(null)}>
          {loadingNews ? <p style={{ color: '#888', fontSize: '13px' }}>กำลังดึงข้อมูลข่าวสารแบบเรียลไทม์...</p>
          : tickerNews.length === 0 ? <p style={{ color: '#444', fontSize: '13px' }}>ไม่พบข้อมูลข่าวสารของหุ้นตัวนี้ในปัจจุบัน</p>
          : tickerNews.map((article, idx) => <NewsCard key={idx} article={article} />)}
        </Modal>
      )}
    </div>
  )
}

export default function App(){
  const [user,setUser]=useState(()=>{const u=localStorage.getItem('user');return u?JSON.parse(u):null})
  const [page,setPage]=useState('landing')
  const goHome=()=>setPage('landing')
  const logout=()=>{localStorage.removeItem('token');localStorage.removeItem('user');setUser(null);setPage('landing')}
  if(user) return <Dashboard user={user} onLogout={logout}/>
  if(page==='register') return <Register onGoLogin={()=>setPage('login')} onGoHome={goHome}/>
  if(page==='login') return <Login onLogin={setUser} onGoRegister={()=>setPage('register')} onGoHome={goHome}/>
  return <Landing onLogin={()=>setPage('login')} onRegister={()=>setPage('register')}/>
}
