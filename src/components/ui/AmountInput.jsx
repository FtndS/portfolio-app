import { inp } from '../../lib/styles'

export default function AmountInput({prefix,suffix,placeholder,value,onChange,type='number'}){
  return(
    <div style={{display:'flex',alignItems:'center',background:'#1e1e1e',border:'1px solid #3a3a3a',borderRadius:'8px',overflow:'hidden'}}>
      {prefix&&<span style={{padding:'0 10px',color:'#666',fontSize:'14px',flexShrink:0,borderRight:'1px solid #2a2a2a',lineHeight:'40px'}}>{prefix}</span>}
      <input type={type} placeholder={placeholder||'0.00'} value={value} onChange={onChange}
        style={{flex:1,padding:'10px 12px',background:'transparent',border:'none',color:'#fff',fontSize:'14px',outline:'none',width:'100%'}}/>
      {suffix&&<span style={{padding:'0 10px',color:'#666',fontSize:'14px',flexShrink:0,borderLeft:'1px solid #2a2a2a',lineHeight:'40px'}}>{suffix}</span>}
    </div>
  )
}