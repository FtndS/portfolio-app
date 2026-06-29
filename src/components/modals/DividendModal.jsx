import { useState, useRef } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import AmountInput from '../ui/AmountInput'
import Modal from '../ui/Modal'
import DateInput from '../ui/DateInput'
import { sanitizeTicker, symFor } from '../../lib/constants'
import { todayIso } from '../../lib/format'

function inferCurrency(ticker, holdings) {
  const h = holdings.find((x) => x.ticker === ticker)
  if (h?.currency) return h.currency
  const t = (ticker || '').toUpperCase()
  if (t.includes('-BK')) return 'THB'
  if (t.includes('-HK')) return 'HKD'
  return 'USD'
}

export default function DividendModal({ holdings, dividend, onClose, onSave, portfolioId }) {
  const today = todayIso()
  const isEdit = !!dividend
  const [f, setF] = useState(() => ({
    ticker: dividend?.ticker || '',
    amount: dividend?.amount != null ? String(dividend.amount) : '',
    currency: dividend?.currency || inferCurrency(dividend?.ticker, holdings),
    shares_held: dividend?.shares_held != null ? String(dividend.shares_held) : '',
    pay_date: dividend?.pay_date?.split('T')[0] || today,
    note: dividend?.note || '',
    holding_id: '',
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const dateRef = useRef(null)

  const selHolding = (e) => {
    const h = holdings.find((x) => String(x.id) === e.target.value)
    if (h) {
      setF({
        ...f,
        holding_id: e.target.value,
        ticker: h.ticker,
        currency: h.currency || 'USD',
        shares_held: f.shares_held || String(h.shares),
      })
    } else setF({ ...f, holding_id: '' })
  }

  const save = async () => {
    if (!f.ticker || !f.amount) return setError('กรุณากรอกข้อมูลให้ครบ')
    const payDateIso = dateRef.current?.commit()
    if (!payDateIso) return setError('รูปแบบวันที่ผิด กรุณากรอกใหม่ — ใช้ วัน/เดือน/ปี เช่น 30/04/2025')
    const amount = parseFloat(f.amount)
    if (!Number.isFinite(amount) || amount <= 0) return setError('จำนวนเงินปันผลต้องมากกว่า 0')
    setLoading(true)
    setError('')
    const body = {
      ticker: sanitizeTicker(f.ticker),
      amount,
      currency: f.currency,
      shares_held: f.shares_held ? parseFloat(f.shares_held) : null,
      pay_date: payDateIso,
      note: f.note,
      portfolio_id: portfolioId,
    }
    const r = isEdit
      ? await api.put(`/dividends/${dividend.id}`, body)
      : await api.post('/dividends', body)
    setLoading(false)
    if (r.id) {
      onSave()
      onClose()
    } else setError(r.error || 'บันทึกไม่สำเร็จ')
  }

  const sym = symFor(f.currency)

  return (
    <Modal title={isEdit ? 'แก้ไขเงินปันผล' : 'บันทึกเงินปันผล'} onClose={onClose}>
      {error && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '16px' }}>{error}</p>}
      <Field label="เลือก Holding (optional)">
        <select style={inp()} value={f.holding_id} onChange={selHolding}>
          <option value="">-- เลือกจากพอร์ต --</option>
          {holdings.map((h) => (
            <option key={h.id} value={h.id}>{h.ticker} — {Number(h.shares).toLocaleString()} หุ้น</option>
          ))}
        </select>
      </Field>
      <Field label="Ticker *">
        <input
          style={inp()}
          placeholder="เช่น SCB-BK, TISCO-BK"
          value={f.ticker}
          onChange={(e) => {
            const ticker = e.target.value
            const next = { ...f, ticker }
            if (!isEdit) next.currency = inferCurrency(sanitizeTicker(ticker), holdings)
            setF(next)
          }}
        />
      </Field>
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
          <Field label="จำนวนเงินปันผลที่ได้รับ *">
            <AmountInput
              prefix={sym}
              placeholder="0.00"
              value={f.amount}
              nonNegative
              onChange={(e) => setF({ ...f, amount: e.target.value })}
            />
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="หุ้น ณ วันจ่าย (optional)">
            <AmountInput
              suffix="shares"
              placeholder="เช่น 3700"
              value={f.shares_held}
              nonNegative
              onChange={(e) => setF({ ...f, shares_held: e.target.value })}
            />
          </Field>
        </div>
      </div>
      <Field label="วันที่รับปันผล *">
        <DateInput ref={dateRef} style={inp()} value={f.pay_date} onChange={(pay_date) => setF({ ...f, pay_date })} />
        <p className="dash-text-faint" style={{ fontSize: '11px', marginTop: '4px', marginBottom: 0 }}>รูปแบบ วัน/เดือน/ปี เช่น 30/04/2025</p>
      </Field>
      <Field label="หมายเหตุ (optional)">
        <input style={inp({ marginBottom: 0 })} placeholder="เช่น ปันผล Q1/2026" value={f.note} onChange={(e) => setF({ ...f, note: e.target.value })} />
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
