export const inp = (extra = {}) => ({
  width: '100%',
  padding: '10px 12px',
  marginBottom: '12px',
  background: '#1e1e1e',
  border: '1px solid #3a3a3a',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  boxSizing: 'border-box',
  ...extra,
})

export const btnPrimary = {
  padding: '10px 20px',
  background: '#6c5ce7',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  cursor: 'pointer',
  width: '100%',
}

export const btnGhost = {
  padding: '10px 20px',
  background: 'transparent',
  border: '1px solid #3a3a3a',
  borderRadius: '8px',
  color: '#888',
  fontSize: '14px',
  cursor: 'pointer',
  width: '100%',
}

export const wrap = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#0a0a0a',
}

export const card = {
  background: '#141414',
  padding: '36px',
  borderRadius: '14px',
  width: '380px',
  border: '1px solid #2a2a2a',
}
