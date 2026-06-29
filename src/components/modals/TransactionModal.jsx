import { useState, useRef, useMemo } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import AmountInput from '../ui/AmountInput'
import Modal from '../ui/Modal'
import DateInput from '../ui/DateInput'
import { sanitizeTicker, MARKETS } from '../../lib/constants'
import { todayIso, fmtShares, SHARES_EPS } from '../../lib/format'

const SELL_PCT_PRESETS = [25, 50, 75, 100]

function formatSellQty(n) {
  if (!Number.isFinite(n) || n <= 0) return ''
  return parseFloat(n.toFixed(10)).toString()
}

function inferTxCurrency(ticker, holdings) {
  const h = holdings.find((x) => x.ticker === ticker)
  if (h?.currency) return h.currency
  const t = (ticker || '').toUpperCase()
  if (t.includes('-BK') || t.endsWith('.BK')) return 'THB'
  if (t.includes('-HK')) return 'HKD'
  return 'USD'
}

function inferTxMarket(ticker, holdings) {
  const h = holdings.find((x) => x.ticker === ticker)
  if (h?.market) return h.market
  const t = (ticker || '').toUpperCase()
  if (t.endsWith('-BK') || t.endsWith('.BK')) return 'SET'
  if (t.endsWith('-HK') || t.endsWith('.HK')) return 'HK'
  if (t.endsWith('-SS') || t.endsWith('.SS')) return 'CN'
  if (t.endsWith('-SZ') || t.endsWith('.SZ')) return 'SZ'
  if (/-USD$|-(USDT|THB|BTC|ETH)$/.test(t)) return 'CRYPTO'
  return 'US'
}

