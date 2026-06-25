import { useState, useEffect } from 'react'
import { api } from './lib/api'

function Login({ onLogin }) {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')

  const handleSubmit = async (e) => {
    e.preventDefault()
    const res = await api.post('/auth/login', form)
    if (res.token) {
      localStorage.setItem('token', res.token)
      localStorage.setItem('user', JSON.stringify(res.user))
      onLogin(res.user)
    } else {
      setError('Email หรือ Password ไม่ถูกต้อง')
    }
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0f0f0f' }}>
      <div style={{ background: '#1a1a1a', padding: '32px', borderRadius: '12px', width: '360px', border: '1px solid #333' }}>
        <h1 style={{ color: '#fff', marginBottom: '8px', fontSize: '22px' }}>Port Diary</h1>
        <p style={{ color: '#888', marginBottom: '24px', fontSize: '14px' }}>บันทึกพอร์ตการลงทุน</p>
        {error && <p style={{ color: '#e74c3c', marginBottom: '16px', fontSize: '13px' }}>{error}</p>}
        <input
          type="email" placeholder="Email"
          style={{ width: '100%', padding: '10px', marginBottom: '12px', background: '#252525', border: '1px solid #444', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
          onChange={e => setForm({ ...form, email: e.target.value })}
        />
        <input
          type="password" placeholder="Password"
          style={{ width: '100%', padding: '10px', marginBottom: '20px', background: '#252525', border: '1px solid #444', borderRadius: '8px', color: '#fff', fontSize: '14px', boxSizing: 'border-box' }}
          onChange={e => setForm({ ...form, password: e.target.value })}
        />
        <button
          onClick={handleSubmit}
          style={{ width: '100%', padding: '10px', background: '#6c5ce7', border: 'none', borderRadius: '8px', color: '#fff', fontSize: '14px', cursor: 'pointer' }}
        >
          เข้าสู่ระบบ
        </button>
      </div>
    </div>
  )
}

function Dashboard({ user, onLogout }) {
  const [holdings, setHoldings] = useState([])
  const [journal, setJournal] = useState([])
  const [tab, setTab] = useState('holdings')

  useEffect(() => {
    api.get('/holdings').then(setHoldings)
    api.get('/journal').then(setJournal)
  }, [])

  return (
    <div style={{ minHeight: '100vh', background: '#0f0f0f', color: '#fff', padding: '24px', fontFamily: 'sans-serif' }}>
      <div style={{ maxWidth: '960px', margin: '0 auto' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <h1 style={{ fontSize: '18px', fontWeight: 500 }}>📓 Port Diary — {user.name}</h1>
          <button onClick={onLogout} style={{ background: 'transparent', border: '1px solid #444', color: '#888', padding: '6px 14px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px' }}>
            ออกจากระบบ
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
          {['holdings', 'journal'].map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ padding: '6px 16px', borderRadius: '8px', border: '1px solid #444', background: tab === t ? '#6c5ce7' : 'transparent', color: tab === t ? '#fff' : '#888', cursor: 'pointer', fontSize: '13px' }}>
              {t === 'holdings' ? 'Holdings' : 'Journal'}
            </button>
          ))}
        </div>

        {tab === 'holdings' && (
          <div>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>Holdings: {holdings.length} รายการ</p>
            {holdings.length === 0
              ? <p style={{ color: '#555', fontSize: '13px' }}>ยังไม่มี holdings — เพิ่มผ่าน API ได้เลยครับ</p>
              : holdings.map(h => (
                <div key={h.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px' }}>
                  <span style={{ fontWeight: 500 }}>{h.ticker}</span>
                  <span style={{ color: '#888', marginLeft: '12px', fontSize: '13px' }}>{h.name}</span>
                  <span style={{ float: 'right', fontSize: '13px', color: '#aaa' }}>{h.shares} shares @ ฿{h.avg_cost}</span>
                </div>
              ))
            }
          </div>
        )}

        {tab === 'journal' && (
          <div>
            <p style={{ color: '#888', fontSize: '13px', marginBottom: '16px' }}>Journal: {journal.length} entries</p>
            {journal.length === 0
              ? <p style={{ color: '#555', fontSize: '13px' }}>ยังไม่มี journal entry</p>
              : journal.map(j => (
                <div key={j.id} style={{ background: '#1a1a1a', border: '1px solid #333', borderRadius: '10px', padding: '14px 16px', marginBottom: '8px' }}>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                    <span style={{ fontSize: '12px', color: '#888' }}>{j.date}</span>
                    {j.tag && <span style={{ fontSize: '11px', background: '#2d2d5e', color: '#a29bfe', padding: '1px 8px', borderRadius: '999px' }}>{j.tag}</span>}
                  </div>
                  <p style={{ fontSize: '13px', color: '#ddd', lineHeight: 1.6 }}>{j.content}</p>
                </div>
              ))
            }
          </div>
        )}
      </div>
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    const u = localStorage.getItem('user')
    return u ? JSON.parse(u) : null
  })

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    setUser(null)
  }

  return user
    ? <Dashboard user={user} onLogout={handleLogout} />
    : <Login onLogin={setUser} />
}