import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { TRIP_PLANNER_ENABLED } from '../../lib/appRoutes'
import { btnPrimary, btnGhost } from '../../lib/styles'

function fmtExpires(iso) {
  if (!iso) return null
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

function quotaCard(quota, key, label) {
  if (!quota) return null
  if (quota.isOwner) return { label, remaining: null, limit: null, used: 0, unlimited: true }
  const slot = quota[key]
  const limit = quota.limits?.[key]
  if (!slot) return null
  if (!slot.allowed) {
    const when = slot.nextAvailableAt
      ? new Date(slot.nextAvailableAt).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })
      : null
    return { label, remaining: 0, limit, used: limit ?? 0, exhausted: true, nextAvailableAt: when }
  }
  if (limit != null && slot.remaining != null) {
    return { label, remaining: slot.remaining, limit, used: limit - slot.remaining, exhausted: false }
  }
  return { label, remaining: null, limit: null, used: 0, unlimited: false }
}

const QUOTA_KEYS = [
  ['analyze', 'วิเคราะห์พอร์ต'],
  ['copilot', 'Copilot'],
  ['newsSummary', 'สรุปข่าว'],
  ['tickerJournal', 'สรุป journal หุ้น'],
  ...(TRIP_PLANNER_ENABLED ? [['tripPlan', 'AI จัดทริป']] : []),
]

const HIDDEN_FEATURE_IDS = TRIP_PLANNER_ENABLED ? [] : ['tripPlan', 'tripChat']

const UPGRADE_STATUS = {
  open: 'รอตรวจสลิป',
  in_progress: 'กำลังตรวจสอบ',
}