export default function TransactionModal({ holdings, transaction, onClose, onSave, portfolioId }) {
  const today = todayIso()
  const isEdit = !!transaction
  const [f, setF] = useState(() => ({
    ticker: transaction?.ticker || '',
    type: transaction?.type || 'BUY',
    shares: transaction?.shares != null ? String(transaction.shares) : '',
    price: transaction?.price != null ? String(transaction.price) : '',
    fee: transaction?.fee != null && Number(transaction.fee) > 0 ? String(transaction.fee) : '',
    note: transaction?.note || '',
    date: transaction?.date?.split('T')[0] || today,
    holding_id: transaction?.holding_id ? String(transaction.holding_id) : '',
    currency: transaction?.currency || inferTxCurrency(transaction?.ticker, holdings),
    market: inferTxMarket(transaction?.ticker, holdings),
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [sellPctActive, setSellPctActive] = useState(null)
  const [sellPctCustom, setSellPctCustom] = useState('')
  const dateRef = useRef(null)

  const sellContext = useMemo(() => {
    if (f.type !== 'SELL') return null
    const ticker = sanitizeTicker(f.ticker)
    if (!ticker) return null
    const h = f.holding_id
      ? holdings.find((x) => String(x.id) === f.holding_id)
      : holdings.find((x) => x.ticker === ticker)
    if (!h) return null
    let available = Number(h.shares)
    if (isEdit && transaction?.type === 'SELL' && sanitizeTicker(transaction.ticker) === ticker) {
      available += Number(transaction.shares)
    }
    if (!(available > SHARES_EPS)) return null
    return { available }
  }, [f.type, f.ticker, f.holding_id, holdings, isEdit, transaction])

  const applySellPct = (pct) => {
    if (!sellContext || !Number.isFinite(pct) || pct <= 0 || pct > 100) return
    const qty = pct >= 100 ? sellContext.available : sellContext.available * (pct / 100)
    setSellPctActive(pct)
    setF((prev) => ({ ...prev, shares: formatSellQty(qty) }))
  }

  const applyCustomSellPct = () => {
    if (!sellPctCustom.trim() || !sellContext) return
    const pct = parseFloat(sellPctCustom)
    if (!Number.isFinite(pct) || pct <= 0 || pct > 100) return
    const qty = pct >= 100 ? sellContext.available : sellContext.available * (pct / 100)
    setSellPctActive('custom')
    setF((prev) => ({ ...prev, shares: formatSellQty(qty) }))
  }

  const selHolding = (e) => {
    const h = holdings.find((h) => String(h.id) === e.target.value)
    if (h) {
      setSellPctActive(null)
      setF({ ...f, holding_id: e.target.value, ticker: h.ticker, currency: h.currency || 'USD', market: h.market || 'US' })
    } else setF({ ...f, holding_id: '' })
  }

  const save = async () => {
    if (!f.ticker || !f.shares || !f.price) return setError('กรุณากรอกข้อมูลให้ครบ')
    const dateIso = dateRef.current?.commit()
    if (!dateIso) return setError('รูปแบบวันที่ผิด กรุณากรอกใหม่ — ใช้ วัน/เดือน/ปี เช่น 30/04/2025')
    const shares = parseFloat(f.shares)
    const price = parseFloat(f.price)
    if (!Number.isFinite(shares) || shares <= 0) return setError('จำนวนหุ้นต้องมากกว่า 0')
    if (f.type === 'SELL' && sellContext && shares > sellContext.available + SHARES_EPS) {
      return setError(`ขายได้สูงสุด ${fmtShares(sellContext.available)} หุ้น`)
    }
    if (!Number.isFinite(price) || price <= 0) return setError('ราคาต้องมากกว่า 0')
    const fee = f.fee === '' ? 0 : parseFloat(f.fee)
    if (!Number.isFinite(fee) || fee < 0) return setError('ค่าธรรมเนียมต้องเป็นตัวเลข 0 ขึ้นไป')
    setLoading(true)
    setError('')
    const cleanTicker = sanitizeTicker(f.ticker)
    const body = {
      ticker: cleanTicker,
      type: f.type,
      shares,
      price,
      fee,
      note: f.note,
      date: dateIso,
      holding_id: f.holding_id || null,
      portfolio_id: portfolioId,
      currency: f.currency,
      market: f.market,
    }
    const r = isEdit
      ? await api.put(`/transactions/${transaction.id}`, body)
      : await api.post('/transactions', body)
    setLoading(false)
    if (r.id) {
      onSave(r, { isNew: !isEdit })
      onClose()
    } else setError(r.error || 'บันทึกไม่สำเร็จ')
  }

  const sym = f.currency === 'THB' ? '฿' : '$'
  const total = f.shares && f.price ? parseFloat(f.shares) * parseFloat(f.price) : 0
  const feeNum = f.fee === '' ? 0 : parseFloat(f.fee) || 0
  const marketDef = MARKETS.find((m) => m.id === f.market) || MARKETS[0]

  return (
    <Modal title={isEdit ? 'แก้ไข Transaction' : 'บันทึก Transaction'} onClose={onClose}>
      {error && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
      <Field label="เลือก Holding ที่มีอยู่ (optional)">
        <select style={inp()} value={f.holding_id} onChange={selHolding}>
          <option value="">-- หรือพิมพ์ Ticker เองด้านล่าง --</option>
          {holdings.map((h) => (
            <option key={h.id} value={h.id}>
              {h.ticker} [{h.market || 'US'}] — {h.name || h.ticker}
            </option>
          ))}
        </select>
      </Field>
      <Field label="หมวดตลาด">
        <select
          style={inp()}
          value={f.market}
          onChange={(e) => {
            const nextMarket = e.target.value
            const nextDef = MARKETS.find((m) => m.id === nextMarket) || MARKETS[0]
            setF({ ...f, market: nextMarket, currency: nextDef.currencies[0] || 'USD' })
          }}
          disabled={isEdit}
        >
          {MARKETS.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
      </Field>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }} className="dash-modal-row">
        <div style={{ flex: 1 }}>
          <Field label="Ticker">
            <input
              style={inp({ marginBottom: 0 })}
              placeholder="เช่น VOO"
              value={f.ticker}
              onChange={(e) => {
                const ticker = e.target.value
                const next = { ...f, ticker }
                setSellPctActive(null)
                if (!isEdit && !f.holding_id) {
                  next.market = inferTxMarket(sanitizeTicker(ticker), holdings)
                  const inferredMarket = MARKETS.find((m) => m.id === next.market) || MARKETS[0]
                  next.currency = inferredMarket.currencies[0] || inferTxCurrency(sanitizeTicker(ticker), holdings)
                }
                setF(next)
              }}
              disabled={isEdit}
            />
          </Field>
        </div>
        <div style={{ flex: 'none', width: '120px' }} className="dash-modal-type">
          <Field label="ประเภท">
            <div className="dash-type-toggle">
              {['BUY', 'SELL'].map((t) => (
                <button
                  key={t}
                  type="button"
                  className={f.type === t ? (t === 'BUY' ? 'active-buy' : 'active-sell') : ''}
                  onClick={() => {
                    setSellPctActive(null)
                    setF({ ...f, type: t })
                  }}
                >
                  {t === 'BUY' ? '🟢 BUY' : '🔴 SELL'}
                </button>
              ))}
            </div>
          </Field>
        </div>
      </div>
      <Field label="สกุลเงิน">
        <div className="dash-segment" style={{ width: '100%' }}>
          {marketDef.currencies.map((c) => (
            <button
              key={c}
              type="button"
              className={`dash-segment-btn${f.currency === c ? ' dash-segment-btn--active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setF({ ...f, currency: c })}
            >
              {c === 'USD' ? '$ USD' : c === 'THB' ? '฿ THB' : c}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ display: 'flex', gap: '8px' }} className="dash-modal-row">
        <div style={{ flex: 1 }}>
          <Field label="จำนวนหุ้น">
            {f.type === 'SELL' && sellContext && (
              <div className="dash-sell-pct">
                <span className="dash-sell-pct-hint">ถือ {fmtShares(sellContext.available)}</span>
                <div className="dash-sell-pct-btns">
                  {SELL_PCT_PRESETS.map((p) => (
                    <button
                      key={p}
                      type="button"
                      className={`dash-sell-pct-btn${sellPctActive === p ? ' dash-sell-pct-btn--active' : ''}`}
                      onClick={() => applySellPct(p)}
                    >
                      {p === 100 ? 'ทั้งหมด' : `${p}%`}
                    </button>
                  ))}
                  <span className="dash-sell-pct-custom-wrap">
                    <input
                      type="number"
                      min="0.01"
                      max="100"
                      step="0.01"
                      className={`dash-sell-pct-custom${sellPctActive === 'custom' ? ' dash-sell-pct-custom--active' : ''}`}
                      placeholder="—"
                      value={sellPctCustom}
                      onChange={(e) => setSellPctCustom(e.target.value.replace(/-/g, ''))}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') applyCustomSellPct()
                      }}
                      onBlur={applyCustomSellPct}
                      aria-label="กำหนดเปอร์เซ็นต์ขาย"
                    />
                    <span className="dash-sell-pct-suffix">%</span>
                  </span>
                </div>
              </div>
            )}
            {f.type === 'SELL' && !sellContext && sanitizeTicker(f.ticker) && (
              <p className="dash-sell-pct-hint dash-sell-pct-hint--warn">ไม่พบหุ้นในพอร์ต — เลือกจาก Holding หรือตรวจ ticker</p>
            )}
            <AmountInput
              suffix="shares"
              placeholder="100"
              value={f.shares}
              nonNegative
              onChange={(e) => {
                setSellPctActive(null)
                setF({ ...f, shares: e.target.value })
              }}
            />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label={`ราคา/หุ้น (${f.currency})`}>
            <AmountInput
              prefix={sym}
              placeholder="0.00"
              value={f.price}
              nonNegative
              onChange={(e) => setF({ ...f, price: e.target.value })}
            />
          </Field>
        </div>
      </div>
      <Field label="ค่าธรรมเนียม (optional)">
        <AmountInput
          prefix={sym}
          placeholder="0.00"
          value={f.fee}
          nonNegative
          onChange={(e) => setF({ ...f, fee: e.target.value })}
        />
        <p className="dash-text-faint" style={{ fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>
          รวมในราคาทุนเฉลี่ยเมื่อซื้อ (BUY) — เว้นว่างได้ถ้าไม่มี
        </p>
      </Field>
      {total > 0 && (
        <div className="dash-tx-total">
          <span className="dash-text-gain" style={{ fontSize: '12px' }}>มูลค่ารวม: </span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
          {feeNum > 0 && (
            <span className="dash-text-muted" style={{ fontSize: '12px', marginLeft: '8px' }}>
              + ค่าธรรมเนียม {sym}{feeNum.toLocaleString('en-US', { minimumFractionDigits: 2 })}
            </span>
          )}
        </div>
      )}
      <Field label="วันที่">
        <DateInput ref={dateRef} style={inp()} value={f.date} onChange={(date) => setF({ ...f, date })} />
        <p className="dash-text-faint" style={{ fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>รูปแบบ วัน/เดือน/ปี เช่น 30/04/2025</p>
      </Field>
      <Field label="หมายเหตุ (optional)">
        <input style={inp({ marginBottom: 0 })} placeholder="เช่น DCA รายเดือน" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
      </Field>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }} className="dash-modal-actions">
        <button type="button" onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button type="button" onClick={save} style={btnPrimary} disabled={loading}>
          {loading ? 'กำลังบันทึก...' : isEdit ? 'บันทึกการแก้ไข' : 'บันทึก'}
        </button>
      </div>
    </Modal>
  )
}
