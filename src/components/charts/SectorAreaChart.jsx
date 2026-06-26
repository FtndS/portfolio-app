import { MARKETS, symFor, sanitizeTicker, SECTOR_COLORS, JOURNAL_TAGS } from '../../lib/constants'

export default function SectorAreaChart({holdings,prices,displayCurrency,fxRate}){
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