import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

import { JOURNAL_TAGS as journalTags } from '../../lib/constants'
export default function JournalModal({entry,onClose,onSave,portfolioId}){
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
      <div style={{display:'flex',gap:'8px'}} className="dash-modal-row">
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
      <div style={{display:'flex',gap:'10px',marginTop:'20px'}} className="dash-modal-actions">
        <button onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button onClick={save} style={btnPrimary} disabled={loading}>{loading?'กำลังบันทึก...':'บันทึก'}</button>
      </div>
    </Modal>
  )
}