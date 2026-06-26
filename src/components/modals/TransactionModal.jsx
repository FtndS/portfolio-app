import { useState } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import AmountInput from '../ui/AmountInput'
import Modal from '../ui/Modal'
import { sanitizeTicker } from '../../lib/constants'

function inferTxCurrency(ticker, holdings) {
  const h = holdings.find((x) => x.ticker === ticker)
  if (h?.currency) return h.currency
  const t = (ticker || '').toUpperCase()
  if (t.includes('-BK') || t.endsWith('.BK')) return 'THB'
  if (t.includes('-HK')) return 'HKD'
  return 'USD'
}

export default function TransactionModal({ holdings, transaction, onClose, onSave, portfolioId }) {
  const today = new Date().toISOString().split('T')[0]
  const isEdit = !!transaction
  const [f, setF] = useState(() => ({
    ticker: transaction?.ticker || '',
    type: transaction?.type || 'BUY',
    shares: transaction?.shares != null ? String(transaction.shares) : '',
    price: transaction?.price != null ? String(transaction.price) : '',
    note: transaction?.note || '',
    date: transaction?.date?.split('T')[0] || today,
    holding_id: transaction?.holding_id ? String(transaction.holding_id) : '',
    currency: transaction?.currency || inferTxCurrency(transaction?.ticker, holdings),
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const selHolding = (e) => {
    const h = holdings.find((h) => String(h.id) === e.target.value)
    if (h) setF({ ...f, holding_id: e.target.value, ticker: h.ticker, currency: h.currency || 'USD' })
    else setF({ ...f, holding_id: '' })
  }

  const save = async () => {
    if (!f.ticker || !f.shares || !f.price || !f.date) return setError('กรุณากรอกข้อมูลให้ครบ')
    const shares = parseFloat(f.shares)
    const price = parseFloat(f.price)
    if (!Number.isFinite(shares) || shares <= 0) return setError('จำนวนหุ้นต้องมากกว่า 0')
    if (!Number.isFinite(price) || price <= 0) return setError('ราคาต้องมากกว่า 0')
    setLoading(true)
    setError('')
    const cleanTicker = sanitizeTicker(f.ticker)
    const body = {
      ticker: cleanTicker,
      type: f.type,
      shares,
      price,
      note: f.note,
      date: f.date,
      holding_id: f.holding_id || null,
      portfolio_id: portfolioId,
      currency: f.currency,
    }
    const r = isEdit
      ? await api.put(`/transactions/${transaction.id}`, body)
      : await api.post('/transactions', body)
    setLoading(false)
    if (r.id) {
      onSave()
      onClose()
    } else setError(r.error || 'บันทึกไม่สำเร็จ')
  }

  const sym = f.currency === 'THB' ? '฿' : '$'
  const total = f.shares && f.price ? parseFloat(f.shares) * parseFloat(f.price) : 0

  return (
    <Modal title={isEdit ? 'แก้ไข Transaction' : 'บันทึก Transaction'} onClose={onClose}>
      {error && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
      <Field label="เลือก Holding ที่มีอยู่ (optional)">
        <select style={inp()} value={f.holding_id} onChange={selHolding}>
          <option value="">-- หรือพิมพ์ Ticker เองด้านล่าง --</option>
          {holdings.map((h) => (
            <option key={h.id} value={h.id}>{h.ticker} — {h.name || h.ticker}</option>
          ))}
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
                if (!isEdit && !f.holding_id) next.currency = inferTxCurrency(sanitizeTicker(ticker), holdings)
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
                  onClick={() => setF({ ...f, type: t })}
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
          {['USD', 'THB'].map((c) => (
            <button
              key={c}
              type="button"
              className={`dash-segment-btn${f.currency === c ? ' dash-segment-btn--active' : ''}`}
              style={{ flex: 1 }}
              onClick={() => setF({ ...f, currency: c })}
            >
              {c === 'USD' ? '$ USD' : '฿ THB'}
            </button>
          ))}
        </div>
      </Field>
      <div style={{ display: 'flex', gap: '8px' }} className="dash-modal-row">
        <div style={{ flex: 1 }}>
          <Field label="จำนวนหุ้น">
            <AmountInput
              suffix="shares"
              placeholder="100"
              value={f.shares}
              nonNegative
              onChange={(e) => setF({ ...f, shares: e.target.value })}
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
      {total > 0 && (
        <div className="dash-tx-total">
          <span className="dash-text-gain" style={{ fontSize: '12px' }}>มูลค่ารวม: </span>
          <span style={{ fontSize: '14px', fontWeight: 600 }}>{sym}{total.toLocaleString('en-US', { minimumFractionDigits: 2 })}</span>
        </div>
      )}
      <Field label="วันที่">
        <input type="date" style={inp()} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
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
