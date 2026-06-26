import { inp } from '../../lib/styles'

export default function Field({label,children}){
  return(
    <div style={{marginBottom:'12px'}}>
      <label style={{display:'block',fontSize:'11px',color:'#666',marginBottom:'5px',letterSpacing:'.05em',textTransform:'uppercase'}}>{label}</label>
      {children}
    </div>
  )
}