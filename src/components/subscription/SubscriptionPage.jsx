import { useState, useEffect, useRef } from 'react'
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

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

const QUOTA_KEYS = [
  ['analyze', 'วิเคราะห์พอร์ต'],
  ['copilot', 'Copilot'],
  ['newsSummary', 'สรุปข่าว'],
  ['tickerJournal', 'สรุป journal หุ้น'],
]

export default function SubscriptionPage({ user }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [receiptFile, setReceiptFile] = useState(null)
  const [receiptPreview, setReceiptPreview] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitMsg, setSubmitMsg] = useState('')
  const [submitErr, setSubmitErr] = useState('')
  const paymentRef = useRef(null)

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

  const scrollToPayment = () => {
    paymentRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  const onReceiptChange = (e) => {
    const file = e.target.files?.[0]
    setSubmitErr('')
    setSubmitMsg('')
    if (!file) {
      setReceiptFile(null)
      setReceiptPreview('')
      return
    }
    if (!/^image\/(png|jpeg|jpg|webp)$/i.test(file.type)) {
      setSubmitErr('ใช้ไฟล์รูป JPG หรือ PNG เท่านั้น')
      return
    }
    if (file.size > 1.5 * 1024 * 1024) {
      setSubmitErr('ไฟล์ใหญ่เกิน 1.5 MB')
      return
    }
    setReceiptFile(file)
    setReceiptPreview(URL.createObjectURL(file))
  }

  const submitUpgrade = async () => {
    setSubmitErr('')
    setSubmitMsg('')
    if (!receiptFile) {
      setSubmitErr('กรุณาแนบสลิปการโอนเงิน')
      return
    }
    setSubmitting(true)
    try {
      const receiptBase64 = await fileToDataUrl(receiptFile)
      const price = data?.catalog?.proMonthlyThb || 99
      const message = [
        `ขออัปเกรดบัญชีเป็นแผน Pro (฿${price}/เดือน)`,
        '',
        `อีเมลบัญชี: ${user?.email || '—'}`,
        `ชื่อ: ${user?.name || '—'}`,
        `User ID: ${user?.id || '—'}`,
        '',
        'แนบสลิปการโอน PromptPay แล้ว — รอทีมงานยืนยันและเปิด Pro',
      ].join('\n')

      const r = await api.post('/support', {
        category: 'upgrade',
        subject: 'ขออัปเกรดเป็น Pro',
        message,
        receiptBase64,
      })
      if (r.error) {
        setSubmitErr(r.error)
        return
      }
      setSubmitMsg('ส่งคำขอแล้ว — ทีมงานจะตรวจสลิปและเปิด Pro ให้ภายใน 1 วันทำการ')
      setReceiptFile(null)
      setReceiptPreview('')
    } catch {
      setSubmitErr('ส่งคำขอไม่สำเร็จ — ลองใหม่อีกครั้ง')
    } finally {
      setSubmitting(false)
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
  const qrUrl = data.paymentQrUrl || '/promptpay-qr-99.png'

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
              <button type="button" className="dash-sub-upgrade-btn" onClick={scrollToPayment} style={btnPrimary}>
                อัปเกรดเป็น Pro — ฿{proPrice}
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
        <div className="dash-card dash-sub-note" ref={paymentRef}>
          <h3 className="dash-card-title" style={{ fontSize: '14px', marginBottom: '10px' }}>ช่องทางชำระเงิน</h3>
          <ol className="dash-sub-steps">
            <li>สแกน QR PromptPay โอน <strong>฿{proPrice}</strong> (ราคาเปิดตัว)</li>
            <li>อัปโหลดสลิปด้านล่าง — ระบบแนบอีเมล <strong>{user?.email}</strong> ให้อัตโนมัติ</li>
            <li>กดส่งคำขอ — ทีมงานจะได้ Ticket + อีเมลแจ้งเตือนเพื่อเปิด Pro</li>
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
              <label className="dash-text-muted" style={{ fontSize: '12px', display: 'block', marginBottom: '8px' }}>
                อัปโหลดสลิปการโอน (JPG/PNG)
              </label>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={onReceiptChange}
                className="dash-sub-file"
              />
              {receiptPreview && (
                <img src={receiptPreview} alt="ตัวอย่างสลิป" className="dash-sub-receipt-preview" />
              )}
              {submitErr && <p className="dash-text-loss" style={{ fontSize: '13px', marginTop: '10px' }}>{submitErr}</p>}
              {submitMsg && <p className="dash-text-gain" style={{ fontSize: '13px', marginTop: '10px' }}>{submitMsg}</p>}
              <button
                type="button"
                onClick={submitUpgrade}
                style={{ ...btnPrimary, marginTop: '12px', width: '100%' }}
                disabled={submitting}
              >
                {submitting ? 'กำลังส่ง...' : 'ส่งคำขออัปเกรด Pro'}
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
