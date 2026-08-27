import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost, inp } from '../../lib/styles'

export default function CheckoutPage({ user, onUserRefresh, onBackToPlan, flashMessage = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [suite, setSuite] = useState('stripe_manual')
  const [payMethod, setPayMethod] = useState('card')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [omiseCardLoading, setOmiseCardLoading] = useState(false)
  const [actionErr, setActionErr] = useState('')
  const [banner, setBanner] = useState(flashMessage)
  const [creatingPromptPay, setCreatingPromptPay] = useState(false)
  const [promptPayState, setPromptPayState] = useState(null)
  const [promptPayErr, setPromptPayErr] = useState('')
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
    const active = r.paymentSuites?.active || 'stripe_manual'
    setSuite(active)
    if (r.paymentEnabled) setPayMethod('card')
    else setPayMethod('promptpay')
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
  const stripeReady = !!data.paymentEnabled
  const omiseReady = !!data.omiseCardEnabled || !!data.omisePromptPayEnabled
  const qrUrl = data.paymentQrUrl || '/promptpay-qr-99.png'
  const isManualPro = isPro && data.proPaymentSource === 'manual'
  const alreadyAutoPro = isPro && !isManualPro && !data.isOwner
  const canPay = !data.isOwner && (!isPro || isManualPro)
  const showSuites = !data.isOwner
  const omisePending = !!data.omisePending || !omiseReady
  const omisePendingMessage = data.omisePendingMessage
    || 'กำลังรอยืนยันบัญชี Omise — ใช้ชุดที่ 1 ชั่วคราว'
  const hasStripeSub = !!data.hasStripeSubscription

  const openStripePortal = async () => {
    setActionErr('')
    setCheckoutLoading(true)
    const r = await api.post('/subscription/portal')
    setCheckoutLoading(false)
    if (r.error) {
      setActionErr(r.error)
      return
    }
    if (r.url) window.location.href = r.url
  }

  return (
    <div className="dash-sub-page dash-checkout-page">
      <div className="dash-checkout-top">
        <button type="button" className="dash-link-btn" onClick={onBackToPlan}>
          ← กลับหน้าแผน Pro
        </button>
        <h2 className="dash-sub-title">Checkout</h2>
        <p className="dash-sub-lead">ตรวจสอบตะกร้า แล้วเลือกชุดชำระเงิน</p>
      </div>

      {banner && (
        <div className="dash-inset dash-sub-banner" style={{ padding: '12px 14px', marginBottom: '16px' }}>
          <p className="dash-text-gain" style={{ margin: 0, fontSize: '14px' }}>{banner}</p>
        </div>
      )}

      {!stripeReady && !data.isOwner && (
        <div className="dash-inset dash-sub-omise-note" style={{ marginBottom: '16px' }}>
          <p className="dash-text-secondary" style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
            <strong>บัตร Stripe ยังไม่พร้อม</strong> — เซิร์ฟเวอร์ยังไม่โหลด
            {' '}<code>STRIPE_ENABLED</code> / <code>STRIPE_SECRET_KEY</code> / <code>STRIPE_PRICE_ID</code>
            {' '}ครบ ตอนนี้ชุดที่ 1 ใช้ได้แค่ PromptPay (manual)
          </p>
        </div>
      )}

      {alreadyAutoPro && (
        <div className="dash-inset dash-checkout-active-note">
          <p className="dash-text-secondary" style={{ margin: 0, fontSize: '14px', lineHeight: 1.6 }}>
            คุณเป็นแผน Pro และต่ออายุอัตโนมัติอยู่แล้ว — ไม่เปิดหน้า Checkout บัตรซ้ำ
            {hasStripeSub && stripeReady
              ? ' · จัดการบัตร/ยกเลิกได้จากปุ่มด้านล่าง'
              : ' · หรือกลับไป '}
            {!(hasStripeSub && stripeReady) && (
              <button type="button" className="dash-link-btn" onClick={onBackToPlan}>จัดการแผน</button>
            )}
          </p>
          {hasStripeSub && stripeReady && (
            <button
              type="button"
              style={{ ...btnPrimary, marginTop: '12px' }}
              onClick={openStripePortal}
              disabled={checkoutLoading}
            >
              {checkoutLoading ? 'กำลังเปิด...' : 'เปิดหน้าจัดการบัตร Stripe'}
            </button>
          )}
        </div>
      )}

      {actionErr && (
        <div className="dash-inset dash-sub-action-err" style={{ marginBottom: '12px' }}>
          <p className="dash-text-loss" style={{ margin: 0, fontSize: '14px', lineHeight: 1.55 }}>{actionErr}</p>
        </div>
      )}

      <div className="dash-checkout-grid">
        <section className="dash-card dash-checkout-cart">
          <p className="dash-checkout-kicker">ตะกร้า</p>
          <h3 className="dash-card-title">PortDiary Pro</h3>
          <p className="dash-text-muted" style={{ fontSize: '14px', lineHeight: 1.65, margin: '0 0 16px' }}>
            โควตา AI สูงขึ้น · Copilot ถามเองได้ · ต่ออายุรายเดือน
          </p>
          <div className="dash-checkout-line">
            <span>จำนวน</span>
            <strong>1</strong>
          </div>
          <div className="dash-checkout-line">
            <span>ประเภท</span>
            <strong>บริการดิจิทัล (ไม่จัดส่ง)</strong>
          </div>
          <div className="dash-checkout-total">
            <span>ยอดชำระ</span>
            <strong>฿{proPrice}<span>/เดือน</span></strong>
          </div>
          <p className="dash-text-faint" style={{ fontSize: '12px', marginTop: '14px', lineHeight: 1.6 }}>
            นโยบาย{' '}
            <a href="/refund.html" className="dash-link-btn" target="_blank" rel="noreferrer">ยกเลิกและคืนเงิน</a>
            {' · '}
            <a href="/terms.html" className="dash-link-btn" target="_blank" rel="noreferrer">ข้อกำหนด</a>
          </p>
        </section>

        <section className="dash-checkout-pay-wrap">
          {data.isOwner && (
            <div className="dash-card">
              <p className="dash-text-muted" style={{ fontSize: '14px', margin: 0 }}>บัญชี Owner — ไม่ต้องชำระเงิน</p>
            </div>
          )}

          {showSuites && (
            <>
              <div className="dash-checkout-suites" role="tablist" aria-label="ชุดชำระเงิน">
                <button
                  type="button"
                  role="tab"
                  aria-selected={suite === 'stripe_manual'}
                  className={`dash-checkout-suite${suite === 'stripe_manual' ? ' is-active' : ''}`}
                  onClick={() => {
                    setSuite('stripe_manual')
                    setPayMethod(stripeReady ? 'card' : 'promptpay')
                  }}
                >
                  <span className={`dash-checkout-suite-badge${stripeReady ? '' : ' dash-checkout-suite-badge--pending'}`}>
                    ชุด 1 · {stripeReady ? 'พร้อมใช้' : 'Stripe ยังไม่พร้อม'}
                  </span>
                  <strong>PromptPay + Stripe</strong>
                  <span>{stripeReady ? 'QR โอนเอง หรือตัดบัตรอัตโนมัติ' : 'ตอนนี้ใช้ได้แค่ PromptPay (manual)'}</span>
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={suite === 'omise'}
                  className={`dash-checkout-suite${suite === 'omise' ? ' is-active' : ''}${omisePending ? ' is-pending' : ''}`}
                  onClick={() => {
                    setSuite('omise')
                    setPayMethod('card')
                  }}
                >
                  <span className={`dash-checkout-suite-badge${omisePending ? ' dash-checkout-suite-badge--pending' : ''}`}>
                    ชุด 2 · {omisePending ? 'รอยืนยัน' : 'พร้อมใช้'}
                  </span>
                  <strong>Omise</strong>
                  <span>บัตร + PromptPay อัตโนมัติ</span>
                </button>
              </div>

              <div className="dash-card dash-checkout-pay">
                {suite === 'stripe_manual' && (
                  <>
                    <h3 className="dash-card-title">ชำระด้วยชุดที่ 1</h3>
                    <div className="dash-segment dash-sub-pay-tabs" style={{ marginBottom: '16px' }}>
                      {stripeReady && (
                        <button
                          type="button"
                          className={`dash-segment-btn${payMethod === 'card' ? ' dash-segment-btn--active' : ''}`}
                          onClick={() => setPayMethod('card')}
                        >
                          บัตร (Stripe)
                        </button>
                      )}
                      <button
                        type="button"
                        className={`dash-segment-btn${payMethod === 'promptpay' ? ' dash-segment-btn--active' : ''}`}
                        onClick={() => setPayMethod('promptpay')}
                      >
                        PromptPay (manual)
                      </button>
                    </div>

                    {!stripeReady && (
                      <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '12px', lineHeight: 1.55 }}>
                        ปุ่มบัตร Stripe จะโผล่เมื่อเซิร์ฟเวอร์ตั้งค่า Stripe ครบแล้ว
                      </p>
                    )}

                    {payMethod === 'card' && stripeReady && (
                      <div>
                        <ul className="dash-sub-steps">
                          <li>ต่ออายุอัตโนมัติทุกเดือนผ่าน Stripe</li>
                          <li>เปิด Pro ทันทีหลังชำระสำเร็จ</li>
                          <li>ยกเลิกได้จากหน้าแผน Pro</li>
                        </ul>
                        {canPay ? (
                          <button type="button" onClick={startCheckout} style={{ ...btnPrimary, marginTop: '14px' }} disabled={checkoutLoading}>
                            {checkoutLoading ? 'กำลังเปิดหน้าชำระเงิน...' : `ชำระด้วยบัตร — ฿${proPrice}/เดือน`}
                          </button>
                        ) : hasStripeSub ? (
                          <button type="button" onClick={openStripePortal} style={{ ...btnPrimary, marginTop: '14px' }} disabled={checkoutLoading}>
                            {checkoutLoading ? 'กำลังเปิด...' : 'เปิดหน้าจัดการบัตร Stripe'}
                          </button>
                        ) : (
                          <p className="dash-text-muted" style={{ fontSize: '13px', marginTop: '14px' }}>
                            บัญชีนี้ต่ออายุอัตโนมัติอยู่แล้ว — ไม่ต้องชำระซ้ำ
                          </p>
                        )}
                      </div>
                    )}

                    {payMethod === 'promptpay' && (
                      <div>
                        <ol className="dash-sub-steps">
                          <li>สแกน QR PromptPay โอน <strong>฿{proPrice}</strong></li>
                          <li>ส่งสลิปผ่านเมนู Support เพื่อเปิด Pro</li>
                          <li>ต่ออายุทุกเดือนด้วยตัวเอง (ไม่หักอัตโนมัติ)</li>
                        </ol>
                        {canPay ? (
                          <>
                            <div className="dash-sub-qr-wrap" style={{ marginTop: '14px' }}>
                              <img src={qrUrl} alt={`PromptPay QR ฿${proPrice}`} className="dash-sub-qr" width={280} height={380} />
                            </div>
                            {data.paymentInstructions && (
                              <p className="dash-text-muted" style={{ fontSize: '13px', marginTop: '10px' }}>{data.paymentInstructions}</p>
                            )}
                          </>
                        ) : (
                          <p className="dash-text-muted" style={{ fontSize: '13px', marginTop: '14px' }}>
                            บัญชีนี้ต่ออายุอัตโนมัติอยู่แล้ว — ไม่ต้องโอนซ้ำ
                          </p>
                        )}
                      </div>
                    )}
                  </>
                )}

                {suite === 'omise' && (
                  <>
                    <h3 className="dash-card-title">ชำระด้วยชุดที่ 2 — Omise</h3>
                    {omisePending ? (
                      <div className="dash-checkout-pending">
                        <p className="dash-checkout-pending-title">กำลังรอยืนยัน Omise</p>
                        <p className="dash-text-muted" style={{ fontSize: '14px', lineHeight: 1.65, margin: 0 }}>
                          {omisePendingMessage}
                        </p>
                        <p className="dash-text-muted" style={{ fontSize: '13px', marginTop: '12px' }}>
                          ระหว่างนี้ใช้ <strong>ชุดที่ 1</strong> (PromptPay manual หรือบัตร Stripe) ได้ตามปกติ
                        </p>
                        <button
                          type="button"
                          style={{ ...btnGhost, marginTop: '14px' }}
                          onClick={() => {
                            setSuite('stripe_manual')
                            setPayMethod(stripeReady ? 'card' : 'promptpay')
                          }}
                        >
                          กลับไปชุดที่ 1
                        </button>
                      </div>
                    ) : (
                      <>
                        <div className="dash-segment dash-sub-pay-tabs" style={{ marginBottom: '16px' }}>
                          <button
                            type="button"
                            className={`dash-segment-btn${payMethod === 'card' ? ' dash-segment-btn--active' : ''}`}
                            onClick={() => setPayMethod('card')}
                          >
                            บัตร (Omise)
                          </button>
                          <button
                            type="button"
                            className={`dash-segment-btn${payMethod === 'promptpay' ? ' dash-segment-btn--active' : ''}`}
                            onClick={() => setPayMethod('promptpay')}
                          >
                            PromptPay (Omise)
                          </button>
                        </div>

                        {payMethod === 'card' && (
                          <div className="dash-sub-receipt" style={{ maxWidth: '420px' }}>
                            {canPay ? (
                              <>
                                <input style={inp({ marginBottom: '8px' })} placeholder="ชื่อบนบัตร" value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} />
                                <input style={inp({ marginBottom: '8px' })} placeholder="เลขบัตร" value={cardForm.number} onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })} />
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                                  <input style={inp({ marginBottom: 0 })} placeholder="MM" value={cardForm.month} onChange={(e) => setCardForm({ ...cardForm, month: e.target.value })} />
                                  <input style={inp({ marginBottom: 0 })} placeholder="YY" value={cardForm.year} onChange={(e) => setCardForm({ ...cardForm, year: e.target.value })} />
                                  <input style={inp({ marginBottom: 0 })} placeholder="CVC" value={cardForm.cvc} onChange={(e) => setCardForm({ ...cardForm, cvc: e.target.value })} />
                                </div>
                                <button type="button" onClick={subscribeOmiseCard} style={{ ...btnPrimary, marginTop: '12px' }} disabled={omiseCardLoading}>
                                  {omiseCardLoading ? 'กำลังสมัครบัตร...' : `ยืนยันชำระ — ฿${proPrice}/เดือน`}
                                </button>
                              </>
                            ) : (
                              <p className="dash-text-muted" style={{ fontSize: '13px', margin: 0 }}>
                                บัญชีนี้ต่ออายุอัตโนมัติอยู่แล้ว — ไม่ต้องชำระซ้ำ
                              </p>
                            )}
                          </div>
                        )}

                        {payMethod === 'promptpay' && (
                          <div>
                            {canPay ? (
                              <>
                                {!promptPayState?.chargeId && (
                                  <button type="button" onClick={startPromptPayCheckout} style={btnPrimary} disabled={creatingPromptPay}>
                                    {creatingPromptPay ? 'กำลังสร้าง QR...' : `สร้าง PromptPay QR — ฿${proPrice}`}
                                  </button>
                                )}
                                {promptPayErr && <p className="dash-text-loss" style={{ fontSize: '13px', marginTop: '10px' }}>{promptPayErr}</p>}
                                {promptPayState?.chargeId && (
                                  <div className="dash-sub-qr-wrap" style={{ marginTop: '12px' }}>
                                    <img src={promptPayState.qrImageUrl} alt="PromptPay QR" className="dash-sub-qr" width={280} height={380} />
                                    <button type="button" style={{ ...btnGhost, width: '100%', marginTop: '10px' }} onClick={() => syncPromptPay(promptPayState.chargeId)}>
                                      รีเฟรชสถานะ
                                    </button>
                                  </div>
                                )}
                              </>
                            ) : (
                              <p className="dash-text-muted" style={{ fontSize: '13px', margin: 0 }}>
                                บัญชีนี้ต่ออายุอัตโนมัติอยู่แล้ว — ไม่ต้องชำระซ้ำ
                              </p>
                            )}
                          </div>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  )
}
