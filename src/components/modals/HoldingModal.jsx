import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import AmountInput from '../ui/AmountInput'
import Modal from '../ui/Modal'

import { MARKETS, symFor, sanitizeTicker, SECTOR_COLORS, JOURNAL_TAGS } from '../../lib/constants'

export default function HoldingModal({holding,onClose,onSave,portfolioId}){
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
      
      <div style={{display:'flex',gap:'10px',marginTop:'20px'}} className="dash-modal-actions">
        <button type="button" onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button type="button" onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':isEdit?'บันทึกการแก้ไข':'บันทึก'}</button>
      </div>
    </Modal>
  )
}