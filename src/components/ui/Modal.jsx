export default function Modal({title,onClose,children}){
  return(
    <div className="modal-overlay">
      <div className="modal-panel">
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'24px'}}>
          <h2 style={{color:'#fff',fontSize:'16px',fontWeight:600}}>{title}</h2>
          <button onClick={onClose} style={{background:'none',border:'none',color:'#555',cursor:'pointer',fontSize:'22px',lineHeight:1}}>×</button>
        </div>
        {children}
      </div>
    </div>
  )
}