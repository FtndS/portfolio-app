import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost } from '../../lib/styles'

function fmtExpires(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function quotaLine(quota, key, label) {
  if (!quota) return null
  if (quota.isOwner) return { label, value: 'ไม่จำกัด', tone: 'gain' }
  const slot = quota[key]
  const limit = quota.limits?.[key]
  if (!slot) return null
  if (!slot.allowed) {
    const when = slot.nextAvailableAt
      ? new Date(slot.nextAvailableAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
      : null
    return { label, value: when ? `ใช้ครบแล้ว · ได้อีกครั้ง ${when}` : 'ใช้ครบแล้ว', tone: 'loss' }
  }
  if (limit != null && slot.remaining != null) {
    return { label, value: `เหลือ ${slot.remaining}/${limit} ครั้ง/สัปดาห์`, tone: 'default' }
  }
  return { label, value: 'ใช้ได้', tone: 'default' }
}

const QUOTA_KEYS = [
  ['analyze', 'วิเคราะห์พอร์ต'],
  ['copilot', 'Copilot'],
  ['newsSummary', 'สรุปข่าว'],
  ['tickerJournal', 'สรุป journal หุ้น'],
]

export default function SubscriptionPage({ user, onOpenSupport }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')

  const load = async () => {
    setLoading(true)
    setErr('')
    const r = await api.get('/subscription')
    setLoading(false)
    if (r.error) {
      setErr(r.error)
      return
    }
    setData(r)
  }

  useEffect(() => {
    load()
  }, [])

  const requestUpgrade = () => {
    onOpenSupport?.({
      category: 'other',
      subject: 'ขออัปเกรดเป็น Pro',
      message: 'สวัสดีครับ/ค่ะ ต้องการอัปเกรดบัญชีเป็นแผน Pro กรุณาติดต่อกลับพร้อมวิธีชำระเงิน ขอบคุณครับ/ค่ะ',
    })
  }

  if (loading) {
    return (
      <div className="dash-sub-page">
        <p className="dash-text-muted">กำลังโหลดแผน...</p>
      </div>
    )
  }

  if (err || !data) {
    return (
      <div className="dash-sub-page">
        <p className="dash-text-loss">{err || 'โหลดไม่สำเร็จ'}</p>
        <button type="button" className="dash-sub-retry" onClick={load} style={btnGhost}>ลองใหม่</button>
      </div>
    )
  }

  const isPro = data.plan === 'pro' || data.isOwner
  const expires = fmtExpires(data.planExpiresAt)
  const plans = data.catalog?.plans || []
  const freePlan = plans.find((p) => p.id === 'free')
  const proPlan = plans.find((p) => p.id === 'pro')
  const features = freePlan?.features || []

  const quotaLines = QUOTA_KEYS.map(([key, label]) => quotaLine(data.quota, key, label)).filter(Boolean)

  return (
    <div className="dash-sub-page">
      <div className="dash-sub-hero">
        <div>
          <h2 className="dash-sub-title">แผนการใช้งาน</h2>
          <p className="dash-sub-lead">
            จัดการพอร์ตฟรีได้เต็มที่ — อัปเกรด Pro เพื่อใช้ AI Copilot ได้มากขึ้น
          </p>
        </div>
        <div className={`dash-sub-status${isPro ? ' dash-sub-status--pro' : ''}`}>
          <span className="dash-sub-status-label">แผนปัจจุบัน</span>
          <span className="dash-sub-status-plan">{data.planLabel}</span>
          {data.isOwner && <span className="dash-sub-status-note">โควต้า AI ไม่จำกัด</span>}
          {!data.isOwner && isPro && expires && (
            <span className="dash-sub-status-note">หมดอายุ {expires}</span>
          )}
          {!data.isOwner && isPro && !expires && (
            <span className="dash-sub-status-note">ใช้งาน Pro อยู่</span>
          )}
          {!isPro && <span className="dash-sub-status-note">อีเมล: {user?.email}</span>}
        </div>
      </div>

      {quotaLines.length > 0 && (
        <div className="dash-card dash-sub-quota">
          <h3 className="dash-card-title">โควต้า AI สัปดาห์นี้</h3>
          <div className="dash-sub-quota-grid">
            {quotaLines.map((row) => (
              <div key={row.label} className="dash-sub-quota-item">
                <span className="dash-text-muted">{row.label}</span>
                <span className={row.tone === 'gain' ? 'dash-text-gain' : row.tone === 'loss' ? 'dash-text-loss' : 'dash-text-secondary'}>
                  {row.value}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dash-sub-plans">
        {[freePlan, proPlan].filter(Boolean).map((plan) => (
          <div
            key={plan.id}
            className={`dash-sub-plan${plan.highlight ? ' dash-sub-plan--pro' : ''}${data.plan === plan.id && !data.isOwner ? ' dash-sub-plan--current' : ''}`}
          >
            {plan.highlight && <span className="dash-sub-plan-badge">แนะนำ</span>}
            <h3 className="dash-sub-plan-name">{plan.label}</h3>
            <div className="dash-sub-plan-price">{plan.priceLabel}</div>
            <ul className="dash-sub-plan-features">
              {plan.features.map((f) => (
                <li key={f.id}>
                  <span className="dash-sub-feature-label">{f.label}</span>
                  <span className="dash-sub-feature-val">{plan.id === 'free' ? f.free : f.pro}</span>
                </li>
              ))}
            </ul>
            {plan.id === 'pro' && !isPro && (
              <button type="button" className="dash-sub-upgrade-btn" onClick={requestUpgrade} style={btnPrimary}>
                อัปเกรดเป็น Pro
              </button>
            )}
            {plan.id === 'pro' && isPro && !data.isOwner && (
              <p className="dash-sub-plan-active">✓ แผนที่ใช้อยู่</p>
            )}
            {plan.id === 'free' && !isPro && (
              <p className="dash-sub-plan-active">✓ แผนที่ใช้อยู่</p>
            )}
          </div>
        ))}
      </div>

      {!isPro && (
        <div className="dash-card dash-sub-note">
          <h3 className="dash-card-title" style={{ fontSize: '14px', marginBottom: '10px' }}>วิธีอัปเกรด Pro</h3>
          <ol className="dash-sub-steps">
            <li>กด「อัปเกรดเป็น Pro」ด้านล่าง</li>
            <li>โอนเงินตามช่องทางด้านล่าง</li>
            <li>รอทีมงานยืนยัน (มักภายใน 1 วันทำการ) — แผน Pro จะเปิดให้อัตโนมัติ</li>
          </ol>
          {data.paymentInstructions ? (
            <div className="dash-inset dash-inset--accent" style={{ padding: '12px', marginTop: '12px', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
              {data.paymentInstructions}
            </div>
          ) : (
            <p className="dash-text-muted" style={{ fontSize: '13px', margin: '12px 0 0', lineHeight: 1.65 }}>
              รายละเอียบบัญชีโอนจะส่งให้ทางอีเมลหลังส่งคำขอ — หรือติดต่อทีมงานผ่าน「ช่วยเหลือ」
            </p>
          )}
        </div>
      )}

      {features.length > 0 && (
        <div className="dash-card dash-sub-compare">
          <h3 className="dash-card-title">เปรียบเทียบแผน</h3>
          <div className="dash-sub-table-wrap">
            <table className="dash-sub-table">
              <thead>
                <tr>
                  <th>ฟีเจอร์</th>
                  <th>Free</th>
                  <th>Pro</th>
                </tr>
              </thead>
              <tbody>
                {features.map((f) => (
                  <tr key={f.id}>
                    <td>{f.label}</td>
                    <td>{f.free}</td>
                    <td className="dash-sub-table-pro">{f.pro}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
