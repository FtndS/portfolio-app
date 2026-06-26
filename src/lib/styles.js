export const inp = (extra = {}) => ({
  width: '100%',
  padding: '10px 12px',
  marginBottom: '12px',
  background: 'var(--surface-input)',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  color: 'var(--text)',
  fontSize: '14px',
  boxSizing: 'border-box',
  ...extra,
})

export const btnPrimary = {
  padding: '10px 20px',
  background: 'var(--accent)',
  border: 'none',
  borderRadius: '8px',
  color: '#fff',
  fontSize: '14px',
  cursor: 'pointer',
  width: '100%',
  fontWeight: 500,
}

export const btnGhost = {
  padding: '10px 20px',
  background: 'transparent',
  border: '1px solid var(--border-strong)',
  borderRadius: '8px',
  color: 'var(--text-muted)',
  fontSize: '14px',
  cursor: 'pointer',
  width: '100%',
}

export const wrap = {
  minHeight: '100vh',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: 'var(--bg)',
}

export const card = {
  background: 'var(--surface)',
  padding: '36px',
  borderRadius: '14px',
  width: '380px',
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-md)',
}
