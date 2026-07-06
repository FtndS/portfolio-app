import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost } from '../../lib/styles'
import TicketImagePicker, { buildAttachmentsPayload } from '../support/TicketImagePicker'

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
  return source === 'stripe' ? 'บัตร (Stripe)' : 'PromptPay'
}

function billingStatusLabel(row) {
  if (row.source === 'promptpay') {
    if (row.status === 'paid') return 'ชำระแล้ว'
    if (row.status === 'open') return 'รอตรวจสลิป'
    if (row.status === 'in_progress') return 'กำลังตรวจ'
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
  const [actionErr, setActionErr] = useState('')
  const [banner, setBanner] = useState(flashMessage)
  const [slipFiles, setSlipFiles] = useState([])
  const [slipErr, setSlipErr] = useState('')
  const [submittingSlip, setSubmittingSlip] = useState(false)
  const [slipMsg, setSlipMsg] = useState('')
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

  const submitPromptPay = async (renew = false) => {
    setSlipErr('')
    setSlipMsg('')
    if (!slipFiles.length) {
      setSlipErr('กรุณาแนบสลิปการโอน')
      return
    }
    setSubmittingSlip(true)
    try {
      const attachmentsBase64 = await buildAttachmentsPayload(slipFiles)
      const price = data?.catalog?.proMonthlyThb || 99
      const message = [
        renew ? `ขอต่ออายุแผน Pro (฿${price}/เดือน)` : `ขออัปเกรดบัญชีเป็นแผน Pro (฿${price}/เดือน)`,
        '',
        `อีเมลบัญชี: ${user?.email || '—'}`,
        `ชื่อ: ${user?.name || '—'}`,
        `User ID: ${user?.id || '—'}`,
        'ช่องทาง: PromptPay (manual)',
        '',
        'แนบสลิปการโอนแล้ว — รอทีมงานยืนยันและเปิด Pro',
      ].join('\n')

      const r = await api.post('/support', {
        category: 'upgrade',
        subject: renew ? 'ขอต่ออายุ Pro (PromptPay)' : 'ขออัปเกรดเป็น Pro (PromptPay)',
        message,
        attachmentsBase64,
      })
      if (r.error) {
        setSlipErr(r.error)
        return
      }
      setSlipMsg('ส่งสลิปแล้ว — ทีมงานจะตรวจและเปิด Pro ภายใน 1 วันทำการ')
      setSlipFiles([])
      await load()
    } catch {
      setSlipErr('ส่งคำขอไม่สำเร็จ — ลองใหม่อีกครั้ง')
    } finally {
      setSubmittingSlip(false)
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
  const qrUrl = data.paymentQrUrl || '/promptpay-qr-99.png'
  const pending = data.pendingUpgradeTicket
  const isStripePro = isPro && data.hasStripeSubscription
  const isManualPro = isPro && data.proPaymentSource === 'manual'
  const showPayChooser = !data.isOwner && (!isPro || isManualPro)
  const showStripeManage = !data.isOwner && isStripePro
  const billingHistory = data.billingHistory || []
  const stripeCancelled = data.stripeSubscription?.cancelAtPeriodEnd

  const quotaCards = QUOTA_KEYS.map(([key, label]) => quotaCard(data.quota, key, label)).filter(Boolean)

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
          {!data.isOwner && isPro && data.proPaymentSource === 'stripe' && !stripeCancelled && (
            <span className="dash-sub-status-note">ต่ออายุอัตโนมัติด้วยบัตร</span>
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

      {showPayChooser && (
        <div className="dash-card dash-sub-note">
          <h3 className="dash-card-title" style={{ fontSize: '14px', marginBottom: '6px' }}>
            {isManualPro ? 'ต่ออายุ Pro' : 'อัปเกรดเป็น Pro'} — ฿{proPrice}/เดือน
          </h3>
          <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '14px' }}>
            เลือกช่องทางชำระเงิน
          </p>

          <div className="dash-segment dash-sub-pay-tabs" style={{ marginBottom: '16px' }}>
            {stripeAuto && (
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
              PromptPay — สลิป
            </button>
          </div>

          {payMethod === 'card' && stripeAuto && (
            <div className="dash-sub-pay-panel">
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
              {isManualPro && (
                <p className="dash-text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
                  สมัครบัตรจะต่ออายุอัตโนมัติแทน PromptPay — Pro ปัจจุบันยังใช้ได้จนหมดอายุ
                </p>
              )}
            </div>
          )}

          {payMethod === 'promptpay' && (
            <div className="dash-sub-pay-panel">
              <ol className="dash-sub-steps">
                <li>สแกน QR PromptPay โอน <strong>฿{proPrice}</strong></li>
                <li>อัปโหลดสลิป — ทีมงานตรวจภายใน 1 วันทำการ</li>
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
                  <p className="dash-text-muted" style={{ fontSize: '12px', textAlign: 'center', margin: '8px 0 0' }}>
                    PortDiary · ฿{proPrice}.00
                  </p>
                </div>

                <div className="dash-sub-receipt">
                  <TicketImagePicker
                    files={slipFiles}
                    onChange={setSlipFiles}
                    err={slipErr}
                    setErr={setSlipErr}
                  />
                  <p className="dash-text-muted" style={{ fontSize: '12px', marginTop: '8px' }}>
                    บัญชี: <strong>{user?.email}</strong>
                  </p>
                  {slipMsg && <p className="dash-text-gain" style={{ fontSize: '13px', marginTop: '10px' }}>{slipMsg}</p>}
                  <button
                    type="button"
                    onClick={() => submitPromptPay(isManualPro)}
                    style={{ ...btnPrimary, marginTop: '12px', width: '100%' }}
                    disabled={submittingSlip || !!pending}
                  >
                    {submittingSlip ? 'กำลังส่ง...' : pending ? 'รอตรวจสลิปอยู่' : (isManualPro ? 'ส่งสลิปต่ออายุ Pro' : 'ส่งสลิปอัปเกรด Pro')}
                  </button>
                </div>
              </div>

              {data.paymentInstructions && (
                <div className="dash-inset" style={{ padding: '12px', marginTop: '14px', whiteSpace: 'pre-wrap', fontSize: '13px' }}>
                  {data.paymentInstructions}
                </div>
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
