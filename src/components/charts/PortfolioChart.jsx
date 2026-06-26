import { MARKETS, symFor, sanitizeTicker, SECTOR_COLORS, JOURNAL_TAGS } from '../../lib/constants'

export default function PortfolioChart({history,displayCurrency}){
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