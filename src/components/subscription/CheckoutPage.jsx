import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost, inp } from '../../lib/styles'

const PAYMENT_MAINTENANCE_POPUP_SEEN_KEY = 'portdiary_payment_maintenance_popup_seen'

function billingStatusLabel(row) {
  if (row.source === 'promptpay' || row.source === 'omise_promptpay') {
    if (row.status === 'paid' || row.status === 'successful') return 'ชำระแล้ว'
    if (row.status === 'pending') return 'รอชำระ'
    if (row.status === 'failed') return 'ไม่สำเร็จ'
    if (row.status === 'expired') return 'หมดเวลา'
    if (row.status === 'open') return 'รอตรวจสลิป'
    if (row.status === 'in_progress') return 'กำลังตรวจ'
    return row.status
  }
  return row.status
}

export default function CheckoutPage({ user, onUserRefresh, onBackToPlan, flashMessage = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [payMethod, setPayMethod] = useState('card')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [omiseCardLoading, setOmiseCardLoading] = useState(false)
  const [actionErr, setActionErr] = useState('')
  const [banner, setBanner] = useState(flashMessage)
  const [creatingPromptPay, setCreatingPromptPay] = useState(false)
  const [promptPayState, setPromptPayState] = useState(null)
  const [promptPayErr, setPromptPayErr] = useState('')
  const [showMaintenancePopup, setShowMaintenancePopup] = useState(false)
  const [cardForm, setCardForm] = useState({
    name: user?.name || '',
    number: '',
    month: '',
    year: '',
    cvc: '',
  })

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
    window.__PORTDIARY_OMISE_PKEY = r.omisePublicKey || ''
    if (!r.paymentEnabled || r.proPaymentSource === 'manual') {
      setPayMethod('promptpay')
    } else {
      setPayMethod('card')
    }
  }

  useEffect(() => {
    load()
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
    const me = await api.get('/auth/me')
    if (me?.id && onUserRefresh) onUserRefresh(me)
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

  useEffect(() => {
    const chargeId = promptPayState?.chargeId
    const status = promptPayState?.status
    if (!chargeId || status === 'successful' || status === 'failed' || status === 'expired') {
      return undefined
    }
    const timer = setInterval(() => {
      syncPromptPay(chargeId).catch(() => {})
    }, 5000)
    return () => clearInterval(timer)
  }, [promptPayState?.chargeId, promptPayState?.status])

  if (loading) {
    return (
      <div className="dash-sub-page">
        <p className="dash-text-muted">กำลังโหลดตะกร้า...</p>
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
  const proPrice = data.catalog?.proMonthlyThb || 99
  const stripeAuto = data.paymentEnabled && data.paymentMode === 'stripe'
  const omisePromptPay = !!data.omisePromptPayEnabled
  const omiseCardEnabled = !!data.omiseCardEnabled
  const qrUrl = data.paymentQrUrl || '/promptpay-qr-99.png'
  const isManualPro = isPro && data.proPaymentSource === 'manual'
  const alreadyAutoPro = isPro && !isManualPro && !data.isOwner
  const canCheckout = !data.isOwner && (!isPro || isManualPro)
  const paymentMaintenance = !!data.paymentTemporarilyDisabled

  return (
    <div className="dash-sub-page dash-checkout-page">
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
          <div className="dash-card" style={{ width: 'min(460px, 100%)', borderColor: 'var(--warn)' }}>
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
                  // ignore
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
          <button type="button" className="dash-link-btn" onClick={onBackToPlan} style={{ marginBottom: '8px' }}>
            ← กลับหน้าแผน Pro
          </button>
          <h2 className="dash-sub-title">Checkout</h2>
          <p className="dash-sub-lead">
            ตรวจสอบรายการในตะกร้า แล้วเลือกช่องทางชำระเงิน
          </p>
        </div>
      </div>

      {banner && (
        <div className="dash-inset dash-sub-banner" style={{ padding: '12px 14px', marginBottom: '16px' }}>
          <p className="dash-text-gain" style={{ margin: 0, fontSize: '14px' }}>{banner}</p>
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
          <p className="dash-text-secondary" style={{ margin: 0, fontSize: '15px', fontWeight: 700, textAlign: 'center' }}>
            ปิดปรับปรุงระบบชำระเงินชั่วคราว
          </p>
        </div>
      )}

      <div className="dash-checkout-grid">
        <section className="dash-card dash-checkout-cart">
          <h3 className="dash-card-title">ตะกร้าสินค้า (Cart)</h3>
          <table className="dash-sub-table">
            <thead>
              <tr>
                <th>รายการ</th>
                <th>จำนวน</th>
                <th>ราคา</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>
                  <strong>PortDiary Pro</strong>
                  <div className="dash-text-muted" style={{ fontSize: '13px', marginTop: '4px' }}>
                    โควตา AI สูงขึ้น · Copilot ถามเองได้ · ต่ออายุรายเดือน
                  </div>
                  <div className="dash-text-faint" style={{ fontSize: '12px', marginTop: '6px' }}>
                    บริการดิจิทัล / ไม่มีการจัดส่งสินค้า
                  </div>
                </td>
                <td>1</td>
                <td>฿{proPrice} / เดือน</td>
              </tr>
            </tbody>
          </table>
          <div className="dash-checkout-total">
            <span>ยอดชำระ</span>
            <strong>฿{proPrice} / เดือน</strong>
          </div>
          <ul className="dash-text-muted" style={{ fontSize: '13px', lineHeight: 1.7, margin: '14px 0 0', paddingLeft: '18px' }}>
            <li>ชำระผ่าน Omise (บัตรหรือ PromptPay)</li>
            <li>เปิด Pro หลังชำระสำเร็จ</li>
            <li>
              นโยบาย:{' '}
              <a href="/refund.html" className="dash-link-btn" target="_blank" rel="noreferrer">ยกเลิกและคืนเงิน</a>
              {' · '}
              <a href="/terms.html" className="dash-link-btn" target="_blank" rel="noreferrer">ข้อกำหนด</a>
            </li>
          </ul>
        </section>

        <section className="dash-card dash-checkout-pay">
          <h3 className="dash-card-title">ชำระเงิน (Checkout)</h3>

          {data.isOwner && (
            <p className="dash-text-muted" style={{ fontSize: '14px' }}>บัญชีนี้เป็น Owner — ไม่ต้องชำระเงิน</p>
          )}

          {alreadyAutoPro && (
            <div>
              <p className="dash-text-gain" style={{ fontSize: '14px', marginBottom: '12px' }}>
                คุณเป็นแผน Pro และต่ออายุอัตโนมัติอยู่แล้ว
              </p>
              <button type="button" style={btnGhost} onClick={onBackToPlan}>ไปจัดการแผน Pro</button>
            </div>
          )}

          {canCheckout && !paymentMaintenance && (
            <>
              <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '14px' }}>
                {isManualPro ? 'ต่ออายุ Pro' : 'อัปเกรดเป็น Pro'} — เลือกช่องทางชำระเงิน
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
                          ข้อมูลบัตรจะถูกส่งแบบเข้ารหัสไปยัง Omise เพื่อสร้าง token เท่านั้น
                        </p>
                        <button type="button" onClick={subscribeOmiseCard} style={{ ...btnPrimary, marginTop: '12px' }} disabled={omiseCardLoading}>
                          {omiseCardLoading ? 'กำลังสมัครบัตร...' : `ยืนยันชำระ — ฿${proPrice}/เดือน`}
                        </button>
                      </div>
                    </>
                  ) : (
                    <>
                      <ul className="dash-sub-steps">
                        <li>ต่ออายุอัตโนมัติทุกเดือน — บัตรเครดิต/เดบิต, Apple Pay, Google Pay</li>
                        <li>เปิด Pro ทันทีหลังชำระสำเร็จ</li>
                      </ul>
                      <button type="button" onClick={startCheckout} style={{ ...btnPrimary, marginTop: '14px' }} disabled={checkoutLoading}>
                        {checkoutLoading ? 'กำลังเปิดหน้าชำระเงิน...' : `ไปชำระด้วยบัตร — ฿${proPrice}/เดือน`}
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
                        <button type="button" onClick={startPromptPayCheckout} style={{ ...btnPrimary, marginTop: '12px' }} disabled={creatingPromptPay}>
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
                          </div>
                          <div className="dash-sub-receipt">
                            <button type="button" className="dash-sub-retry" style={{ ...btnGhost, width: '100%', marginTop: '10px' }} onClick={() => syncPromptPay(promptPayState.chargeId)}>
                              รีเฟรชสถานะตอนนี้
                            </button>
                            <button type="button" style={{ ...btnPrimary, width: '100%', marginTop: '10px' }} onClick={startPromptPayCheckout}>
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
                      </ol>
                      <div className="dash-sub-payment">
                        <div className="dash-sub-qr-wrap">
                          <img src={qrUrl} alt={`PromptPay QR ฿${proPrice} PortDiary`} className="dash-sub-qr" width={280} height={380} />
                        </div>
                      </div>
                    </>
                  )}
                </div>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  )
}
