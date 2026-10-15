import { useState, useEffect } from 'react'
import { api } from '../../lib/api'
import { btnPrimary, btnGhost } from '../../lib/styles'

export default function CheckoutPage({ onBackToPlan, flashMessage = '' }) {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [actionErr, setActionErr] = useState('')
  const [banner, setBanner] = useState(flashMessage)

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
  // Admin-granted Pro does not auto-renew, so those users may still subscribe by card
  const isManualPro = isPro && data.proPaymentSource === 'manual'
  const canPay = !data.isOwner && (!isPro || isManualPro)
  const hasStripeSub = !!data.hasStripeSubscription

  return (
    <div className="dash-sub-page dash-checkout-page">
      <div className="dash-checkout-top">
        <button type="button" className="dash-link-btn dash-checkout-back" onClick={onBackToPlan}>
          ← กลับหน้าแผน Pro
        </button>
        <div className="dash-checkout-heading">
          <h2 className="dash-sub-title">Checkout</h2>
          <p className="dash-sub-lead">ชำระด้วยบัตรเครดิต/เดบิตผ่าน Stripe · ตรวจสอบยอดด้านซ้าย</p>
        </div>
      </div>

      {banner && (
        <div className="dash-inset dash-sub-banner" style={{ padding: '12px 14px', marginBottom: '16px' }}>
          <p className="dash-text-gain" style={{ margin: 0, fontSize: '14px' }}>{banner}</p>
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
          <h3 className="dash-checkout-product">PortDiary Pro</h3>
          <p className="dash-checkout-product-desc">
            โควตา AI สูงขึ้น · Copilot ถามเองได้ · ต่ออายุรายเดือน
          </p>
          <dl className="dash-checkout-meta">
            <div>
              <dt>จำนวน</dt>
              <dd>1</dd>
            </div>
            <div>
              <dt>ประเภท</dt>
              <dd>บริการดิจิทัล</dd>
            </div>
          </dl>
          <div className="dash-checkout-total">
            <span className="dash-checkout-total-label">ยอดชำระ</span>
            <p className="dash-checkout-total-price">
              <strong>฿{proPrice}</strong>
              <span>/เดือน</span>
            </p>
          </div>
          <p className="dash-checkout-legal">
            <a href="/refund.html" className="dash-link-btn" target="_blank" rel="noreferrer">ยกเลิกและคืนเงิน</a>
            <span aria-hidden>·</span>
            <a href="/terms.html" className="dash-link-btn" target="_blank" rel="noreferrer">ข้อกำหนด</a>
          </p>
        </section>

        <section className="dash-checkout-pay-wrap">
          <div className="dash-card dash-checkout-pay">
            {data.isOwner ? (
              <p className="dash-text-muted" style={{ fontSize: '14px', margin: 0 }}>บัญชี Owner — ไม่ต้องชำระเงิน</p>
            ) : (
              <>
                <div className="dash-checkout-pay-head">
                  <p className="dash-checkout-kicker">ชำระเงิน</p>
                  <h3 className="dash-checkout-pay-title">บัตรเครดิต/เดบิต (Stripe)</h3>
                </div>
                {!stripeReady ? (
                  <div className="dash-checkout-pending">
                    <p className="dash-checkout-pending-title">ระบบชำระเงินยังไม่พร้อม</p>
                    <p className="dash-checkout-hint" style={{ margin: 0 }}>
                      กรุณาลองใหม่ภายหลัง หรือติดต่อทีมงานผ่านหน้าช่วยเหลือ
                    </p>
                  </div>
                ) : (
                  <div className="dash-checkout-method">
                    <ul className="dash-checkout-points">
                      <li>ต่ออายุอัตโนมัติทุกเดือนผ่าน Stripe</li>
                      <li>เปิด Pro ทันทีหลังชำระสำเร็จ</li>
                      <li>ยกเลิกการต่ออายุได้จากหน้าแผน Pro</li>
                    </ul>
                    {canPay ? (
                      <button type="button" className="dash-checkout-cta" onClick={startCheckout} style={btnPrimary} disabled={checkoutLoading}>
                        {checkoutLoading ? 'กำลังเปิดหน้าชำระเงิน...' : `ชำระด้วยบัตร — ฿${proPrice}/เดือน`}
                      </button>
                    ) : hasStripeSub ? (
                      <>
                        <p className="dash-checkout-hint">คุณเป็นแผน Pro และต่ออายุอัตโนมัติอยู่แล้ว — ไม่ต้องชำระซ้ำ</p>
                        <button type="button" className="dash-checkout-cta" onClick={openStripePortal} style={btnPrimary} disabled={checkoutLoading}>
                          {checkoutLoading ? 'กำลังเปิด...' : 'เปิดหน้าจัดการบัตร Stripe'}
                        </button>
                      </>
                    ) : (
                      <p className="dash-checkout-hint">บัญชีนี้เป็นแผน Pro อยู่แล้ว — ไม่ต้องชำระซ้ำ</p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
