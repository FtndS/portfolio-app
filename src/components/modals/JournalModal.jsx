import { useState, useRef } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import DateInput from '../ui/DateInput'
import { JOURNAL_TAGS as journalTags } from '../../lib/constants'
import { todayIso } from '../../lib/format'
import { dismissJournalPrompt } from '../../lib/workflow'

export default function JournalModal({
  entry,
  initial,
  fromTransaction = false,
  userId,
  onClose,
  onSave,
  portfolioId,
}) {
  const today = todayIso()
  const isEdit = !!entry
  const [f, setF] = useState(() => ({
    title: entry?.title || initial?.title || '',
    content: entry?.content || initial?.content || '',
    tickers: entry?.tickers || initial?.tickers || '',
    tag: entry?.tag || initial?.tag || '',
    date: entry?.date?.split('T')[0] || initial?.date || today,
  }))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [dontRemind, setDontRemind] = useState(false)
  const dateRef = useRef(null)

  const applyDontRemind = () => {
    if (dontRemind) dismissJournalPrompt(userId)
  }

  const closeModal = () => {
    applyDontRemind()
    onClose()
  }

  const save = async () => {
    if (!f.content.trim()) {
      setError(fromTransaction && !isEdit
        ? 'กรุณาเขียนบันทึกสั้นๆ ว่าทำไมซื้อ/ขาย — หรือกดปุ่ม ข้าม'
        : 'กรุณาเขียนบันทึกก่อนบันทึก')
      return
    }
    const dateIso = dateRef.current?.commit()
    if (!dateIso) {
      setError('รูปแบบวันที่ผิด กรุณากรอกใหม่ — ใช้ วัน/เดือน/ปี เช่น 30/04/2025')
      return
    }
    setLoading(true)
    setError('')
    const r = isEdit
      ? await api.put(`/journal/${entry.id}`, { ...f, date: dateIso })
      : await api.post('/journal', { ...f, date: dateIso, portfolio_id: portfolioId })
    setLoading(false)
    if (r.id) {
      applyDontRemind()
      onSave()
      onClose()
    }
  }

  const title = isEdit
    ? 'แก้ไขบันทึกเหตุผล'
    : fromTransaction
      ? 'เขียนเหตุผลหลังซื้อ/ขาย'
      : 'เขียนบันทึกเหตุผลใหม่'

  return (
    <Modal title={title} onClose={closeModal}>
      {fromTransaction && !isEdit && (
        <p className="dash-workflow-journal-hint">
          บันทึกซื้อ/ขายเรียบร้อย — เขียนเหตุผลสั้นๆ ว่าทำไม{f.tag === 'ขาย' ? 'ขาย' : 'ซื้อ'} (ข้ามได้โดยกดปุ่ม ข้าม)
        </p>
      )}
      {error && <p className="dash-text-loss" style={{ fontSize: '13px', marginBottom: '12px' }}>{error}</p>}
      <Field label="หัวข้อ (optional)">
        <input style={inp()} placeholder="เช่น DCA รายเดือน, ทยอยขายทำกำไร" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} />
      </Field>
      <Field label="บันทึก *">
        <textarea
          placeholder={fromTransaction
            ? 'เช่น ซื้อเพิ่มเพราะราคาย่อ / ขายเพื่อ rebalance พอร์ต...'
            : 'ความคิด การวิเคราะห์ หรือเหตุการณ์...'}
          style={{ ...inp(), height: '110px', resize: 'vertical', fontFamily: 'var(--font)', marginBottom: 0 }}
          value={f.content}
          onChange={(e) => setF({ ...f, content: e.target.value })}
          autoFocus={fromTransaction}
        />
      </Field>
      <Field label="รหัสหุ้นที่เกี่ยวข้อง">
        <input style={inp()} placeholder="เช่น VOO, SCB" value={f.tickers} onChange={(e) => setF({ ...f, tickers: e.target.value })} />
      </Field>
      <div style={{ display: 'flex', gap: '8px' }} className="dash-modal-row">
        <div style={{ flex: 1 }}>
          <Field label="แท็ก">
            <select style={inp({ marginBottom: 0 })} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })}>
              <option value="">-- ไม่มี Tag --</option>
              {journalTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="วันที่">
            <DateInput ref={dateRef} style={inp({ marginBottom: 0 })} value={f.date} onChange={(date) => setF({ ...f, date })} />
          </Field>
        </div>
      </div>
      {fromTransaction && !isEdit && (
        <label className="dash-checkbox-row">
          <input
            type="checkbox"
            checked={dontRemind}
            onChange={(e) => setDontRemind(e.target.checked)}
          />
          <span>
            <span className="dash-checkbox-label">ไม่ต้องเตือนอีก</span>
            <span className="dash-checkbox-hint">จะไม่เปิดหน้านี้หลังบันทึกซื้อ/ขาย</span>
          </span>
        </label>
      )}
      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }} className="dash-modal-actions">
        <button type="button" onClick={closeModal} style={btnGhost}>
          {fromTransaction && !isEdit ? 'ข้าม' : 'ยกเลิก'}
        </button>
        <button type="button" onClick={save} style={btnPrimary} disabled={loading}>
          {loading ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </Modal>
  )
}
