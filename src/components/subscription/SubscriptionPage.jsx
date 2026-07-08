import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost, inp } from '../../lib/styles'

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
]
const PAYMENT_MAINTENANCE_POPUP_SEEN_KEY = 'portdiary_payment_maintenance_popup_seen'

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

export default function SubscriptionPage({ user, onUserRefresh, flashMessage = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [payMethod, setPayMethod] = useState('card')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [portalLoading, setPortalLoading] = useState(false)
  const [omiseCardLoading, setOmiseCardLoading] = useState(false)
  const [actionErr, setActionErr] = useState('')
  const [banner, setBanner] = useState(flashMessage)
  const [creatingPromptPay, setCreatingPromptPay] = useState(false)
  const [promptPayState, setPromptPayState] = useState(null)
  const [promptPayErr, setPromptPayErr] = useState('')
  const [syncLoading, setSyncLoading] = useState(false)
  const [showMaintenancePopup, setShowMaintenancePopup] = useState(false)
  const [cardForm, setCardForm] = useState({
    name: user?.name || '',
    number: '',
    month: '',
    year: '',
    cvc: '',
  })

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
    if (!r.paymentEnabled || r.proPaymentSource === 'manual') {
      setPayMethod('promptpay')
    } else {
      setPayMethod('card')
    }
  }

  useEffect(() => {
    load({ trySync: true })
  }, [])

  useEffect(() => {
    if (flashMessage) setBanner(flashMessage)
  }, [flashMessage])

  useEffect(() => {
    if (!data?.omiseCardEnabled) return
    if (document.getElementById('omise-js-sdk')) return
    const s = document.createElement('script')
    s.id = 'omise-js-sdk'
    s.src = 'https://cdn.omise.co/omise.js'
    s.async = true
    document.body.appendChild(s)
  }, [data?.omiseCardEnabled])

  const startCheckout = async () => {
    setActionErr('')
    setCheckoutLoading(true)
    const r = await api.post('/subscription/checkout')
    setCheckoutLoading(false)
    if (r.error) {
      setActionErr(r.error)
      return
    }
    if (r.url) {
      window.location.href = r.url
      return
    }
    setActionErr('ไม่สามารถเปิดหน้าชำระเงินได้')
  }

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

  const subscribeOmiseCard = async () => {
    setActionErr('')
    if (!window.Omise) {
      setActionErr('ยังโหลด Omise.js ไม่สำเร็จ กรุณารีเฟรชหน้า')
      return
    }
    const pkey = window.__PORTDIARY_OMISE_PKEY || ''
    if (!pkey) {
      setActionErr('ยังไม่ได้ตั้งค่า OMISE_PUBLIC_KEY')
      return
    }
    setOmiseCardLoading(true)
    window.Omise.setPublicKey(pkey)
    const tokenResult = await new Promise((resolve) => {
      window.Omise.createToken('card', {
        name: cardForm.name,
        number: cardForm.number.replace(/\s+/g, ''),
        expiration_month: cardForm.month,
        expiration_year: cardForm.year,
        security_code: cardForm.cvc,
      }, (statusCode, response) => {
        if (statusCode === 200 && response?.id) resolve({ ok: true, token: response.id })
        else resolve({ ok: false, error: response?.message || 'สร้าง token บัตรไม่สำเร็จ' })
      })
    })
    if (!tokenResult.ok) {
      setOmiseCardLoading(false)
      setActionErr(tokenResult.error)
      return
    }
    const r = await api.post('/subscription/omise/card/subscribe', { cardToken: tokenResult.token })
    setOmiseCardLoading(false)
    if (r.error) {
      setActionErr(r.error)
      return
    }
    setBanner('สมัครตัดบัตรอัตโนมัติผ่าน Omise แล้ว')
    await load()
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

  const startPromptPayCheckout = async () => {
    setPromptPayErr('')
    setCreatingPromptPay(true)
    const r = await api.post('/subscription/promptpay/checkout')
    setCreatingPromptPay(false)
    if (r.error) {
      setPromptPayErr(r.error)
      return
    }
    setPromptPayState(r)
  }

  const syncPromptPay = async (chargeId) => {
    const r = await api.post(`/subscription/promptpay/${encodeURIComponent(chargeId)}/sync`)
    if (r.error) return
    setPromptPayState((prev) => ({ ...(prev || {}), ...r }))
    if (r.granted || r.status === 'successful') {
      const me = await api.get('/auth/me')
      if (me?.id && onUserRefresh) onUserRefresh(me)
      await load()
      setBanner('ชำระ PromptPay สำเร็จแล้ว — เปิด Pro เรียบร้อย')
    }
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

  useEffect(() => {
    const chargeId = promptPayState?.chargeId
    const status = promptPayState?.status
    if (!chargeId || status === 'successful' || status === 'failed' || status === 'expired') {
      return
    }
    const timer = setInterval(() => {
      syncPromptPay(chargeId).catch(() => {})
    }, 5000)
    return () => clearInterval(timer)
  }, [promptPayState?.chargeId, promptPayState?.status])

  useEffect(() => {
    if (!data?.paymentTemporarilyDisabled) {
      setShowMaintenancePopup(false)
      return
    }
    let seen = false
    try {
      seen = window.localStorage.getItem(PAYMENT_MAINTENANCE_POPUP_SEEN_KEY) === '1'
    } catch {
      seen = false
    }
    setShowMaintenancePopup(!seen)
  }, [data?.paymentTemporarilyDisabled])

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
  const proPrice = data.catalog?.proMonthlyThb || 99
  const stripeAuto = data.paymentEnabled && data.paymentMode === 'stripe'
  const omisePromptPay = !!data.omisePromptPayEnabled
  const omiseCardEnabled = !!data.omiseCardEnabled
  const qrUrl = data.paymentQrUrl || '/promptpay-qr-99.png'
  const pending = data.pendingUpgradeTicket
  const isStripePro = isPro && data.hasStripeSubscription
  const isOmiseCardPro = isPro && data.hasOmiseSubscription
  const isManualPro = isPro && data.proPaymentSource === 'manual'
  const showPayChooser = !data.isOwner && (!isPro || isManualPro)
  const showStripeManage = !data.isOwner && isStripePro
  const showOmiseManage = !data.isOwner && isOmiseCardPro
  const billingHistory = data.billingHistory || []
  const stripeCancelled = data.stripeSubscription?.cancelAtPeriodEnd
  const paymentMaintenance = !!data.paymentTemporarilyDisabled

  const quotaCards = QUOTA_KEYS.map(([key, label]) => quotaCard(data.quota, key, label)).filter(Boolean)

  return (
    <div className="dash-sub-page">
      {paymentMaintenance && showMaintenancePopup && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(10, 12, 18, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1100,
            padding: '16px',
          }}
        >
          <div
            className="dash-card"
            style={{
              width: 'min(460px, 100%)',
              borderColor: 'var(--warn)',
              boxShadow: '0 24px 54px rgba(0,0,0,.35)',
            }}
          >
            <h3 className="dash-card-title" style={{ marginBottom: '8px' }}>แจ้งเตือน</h3>
            <p className="dash-text-secondary" style={{ margin: '0 0 14px', fontSize: '15px', fontWeight: 700 }}>
              ปิดปรับปรุงระบบชำระเงินชั่วคราว
            </p>
            <button
              type="button"
              onClick={() => {
                setShowMaintenancePopup(false)
                try {
                  window.localStorage.setItem(PAYMENT_MAINTENANCE_POPUP_SEEN_KEY, '1')
                } catch {
                  // ignore storage failures (private mode / browser policy)
                }
              }}
              style={{ ...btnPrimary, width: '100%' }}
            >
              รับทราบ
            </button>
          </div>
        </div>
      )}

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
          {!data.isOwner && isPro && data.proPaymentSource === 'stripe' && !stripeCancelled && (
            <span className="dash-sub-status-note">ต่ออายุอัตโนมัติด้วยบัตร</span>
          )}
          {!data.isOwner && isPro && data.proPaymentSource === 'omise_card' && (
            <span className="dash-sub-status-note">ต่ออายุอัตโนมัติด้วยบัตร (Omise)</span>
          )}
          {!data.isOwner && isPro && stripeCancelled && expires && (
            <span className="dash-sub-status-note">ยกเลิกบัตรแล้ว — ใช้ได้ถึง {expires}</span>
          )}
          {!data.isOwner && isManualPro && (
            <span className="dash-sub-status-note">ชำระผ่าน PromptPay — ต่ออายุด้วยมือ</span>
          )}
          {!isPro && <span className="dash-sub-status-note">อีเมล: {user?.email}</span>}
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
            {' '}หลังจากนั้นจะไม่หักบัตรอีก
          </p>
        </div>
      )}

      {actionErr && (
        <p className="dash-text-loss" style={{ marginBottom: '12px', fontSize: '14px' }}>{actionErr}</p>
      )}

      {paymentMaintenance && (
        <div
          className="dash-inset"
          style={{
            padding: '14px 16px',
            marginBottom: '16px',
            borderColor: 'var(--warn)',
            background: 'color-mix(in srgb, var(--warn) 14%, transparent)',
          }}
        >
          <p
            className="dash-text-secondary"
            style={{ margin: 0, fontSize: '15px', fontWeight: 700, textAlign: 'center' }}
          >
            ปิดปรับปรุงระบบชำระเงินชั่วคราว
          </p>
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
            {plan.id === 'pro' && isPro && !data.isOwner && (
              <p className="dash-sub-plan-active">✓ แผนที่ใช้อยู่</p>
            )}
            {plan.id === 'free' && !isPro && (
              <p className="dash-sub-plan-active">✓ แผนที่ใช้อยู่</p>
            )}
          </div>
        ))}
      </div>

      {showStripeManage && (
        <div className="dash-card dash-sub-note">
          <h3 className="dash-card-title" style={{ fontSize: '14px', marginBottom: '10px' }}>จัดการแผน Pro (บัตร)</h3>
          <p className="dash-text-muted" style={{ fontSize: '13px', lineHeight: 1.65, margin: '0 0 12px' }}>
            แผน Pro ของคุณต่ออายุอัตโนมัติทุกเดือน — เปลี่ยนบัตรหรือยกเลิกได้จาก Stripe
          </p>
          <button type="button" onClick={openPortal} style={btnPrimary} disabled={portalLoading}>
            {portalLoading ? 'กำลังเปิด...' : 'จัดการการชำระเงิน / ยกเลิก Pro'}
          </button>
          <p className="dash-text-faint" style={{ fontSize: '12px', marginTop: '10px', lineHeight: 1.6 }}>
            ยกเลิกแล้วยังใช้ Pro ได้จนถึงวันหมดอายุรอบปัจจุบัน — หลังจากนั้นจะไม่หักบัตรอีก
          </p>
        </div>
      )}

      {showOmiseManage && (
        <div className="dash-card dash-sub-note">
          <h3 className="dash-card-title" style={{ fontSize: '14px', marginBottom: '10px' }}>จัดการแผน Pro (บัตร Omise)</h3>
          <p className="dash-text-muted" style={{ fontSize: '13px', lineHeight: 1.65, margin: '0 0 12px' }}>
            แผน Pro ของคุณต่ออายุอัตโนมัติทุกเดือน — ยกเลิกการต่ออายุได้ทันที
          </p>
          <button type="button" onClick={cancelOmiseCard} style={btnGhost} disabled={portalLoading}>
            {portalLoading ? 'กำลังยกเลิก...' : 'ยกเลิกตัดบัตรอัตโนมัติ'}
          </button>
        </div>
      )}

      {showPayChooser && !paymentMaintenance && (
        <div className="dash-card dash-sub-note">
          <h3 className="dash-card-title" style={{ fontSize: '14px', marginBottom: '6px' }}>
            {isManualPro ? 'ต่ออายุ Pro' : 'อัปเกรดเป็น Pro'} — ฿{proPrice}/เดือน
          </h3>
          <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '14px' }}>
            เลือกช่องทางชำระเงิน
          </p>

          <div className="dash-segment dash-sub-pay-tabs" style={{ marginBottom: '16px' }}>
            {(stripeAuto || omiseCardEnabled) && (
              <button
                type="button"
                className={`dash-segment-btn${payMethod === 'card' ? ' dash-segment-btn--active' : ''}`}
                onClick={() => setPayMethod('card')}
              >
                บัตร — อัตโนมัติ
              </button>
            )}
            <button
              type="button"
              className={`dash-segment-btn${payMethod === 'promptpay' ? ' dash-segment-btn--active' : ''}`}
              onClick={() => setPayMethod('promptpay')}
            >
              PromptPay
            </button>
          </div>

          {payMethod === 'card' && (stripeAuto || omiseCardEnabled) && (
            <div className="dash-sub-pay-panel">
              {omiseCardEnabled ? (
                <>
                  <ul className="dash-sub-steps">
                    <li>บันทึกบัตรเพื่อหักอัตโนมัติทุกเดือนผ่าน Omise</li>
                    <li>สมัครครั้งเดียว แล้วระบบต่ออายุ Pro อัตโนมัติ</li>
                    <li>ระบบจะยืนยันผ่าน 3DS ตามเงื่อนไขธนาคาร</li>
                  </ul>
                  <div className="dash-sub-receipt" style={{ maxWidth: '420px' }}>
                    <input style={inp({ marginBottom: '8px' })} placeholder="ชื่อบนบัตร" value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} />
                    <input style={inp({ marginBottom: '8px' })} placeholder="เลขบัตร" value={cardForm.number} onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })} />
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                      <input style={inp({ marginBottom: 0 })} placeholder="MM" value={cardForm.month} onChange={(e) => setCardForm({ ...cardForm, month: e.target.value })} />
                      <input style={inp({ marginBottom: 0 })} placeholder="YY" value={cardForm.year} onChange={(e) => setCardForm({ ...cardForm, year: e.target.value })} />
                      <input style={inp({ marginBottom: 0 })} placeholder="CVC" value={cardForm.cvc} onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value })} />
                    </div>
                    <p className="dash-text-muted" style={{ fontSize: '12px', lineHeight: 1.7, marginTop: '10px' }}>
                      ข้อมูลบัตรจะถูกส่งแบบเข้ารหัสไปยัง Omise เพื่อสร้าง token เท่านั้น และ PortDiary จะไม่จัดเก็บเลขบัตรเต็มหรือรหัส CVC ของคุณ
                    </p>
                    <button type="button" onClick={subscribeOmiseCard} style={{ ...btnPrimary, marginTop: '12px' }} disabled={omiseCardLoading}>
                      {omiseCardLoading ? 'กำลังสมัครบัตร...' : `สมัครตัดบัตรอัตโนมัติ — ฿${proPrice}/เดือน`}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <ul className="dash-sub-steps">
                    <li>ต่ออายุอัตโนมัติทุกเดือน — บัตรเครดิต/เดบิต, Apple Pay, Google Pay</li>
                    <li>เปิด Pro ทันทีหลังชำระสำเร็จ</li>
                    <li>ยกเลิกได้จาก <strong>จัดการการชำระเงิน</strong> (ใช้ Pro จนครบรอบบิล)</li>
                  </ul>
                  <button
                    type="button"
                    onClick={startCheckout}
                    style={{ ...btnPrimary, marginTop: '14px' }}
                    disabled={checkoutLoading}
                  >
                    {checkoutLoading ? 'กำลังเปิดหน้าชำระเงิน...' : (isManualPro ? `เปลี่ยนเป็นบัตรอัตโนมัติ — ฿${proPrice}/เดือน` : `ชำระด้วยบัตร — ฿${proPrice}/เดือน`)}
                  </button>
                </>
              )}
            </div>
          )}

          {payMethod === 'promptpay' && (
            <div className="dash-sub-pay-panel">
              {omisePromptPay ? (
                <>
                  <ol className="dash-sub-steps">
                    <li>กดสร้าง QR แล้วสแกน PromptPay โอน <strong>฿{proPrice}</strong></li>
                    <li>ระบบตรวจสอบการชำระให้อัตโนมัติผ่าน Omise</li>
                    <li>ชำระสำเร็จแล้วเปิด Pro ทันที</li>
                  </ol>
                  {!promptPayState?.chargeId && (
                    <button
                      type="button"
                      onClick={startPromptPayCheckout}
                      style={{ ...btnPrimary, marginTop: '12px' }}
                      disabled={creatingPromptPay}
                    >
                      {creatingPromptPay ? 'กำลังสร้าง QR...' : `สร้าง PromptPay QR — ฿${proPrice}`}
                    </button>
                  )}
                  {promptPayErr && (
                    <p className="dash-text-loss" style={{ fontSize: '13px', marginTop: '10px' }}>{promptPayErr}</p>
                  )}
                  {promptPayState?.chargeId && (
                    <div className="dash-sub-payment" style={{ marginTop: '12px' }}>
                      <div className="dash-sub-qr-wrap">
                        <img
                          src={promptPayState.qrImageUrl}
                          alt={`PromptPay QR ฿${proPrice} PortDiary`}
                          className="dash-sub-qr"
                          width={280}
                          height={380}
                        />
                        <p className="dash-text-muted" style={{ fontSize: '12px', textAlign: 'center', margin: '8px 0 0' }}>
                          สถานะ: <strong>{billingStatusLabel({ source: 'omise_promptpay', status: promptPayState.status })}</strong>
                        </p>
                        {promptPayState.expiresAt && (
                          <p className="dash-text-muted" style={{ fontSize: '12px', textAlign: 'center', margin: '6px 0 0' }}>
                            หมดอายุ QR: {new Date(promptPayState.expiresAt).toLocaleString('th-TH')}
                          </p>
                        )}
                      </div>
                      <div className="dash-sub-receipt">
                        <p className="dash-text-muted" style={{ fontSize: '13px', lineHeight: 1.7 }}>
                          ระบบจะรีเฟรชสถานะทุก 5 วินาทีอัตโนมัติ
                        </p>
                        <button
                          type="button"
                          className="dash-sub-retry"
                          style={{ ...btnGhost, width: '100%', marginTop: '10px' }}
                          onClick={() => syncPromptPay(promptPayState.chargeId)}
                        >
                          รีเฟรชสถานะตอนนี้
                        </button>
                        <button
                          type="button"
                          style={{ ...btnPrimary, width: '100%', marginTop: '10px' }}
                          onClick={startPromptPayCheckout}
                        >
                          สร้าง QR ใหม่
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  <ol className="dash-sub-steps">
                    <li>สแกน QR PromptPay โอน <strong>฿{proPrice}</strong></li>
                    <li>ส่งสลิปผ่านเมนู Support เพื่อให้ทีมงานเปิด Pro</li>
                    <li>ต่ออายุทุกเดือนด้วยตัวเอง (ไม่หักอัตโนมัติ)</li>
                  </ol>
                  <div className="dash-sub-payment">
                    <div className="dash-sub-qr-wrap">
                      <img
                        src={qrUrl}
                        alt={`PromptPay QR ฿${proPrice} PortDiary`}
                        className="dash-sub-qr"
                        width={280}
                        height={380}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      )}

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

      <div className="dash-card dash-sub-compare" style={{ marginTop: 0 }}>
        <h3 className="dash-card-title">เปรียบเทียบช่องทางชำระ</h3>
        <div className="dash-sub-table-wrap">
          <table className="dash-sub-table">
            <thead>
              <tr>
                <th />
                <th>บัตร (Stripe)</th>
                <th>PromptPay</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>เปิด Pro</td>
                <td>ทันที</td>
                <td>ภายใน 1 วันทำการ</td>
              </tr>
              <tr>
                <td>ต่ออายุ</td>
                <td>อัตโนมัติทุกเดือน</td>
                <td>โอน + ส่งสลิปเอง</td>
              </tr>
              <tr>
                <td>ยกเลิก</td>
                <td>จัดการการชำระเงินใน Stripe</td>
                <td>ไม่ต่ออายุเมื่อหมดอายุ</td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