function fmtBillingDate(iso) {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('th-TH', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function billingMethodLabel(source) {
  if (source === 'omise_promptpay') return 'PromptPay (Omise)'
  if (source === 'omise_card') return 'บัตร (Omise)'
  return source === 'stripe' ? 'บัตร (Stripe)' : 'PromptPay'
}

function billingStatusLabel(row) {
  if (row.source === 'promptpay' || row.source === 'omise_promptpay') {
    if (row.status === 'paid') return 'ชำระแล้ว'
    if (row.status === 'successful') return 'ชำระแล้ว'
    if (row.status === 'pending') return 'รอชำระ'
    if (row.status === 'failed') return 'ไม่สำเร็จ'
    if (row.status === 'expired') return 'หมดเวลา'
    if (row.status === 'open') return 'รอตรวจสลิป'
    if (row.status === 'in_progress') return 'กำลังตรวจ'
    return row.status
  }
  if (row.source === 'omise_card') {
    if (row.status === 'successful' || row.status === 'paid') return 'ชำระแล้ว'
    if (row.status === 'pending') return 'รอชำระ'
    if (row.status === 'failed') return 'ไม่สำเร็จ'
    return row.status
  }
  if (row.status === 'paid') return 'ชำระแล้ว'
  if (row.status === 'open') return 'รอชำระ'
  if (row.status === 'void') return 'ยกเลิก'
  return row.status
}

function billingAmount(row) {
  const amount = row.amountThb ?? row.amount
  if (amount == null) return '—'
  return `฿${Number(amount).toLocaleString('th-TH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`
}

export default function SubscriptionPage({ user, onUserRefresh, onOpenCheckout, flashMessage = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [portalLoading, setPortalLoading] = useState(false)
  const [actionErr, setActionErr] = useState('')
  const [banner, setBanner] = useState(flashMessage)
  const [syncLoading, setSyncLoading] = useState(false)

  const load = async (opts = {}) => {
    setLoading(true)
    setErr('')
    let r = await api.get('/subscription')
    if (!r.error && opts.trySync && r.paymentEnabled) {
      const sync = await api.post('/subscription/sync')
      if (sync.synced) {
        const me = await api.get('/auth/me')
        if (me?.id && onUserRefresh) onUserRefresh(me)
        r = await api.get('/subscription')
        setBanner('อัปเดตสถานะ Pro จาก Stripe แล้ว')
      }
    }
    setLoading(false)
    if (r.error) {
      setErr(r.error)
      return
    }
    setData(r)
    window.__PORTDIARY_OMISE_PKEY = r.omisePublicKey || ''
  }

  useEffect(() => {
    load({ trySync: true })
  }, [])

  useEffect(() => {
    if (flashMessage) setBanner(flashMessage)
  }, [flashMessage])

  const openPortal = async () => {
    setActionErr('')
    setPortalLoading(true)
    const r = await api.post('/subscription/portal')
    setPortalLoading(false)
    if (r.error) {
      setActionErr(r.error)
      return
    }
    if (r.url) window.location.href = r.url
  }

  const cancelOmiseCard = async () => {
    setActionErr('')
    setPortalLoading(true)
    const r = await api.post('/subscription/omise/card/cancel')
    setPortalLoading(false)
    if (r.error) {
      setActionErr(r.error)
      return
    }
    setBanner('ยกเลิกตัดบัตรอัตโนมัติแล้ว')
    await load()
  }

  const refreshAccount = async () => {
    setSyncLoading(true)
    const sync = await api.post('/subscription/sync')
    const me = await api.get('/auth/me')
    if (me?.id && onUserRefresh) onUserRefresh(me)
    await load()
    setSyncLoading(false)
    if (sync.synced) {
      setBanner('อัปเดตสถานะ Pro จาก Stripe แล้ว')
    } else if (sync.reason === 'no_active_subscription') {
      setActionErr('ยังไม่พบการสมัครบัตรที่ใช้งานอยู่ — หากเพิ่งชำระ รอสักครู่แล้วลองอีกครั้ง')
    }
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
  const features = (freePlan?.features || []).filter((f) => !HIDDEN_FEATURE_IDS.includes(f.id))
  const proPrice = data.catalog?.proMonthlyThb || 99
  const pending = data.pendingUpgradeTicket
  const isStripePro = isPro && data.hasStripeSubscription
  const isOmiseCardPro = isPro && data.hasOmiseSubscription
  const isManualPro = isPro && data.proPaymentSource === 'manual'
  const canOpenCheckout = !data.isOwner
  const needsPay = !data.isOwner && (!isPro || isManualPro)
  const showStripeManage = !data.isOwner && isStripePro
  const showOmiseManage = !data.isOwner && isOmiseCardPro
  const billingHistory = data.billingHistory || []
  const stripeCancelled = data.stripeSubscription?.cancelAtPeriodEnd
  const stripeAuto = data.paymentEnabled && data.paymentMode === 'stripe'
  const omisePending = !!data.omisePending

  const quotaCards = QUOTA_KEYS.map(([key, label]) => quotaCard(data.quota, key, label)).filter(Boolean)

  let statusNote = null
  if (data.isOwner) statusNote = 'โควต้า AI ไม่จำกัด'
  else if (!isPro) statusNote = user?.email || null
  else if (stripeCancelled && expires) statusNote = `ยกเลิกบัตรแล้ว — ใช้ได้ถึง ${expires}`
  else if (isManualPro) statusNote = 'ชำระผ่าน PromptPay — ต่ออายุด้วยมือ'
  else if (data.proPaymentSource === 'omise_card') statusNote = 'ต่ออายุอัตโนมัติด้วยบัตร (Omise)'
  else if (data.proPaymentSource === 'stripe') statusNote = 'ต่ออายุอัตโนมัติด้วยบัตร'
  else if (expires) statusNote = `หมดอายุ ${expires}`

  return (
    <div className="dash-sub-page">
      <div className="dash-sub-hero">
        <div>
          <h2 className="dash-sub-title">แผนการใช้งาน</h2>
          <p className="dash-sub-lead">
            จัดการพอร์ตฟรีได้เต็มที่ — อัปเกรด Pro เพื่อใช้ AI ได้มากขึ้น
          </p>
        </div>
        <div className={`dash-sub-status${isPro ? ' dash-sub-status--pro' : ''}`}>
          <span className="dash-sub-status-label">แผนปัจจุบัน</span>
          <span className="dash-sub-status-plan">{data.planLabel}</span>
          {isPro && expires && !stripeCancelled && (
            <span className="dash-sub-status-note">หมดอายุ {expires}</span>
          )}
          {statusNote && <span className="dash-sub-status-note">{statusNote}</span>}
        </div>
      </div>

      {banner && (
        <div className="dash-inset dash-sub-banner" style={{ padding: '12px 14px', marginBottom: '16px' }}>
          <p className="dash-text-gain" style={{ margin: 0, fontSize: '14px' }}>{banner}</p>
          <button type="button" className="dash-link-btn" style={{ marginTop: '8px' }} onClick={refreshAccount} disabled={syncLoading}>
            {syncLoading ? 'กำลังซิงค์...' : 'รีเฟรชสถานะแผน'}
          </button>
        </div>
      )}

      {stripeAuto && !data.isOwner && !isStripePro && (
        <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '12px' }}>
          ชำระด้วยบัตรแล้วแต่สถานะยังไม่เปลี่ยน?{' '}
          <button type="button" className="dash-link-btn" onClick={refreshAccount} disabled={syncLoading}>
            {syncLoading ? 'กำลังซิงค์...' : 'ซิงค์จาก Stripe'}
          </button>
        </p>
      )}

      {stripeCancelled && isPro && !data.isOwner && (
        <div className="dash-inset dash-sub-cancel-notice">
          <p className="dash-text-secondary" style={{ margin: 0, fontSize: '14px' }}>
            ยกเลิกการต่ออายุด้วยบัตรแล้ว — แผน Pro ยังใช้ได้จนถึง <strong>{expires}</strong>
          </p>
        </div>
      )}

      {actionErr && (
        <p className="dash-text-loss" style={{ marginBottom: '12px', fontSize: '14px' }}>{actionErr}</p>
      )}

      {canOpenCheckout && (
        <div className="dash-card dash-sub-pay-strip">
          <div className="dash-sub-pay-strip-copy">
            <p className="dash-checkout-kicker">ช่องทางชำระเงิน</p>
            <h3 className="dash-sub-pay-strip-title">
              {needsPay
                ? (isManualPro ? `ต่ออายุ Pro — ฿${proPrice}/เดือน` : `อัปเกรดเป็น Pro — ฿${proPrice}/เดือน`)
                : 'จัดการ / ดูช่องทางชำระเงิน'}
            </h3>
            <p className="dash-sub-pay-strip-desc">
              ชุด 1 พร้อมใช้: PromptPay (manual) + บัตร Stripe
              {omisePending ? ' · ชุด 2 Omise รอยืนยัน' : ' · ชุด 2 Omise พร้อมใช้'}
            </p>
          </div>
          <div className="dash-sub-pay-strip-actions">
            <button type="button" onClick={onOpenCheckout} style={btnPrimary}>
              ไปหน้า Checkout
            </button>
            {showStripeManage && (
              <button type="button" onClick={openPortal} style={btnGhost} disabled={portalLoading}>
                {portalLoading ? 'กำลังเปิด...' : 'จัดการบัตร Stripe'}
              </button>
            )}
            {showOmiseManage && (
              <button type="button" onClick={cancelOmiseCard} style={btnGhost} disabled={portalLoading}>
                {portalLoading ? 'กำลังยกเลิก...' : 'ยกเลิกตัดบัตร Omise'}
              </button>
            )}
          </div>
        </div>
      )}

      {pending && (
        <div className="dash-inset" style={{ padding: '12px 14px', marginBottom: '16px', borderColor: 'var(--accent)' }}>
          <p className="dash-text-secondary" style={{ margin: 0, fontSize: '14px' }}>
            คำขอ PromptPay #{pending.id} — <strong>{UPGRADE_STATUS[pending.status] || pending.status}</strong>
            {' '}({new Date(pending.created_at).toLocaleDateString('th-TH')})
          </p>
          <p className="dash-text-muted" style={{ margin: '6px 0 0', fontSize: '13px' }}>
            ทีมงานจะตรวจสลิปและเปิด Pro ให้ทางอีเมล
          </p>
        </div>
      )}

      {quotaCards.length > 0 && (
        <div className="dash-card dash-sub-quota">
          <h3 className="dash-card-title">โควต้า AI สัปดาห์นี้</h3>
          <div className="dash-sub-quota-grid">
            {quotaCards.map((card) => (
              <div key={card.label} className={`dash-sub-quota-card${card.exhausted ? ' dash-sub-quota-card--exhausted' : ''}`}>
                <div className="dash-sub-quota-card-head">
                  <span className="dash-sub-quota-card-label">{card.label}</span>
                  {card.unlimited ? (
                    <span className="dash-sub-quota-card-num dash-text-gain">∞</span>
                  ) : card.exhausted ? (
                    <span className="dash-sub-quota-card-num dash-text-loss">0</span>
                  ) : (
                    <span className="dash-sub-quota-card-num">
                      <strong>{card.remaining}</strong>
                      <span className="dash-sub-quota-card-of">/{card.limit}</span>
                    </span>
                  )}
                </div>
                {!card.unlimited && card.limit != null && (
                  <div className="dash-sub-quota-bar" aria-hidden>
                    <div
                      className="dash-sub-quota-bar-fill"
                      style={{ width: `${Math.max(0, Math.min(100, (card.remaining / card.limit) * 100))}%` }}
                    />
                  </div>
                )}
                <span className="dash-sub-quota-card-foot">
                  {card.unlimited && 'ไม่จำกัด'}
                  {!card.unlimited && !card.exhausted && `ใช้ไป ${card.used} ครั้ง`}
                  {card.exhausted && (card.nextAvailableAt ? `ครบโควต้า · รีเซ็ต ${card.nextAvailableAt}` : 'ครบโควต้าแล้ว')}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="dash-sub-plans">
        {[freePlan, proPlan].filter(Boolean).map((plan) => {
          const isCurrent = data.plan === plan.id && !data.isOwner
          return (
            <div
              key={plan.id}
              className={`dash-sub-plan${plan.highlight ? ' dash-sub-plan--pro' : ''}${isCurrent ? ' dash-sub-plan--current' : ''}`}
            >
              {plan.highlight && <span className="dash-sub-plan-badge">แนะนำ</span>}
              <h3 className="dash-sub-plan-name">{plan.label}</h3>
              <div className="dash-sub-plan-price">{plan.priceLabel}</div>
              <ul className="dash-sub-plan-features">
                {plan.features.filter((f) => !HIDDEN_FEATURE_IDS.includes(f.id)).map((f) => (
                  <li key={f.id}>
                    <span className="dash-sub-feature-label">{f.label}</span>
                    <span className="dash-sub-feature-val">{plan.id === 'free' ? f.free : f.pro}</span>
                  </li>
                ))}
              </ul>
              {plan.id === 'pro' && canOpenCheckout && (
                <div className="dash-sub-plan-actions">
                  {isPro && !data.isOwner && <p className="dash-sub-plan-active">✓ แผนที่ใช้อยู่</p>}
                  <button
                    type="button"
                    className="dash-sub-upgrade-btn"
                    onClick={onOpenCheckout}
                    style={needsPay ? btnPrimary : btnGhost}
                  >
                    {needsPay ? 'ไปหน้า Checkout' : 'ดูช่องทางชำระเงิน'}
                  </button>
                </div>
              )}
              {plan.id === 'free' && !isPro && (
                <p className="dash-sub-plan-active">✓ แผนที่ใช้อยู่</p>
              )}
            </div>
          )
        })}
      </div>

      {billingHistory.length > 0 && (
        <div className="dash-card dash-sub-compare">
          <h3 className="dash-card-title">ประวัติการชำระเงิน</h3>
          <div className="dash-sub-table-wrap">
            <table className="dash-sub-table">
              <thead>
                <tr>
                  <th>วันที่</th>
                  <th>รายการ</th>
                  <th>ช่องทาง</th>
                  <th>จำนวน</th>
                  <th>สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {billingHistory.map((row) => (
                  <tr key={row.id}>
                    <td>{fmtBillingDate(row.paidAt || row.createdAt)}</td>
                    <td>
                      {row.description}
                      {row.invoiceUrl && (
                        <>
                          {' '}
                          <a href={row.invoiceUrl} target="_blank" rel="noopener noreferrer" className="dash-link-btn">
                            ใบเสร็จ
                          </a>
                        </>
                      )}
                    </td>
                    <td>{billingMethodLabel(row.source)}</td>
                    <td>{billingAmount(row)}</td>
                    <td>{billingStatusLabel(row)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
