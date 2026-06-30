import { useState, useEffect, useCallback } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost } from '../../lib/styles'

function fmtDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
}

function fmtDay(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function AdminSubscribers({ highlightUserId }) {
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [planFilter, setPlanFilter] = useState('all')
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState(null)
  const [extendMonths, setExtendMonths] = useState('1')
  const [planNote, setPlanNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveMsg, setSaveMsg] = useState('')

  const loadUsers = useCallback(async () => {
    setLoading(true)
    setError('')
    const params = {}
    if (planFilter !== 'all') params.plan = planFilter
    if (search.trim()) params.q = search.trim()
    const rows = await api.get('/admin/users', params)
    setLoading(false)
    if (Array.isArray(rows)) {
      setUsers(rows)
    } else {
      setError(rows.error || 'โหลดรายชื่อไม่สำเร็จ')
      setUsers([])
    }
  }, [planFilter, search])

  useEffect(() => {
    loadUsers()
  }, [loadUsers])

  useEffect(() => {
    if (!highlightUserId || !users.length) return
    const match = users.find((u) => u.id === highlightUserId)
    if (match) setSelected(match)
  }, [highlightUserId, users])

  useEffect(() => {
    if (!selected) return
    setPlanNote(selected.planNote || '')
    setSaveMsg('')
  }, [selected])

  const applyPlan = async (plan) => {
    if (!selected) return
    setSaving(true)
    setSaveMsg('')
    const body = {
      plan,
      planNote: planNote.trim() || undefined,
    }
    if (plan === 'pro') body.extendMonths = Number(extendMonths) || 1

    const r = await api.patch(`/admin/users/${selected.id}/plan`, body)
    setSaving(false)
    if (r.error) {
      setSaveMsg(r.error)
      return
    }
    setSaveMsg(r.message || 'บันทึกแล้ว')
    setSelected(r)
    setUsers((prev) => prev.map((u) => (u.id === r.id ? r : u)))
  }

  const proCount = users.filter((u) => u.plan === 'pro').length

  return (
    <>
      <div className="dash-toolbar" style={{ marginBottom: '16px', flexWrap: 'wrap', gap: '10px' }}>
        <div className="dash-segment">
          {[
            ['all', 'ทั้งหมด'],
            ['pro', 'Pro'],
            ['free', 'Free'],
          ].map(([key, label]) => (
            <button
              key={key}
              type="button"
              className={`dash-segment-btn${planFilter === key ? ' dash-segment-btn--active' : ''}`}
              onClick={() => setPlanFilter(key)}
            >
              {label}
            </button>
          ))}
        </div>
        <input
          className="dash-search dash-admin-user-search"
          placeholder="ค้นหาอีเมลหรือชื่อ..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && loadUsers()}
        />
        <button type="button" className="dash-util-btn" onClick={loadUsers} disabled={loading}>
          ค้นหา / รีเฟรช
        </button>
      </div>

      <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
        Pro ในรายการนี้: {proCount} คน · เปิด Pro หลังยืนยันการโอนแล้ว
      </p>

      {error && <p className="dash-text-loss" style={{ marginBottom: '12px' }}>{error}</p>}

      <div className="dash-admin-layout">
        <div className="dash-card dash-admin-list">
          {loading ? (
            <p className="dash-text-muted" style={{ padding: '16px' }}>กำลังโหลด...</p>
          ) : users.length === 0 ? (
            <p className="dash-text-faint" style={{ padding: '24px', textAlign: 'center' }}>ไม่พบผู้ใช้</p>
          ) : (
            users.map((u) => (
              <button
                key={u.id}
                type="button"
                className={`dash-admin-ticket-row${selected?.id === u.id ? ' dash-admin-ticket-row--active' : ''}`}
                onClick={() => setSelected(u)}
              >
                <div className="dash-admin-ticket-row-top">
                  <span style={{ fontWeight: 600 }}>{u.name || u.email}</span>
                  <span className={`dash-admin-status ${u.plan === 'pro' ? 'dash-admin-status--resolved' : ''}`}>
                    {u.plan === 'pro' ? 'Pro' : 'Free'}
                  </span>
                </div>
                <div className="dash-text-faint" style={{ fontSize: '12px' }}>{u.email}</div>
                {u.plan === 'pro' && (
                  <div className="dash-text-faint" style={{ fontSize: '12px' }}>
                    หมดอายุ {fmtDay(u.planExpiresAt)}
                  </div>
                )}
              </button>
            ))
          )}
        </div>

        <div className="dash-card dash-admin-detail">
          {!selected ? (
            <p className="dash-text-faint" style={{ padding: '24px', textAlign: 'center' }}>
              เลือกผู้ใช้จากรายการด้านซ้าย
            </p>
          ) : (
            <>
              <h3 className="dash-card-title" style={{ marginBottom: '4px' }}>{selected.name || '—'}</h3>
              <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '16px' }}>
                {selected.email} · สมัคร {fmtDay(selected.createdAt)}
              </p>

              <div className="dash-inset" style={{ padding: '14px', marginBottom: '16px' }}>
                <div className="dash-text-muted" style={{ fontSize: '12px', marginBottom: '4px' }}>แผนปัจจุบัน</div>
                <div style={{ fontWeight: 700, fontSize: '18px', marginBottom: '6px' }}>
                  {selected.plan === 'pro' ? 'Pro' : 'Free'}
                  {selected.role === 'admin' && <span className="dash-text-faint" style={{ fontSize: '13px', fontWeight: 400 }}> · Admin</span>}
                </div>
                {selected.plan === 'pro' && (
                  <p className="dash-text-secondary" style={{ fontSize: '13px', margin: '0 0 6px' }}>
                    หมดอายุ: {fmtDate(selected.planExpiresAt)}
                  </p>
                )}
                {selected.planUpdatedAt && (
                  <p className="dash-text-faint" style={{ fontSize: '12px', margin: 0 }}>
                    อัปเดตล่าสุด: {fmtDate(selected.planUpdatedAt)}
                  </p>
                )}
                {selected.planNote && (
                  <p className="dash-text-secondary" style={{ fontSize: '13px', margin: '10px 0 0', whiteSpace: 'pre-wrap' }}>
                    บันทึก: {selected.planNote}
                  </p>
                )}
              </div>

              <label className="dash-text-muted" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                บันทึกการชำระเงิน (ภายใน)
              </label>
              <textarea
                className="dash-search"
                style={{ width: '100%', minHeight: '72px', marginBottom: '14px', resize: 'vertical' }}
                value={planNote}
                onChange={(e) => setPlanNote(e.target.value)}
                placeholder="เช่น โอน 99 บาท วันที่ 29 มิ.ย. 2569 · PromptPay"
              />

              <label className="dash-text-muted" style={{ fontSize: '12px', display: 'block', marginBottom: '6px' }}>
                ระยะเวลา Pro (เมื่อเปิดหรือต่ออายุ)
              </label>
              <select
                className="dash-select"
                style={{ width: '100%', marginBottom: '14px' }}
                value={extendMonths}
                onChange={(e) => setExtendMonths(e.target.value)}
              >
                <option value="1">1 เดือน</option>
                <option value="3">3 เดือน</option>
                <option value="6">6 เดือน</option>
                <option value="12">12 เดือน</option>
              </select>

              {saveMsg && (
                <p className={saveMsg.includes('แล้ว') ? 'dash-text-gain' : 'dash-text-loss'} style={{ fontSize: '13px', marginBottom: '8px' }}>
                  {saveMsg}
                </p>
              )}

              <div className="dash-admin-plan-actions">
                <button type="button" onClick={() => applyPlan('pro')} style={btnPrimary} disabled={saving}>
                  {saving ? 'กำลังบันทึก...' : selected.plan === 'pro' ? 'ต่ออายุ Pro' : 'เปิด Pro'}
                </button>
                <button type="button" onClick={() => applyPlan('free')} style={btnGhost} disabled={saving || selected.plan !== 'pro'}>
                  เปลี่ยนเป็น Free
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  )
}
