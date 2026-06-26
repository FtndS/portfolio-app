import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import AmountInput from '../ui/AmountInput'
import Modal from '../ui/Modal'

import { MARKETS, symFor, sanitizeTicker, SECTOR_COLORS, JOURNAL_TAGS } from '../../lib/constants'

export default function TransactionModal({holdings,transaction,onClose,onSave,portfolioId}){
  const today=new Date().toISOString().split('T')[0]
  const isEdit=!!transaction
  const [f,setF]=useState(()=>({
    ticker:transaction?.ticker||'',
    type:transaction?.type||'BUY',
    shares:transaction?.shares!=null?String(transaction.shares):'',
    price:transaction?.price!=null?String(transaction.price):'',
    note:transaction?.note||'',
    date:transaction?.date?.split('T')[0]||today,
    holding_id:transaction?.holding_id?String(transaction.holding_id):'',
    currency:'USD',
  }))
  const [loading,setLoading]=useState(false)
  const [error,setError]=useState('')
  const selHolding=e=>{
    const h=holdings.find(h=>String(h.id)===e.target.value)
    if(h) setF({...f,holding_id:e.target.value,ticker:h.ticker,currency:h.currency||'USD'})
    else setF({...f,holding_id:''})
  }
  const save=async()=>{
    if(!f.ticker||!f.shares||!f.price||!f.date) return setError('กรุณากรอกข้อมูลให้ครบ')
    setLoading(true)
    setError('')
    const cleanTicker = sanitizeTicker(f.ticker)
    const body={ticker:cleanTicker,type:f.type,shares:parseFloat(f.shares),price:parseFloat(f.price),note:f.note,date:f.date,holding_id:f.holding_id||null,portfolio_id:portfolioId,currency:f.currency}
    const r=isEdit
      ? await api.put(`/transactions/${transaction.id}`,body)
      : await api.post('/transactions',body)
    setLoading(false)
    if(r.id){onSave();onClose()} else setError(r.error||'บันทึกไม่สำเร็จ')
  }
  const sym=f.currency==='THB'?'฿':'$'
  const total=f.shares&&f.price?parseFloat(f.shares)*parseFloat(f.price):0
  return(
    <Modal title={isEdit?'แก้ไข Transaction':'บันทึก Transaction'} onClose={onClose}>
      {error&&<p style={{color:'#e74c3c',fontSize:'13px',marginBottom:'16px'}}>{error}</p>}
      <Field label="เลือก Holding ที่มีอยู่ (optional)">
        <select style={inp()} value={f.holding_id} onChange={selHolding}>
          <option value="">-- หรือพิมพ์ Ticker เองด้านล่าง --</option>
          {holdings.map(h=><option key={h.id} value={h.id}>{h.ticker} — {h.name||h.ticker}</option>)}
        </select>
      </Field>
      <div style={{display:'flex',gap:'8px',marginBottom:'12px'}} className="dash-modal-row">
        <div style={{flex:1}}>
          <Field label="Ticker">
            <input style={inp({marginBottom:0})} placeholder="เช่น VOO" value={f.ticker} onChange={e=>setF({...f,ticker:e.target.value})} disabled={isEdit}/></Field>
        </div>
        <div style={{flex:'none',width:'120px'}} className="dash-modal-type">
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
      <div style={{display:'flex',gap:'8px'}} className="dash-modal-row">
        <div style={{flex:1}}><Field label="จำนวนหุ้น"><AmountInput suffix="shares" placeholder="100" value={f.shares} onChange={e=>setF({...f,shares:e.target.value})}/></Field></div>
        <div style={{flex:1}}><Field label={`ราคา/หุ้น (${f.currency})`}><AmountInput prefix={sym} placeholder="0.00" value={f.price} onChange={e=>setF({...f,price:e.target.value})}/></Field></div>
      </div>
      {total>0&&<div style={{background:'#1a2a1a',border:'1px solid #2a4a2a',borderRadius:'8px',padding:'10px 14px',marginBottom:'12px'}}>
        <span style={{fontSize:'12px',color:'#55efc4'}}>มูลค่ารวม: </span>
        <span style={{fontSize:'14px',fontWeight:600,color:'#fff'}}>{sym}{total.toLocaleString('en-US',{minimumFractionDigits:2})}</span>
      </div>}
      <Field label="วันที่"><input type="date" style={inp()} value={f.date} onChange={e=>setF({...f,date:e.target.value})}/></Field>
      <Field label="หมายเหตุ (optional)"><input style={inp({marginBottom:0})} placeholder="เช่น DCA รายเดือน" value={f.note} onChange={e=>setF({...f,note:e.target.value})}/></Field>
      <div style={{display:'flex',gap:'10px',marginTop:'20px'}} className="dash-modal-actions">
        <button type="button" onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button type="button" onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':isEdit?'บันทึกการแก้ไข':'บันทึก'}</button>
      </div>
    </Modal>
  )
}