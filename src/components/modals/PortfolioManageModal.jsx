import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

import { symFor } from '../../lib/constants'
import { MASKED } from '../../lib/format'
import { usePrivacy } from '../../lib/privacy'

export default function PortfolioManageModal({portfolio,portfolios,onClose,onUpdated,onDeleted}){
  const { hideValues } = usePrivacy()
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
        <div>{portfolio.holding_count||0} holdings · ทุน {hideValues ? MASKED : `${symFor(portfolio.currency||'USD')}${Number(portfolio.total_invested||0).toLocaleString('en-US',{minimumFractionDigits:2})}`}</div>
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