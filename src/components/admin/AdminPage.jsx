import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost } from '../../lib/styles'

const STATUS_LABELS = {
  open: 'เปิดใหม่',
  in_progress: 'กำลังดำเนินการ',
  resolved: 'แก้ไขแล้ว',
  closed: 'ปิด',
}

const CATEGORY_LABELS = {
  bug: 'Bug',
  question: 'คำถาม',
  feature: 'ขอฟีเจอร์',
  other: 'อื่นๆ',
}

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

export default function AdminPage({ user, onBack, onLogout }) {
  const [tickets, setTickets] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState(null)
  const [editStatus, setEditStatus] = useState('open')
  const [editNotes, setEditNotes] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const loadTickets = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = filter === 'all' ? undefined : { status: filter }
    const rows = await api.get('/admin/tickets', params)
    setLoading(false)
    if (Array.isArray(rows)) {
      setTickets(rows)
    } else {
      setError(rows.error || 'โหลดคำร้องไม่สำเร็จ')
      setTickets([])
    }
  }, [filter])

  useEffect(() => {
    loadTickets()
  }, [loadTickets])

  useEffect(() => {
    if (!selected) return
    setEditStatus(selected.status)
    setEditNotes(selected.admin_notes || '')
    setSaveMsg('')
  }, [selected])

  const saveTicket = async () => {
    if (!selected) return
    setSaving(true)
    setSaveMsg('')
    const r = await api.put(`/admin/tickets/${selected.id}`, {
      status: editStatus,
      admin_notes: editNotes,
    })
    setSaving(false)
    if (r.error) {
      setSaveMsg(r.error)
      return
    }
    setSaveMsg('บันทึกแล้ว')
    setSelected(r)
    setTickets((prev) => prev.map((t) => (t.id === r.id ? { ...t, ...r } : t)))
  }

  const openCount = tickets.filter((t) => t.status === 'open').length

  return (
    <div className="dash-root">
      <div className="dash-shell">
        <div className="dash-header">
          <div className="dash-header-top">
            <div>
              <h1 className="dash-title">Admin — คำร้องจากผู้ใช้</h1>
              <p className="dash-subtitle">{user.email} · {openCount} เปิดใหม่</p>
            </div>
            <div className="dash-header-util">
              <button type="button" className="dash-util-btn" onClick={onBack}>กลับ Dashboard</button>
              <button type="button" className="dash-util-btn dash-util-btn--logout" onClick={onLogout}>ออก</button>
            </div>
          </div>
        </div>

        <div className="dash-toolbar" style={{ marginBottom: '16px' }}>
          <div className="dash-segment">
            {[
              ['all', 'ทั้งหมด'],
              ['open', 'เปิดใหม่'],
              ['in_progress', 'กำลังทำ'],
              ['resolved', 'แก้แล้ว'],
              ['closed', 'ปิด'],
            ].map(([key, label]) => (
              <button
                key={key}
                type="button"
                className={`dash-segment-btn${filter === key ? ' dash-segment-btn--active' : ''}`}
                onClick={() => setFilter(key)}
              >
                {label}
              </button>
            ))}
          </div>
          <button type="button" className="dash-util-btn" onClick={loadTickets} disabled={loading}>
            รีเฟรช
          </button>
        </div>

        {error && <p className="dash-text-loss" style={{ marginBottom: '12px' }}>{error}</p>}

        <div className="dash-admin-layout">
          <div className="dash-card dash-admin-list">
            {loading ? (
              <p className="dash-text-muted" style={{ padding: '16px' }}>กำลังโหลด...</p>
            ) : tickets.length === 0 ? (
              <p className="dash-text-faint" style={{ padding: '24px', textAlign: 'center' }}>ไม่มีคำร้อง</p>
            ) : (
              tickets.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className={`dash-admin-ticket-row${selected?.id === t.id ? ' dash-admin-ticket-row--active' : ''}`}
                  onClick={() => setSelected(t)}
                >
                  <div className="dash-admin-ticket-row-top">
                    <span className="dash-text-accent" style={{ fontWeight: 600 }}>#{t.id}</span>
                    <span className={`dash-admin-status dash-admin-status--${t.status}`}>
                      {STATUS_LABELS[t.status] || t.status}
                    </span>
                  </div>
                  <div className="dash-admin-ticket-subject">{t.subject}</div>
                  <div className="dash-text-faint" style={{ fontSize: '12px' }}>
                    {t.user_name || t.user_email} · {CATEGORY_LABELS[t.category]} · {fmtDate(t.created_at)}
                  </div>
                </button>
              ))
            )}
          </div>

          <div className="dash-card dash-admin-detail">
            {!selected ? (
              <p className="dash-text-faint" style={{ padding: '24px', textAlign: 'center' }}>
                เลือกคำร้องจากรายการด้านซ้าย
              </p>
            ) : (
              <>
                <h3 className="dash-card-title" style={{ marginBottom: '8px' }}>{selected.subject}</h3>
                <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                  {selected.user_name} ({selected.user_email}) · {CATEGORY_LABELS[selected.category]} · {fmtDate(selected.created_at)}
                </p>
                <div className="dash-inset" style={{ padding: '14px', marginBottom: '16px', whiteSpace: 'pre-wrap', fontSize: '14px', lineHeight: 1.65 }}>
                  {selected.message}
                </div>

                <label className="dash-text-muted" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>สถานะ</label>
                <select
                  className="dash-select"
                  style={{ width: '100%', marginBottom: '14px' }}
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                >
                  {Object.entries(STATUS_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>{v}</option>
                  ))}
                </select>

                <label className="dash-text-muted" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>บันทึก Admin (ไม่แสดงให้ user)</label>
                <textarea
                  className="dash-search"
                  style={{ width: '100%', minHeight: '88px', marginBottom: '12px', resize: 'vertical' }}
                  value={editNotes}
                  onChange={(e) => setEditNotes(e.target.value)}
                  placeholder="หมายเหตุภายใน..."
                />

                {saveMsg && (
                  <p className={saveMsg === 'บันทึกแล้ว' ? 'dash-text-gain' : 'dash-text-loss'} style={{ fontSize: '13px', marginBottom: '8px' }}>
                    {saveMsg}
                  </p>
                )}
                <button type="button" onClick={saveTicket} style={btnPrimary} disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : 'บันทึกสถานะ'}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
