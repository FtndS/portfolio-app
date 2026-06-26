import { useState } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import { JOURNAL_TAGS as journalTags } from '../../lib/constants'

export default function JournalModal({
  entry,
  initial,
  fromTransaction = false,
  onClose,
  onSave,
  portfolioId,
}) {
  const today = new Date().toISOString().split('T')[0]
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

  const save = async () => {
    if (!f.content.trim()) {
      setError('กรุณาเขียนบันทึกสั้นๆ ว่าทำไมซื้อ/ขาย — หรือกดยกเลิกเพื่อข้าม')
      return
    }
    setLoading(true)
    setError('')
    const r = isEdit
      ? await api.put(`/journal/${entry.id}`, f)
      : await api.post('/journal', { ...f, portfolio_id: portfolioId })
    setLoading(false)
    if (r.id) {
      onSave()
      onClose()
    }
  }

  const title = isEdit
    ? 'แก้ไข Journal'
    : fromTransaction
      ? 'บันทึก Journal หลังเทรด'
      : 'เขียน Journal ใหม่'

  return (
    <Modal title={title} onClose={onClose}>
      {fromTransaction && !isEdit && (
        <p className="dash-workflow-journal-hint">
          Transaction บันทึกแล้ว — เขียนเหตุผลสั้นๆ ว่าทำไม{ f.tag === 'ขาย' ? 'ขาย' : 'ซื้อ' } (ข้ามได้โดยกดยกเลิก)
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
      <Field label="Tickers ที่เกี่ยวข้อง">
        <input style={inp()} placeholder="เช่น VOO, SCB-BK" value={f.tickers} onChange={(e) => setF({ ...f, tickers: e.target.value })} />
      </Field>
      <div style={{ display: 'flex', gap: '8px' }} className="dash-modal-row">
        <div style={{ flex: 1 }}>
          <Field label="Tag">
            <select style={inp({ marginBottom: 0 })} value={f.tag} onChange={(e) => setF({ ...f, tag: e.target.value })}>
              <option value="">-- ไม่มี Tag --</option>
              {journalTags.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div style={{ flex: 1 }}>
          <Field label="วันที่">
            <input type="date" style={inp({ marginBottom: 0 })} value={f.date} onChange={(e) => setF({ ...f, date: e.target.value })} />
          </Field>
        </div>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '20px' }} className="dash-modal-actions">
        <button type="button" onClick={onClose} style={btnGhost}>
          {fromTransaction && !isEdit ? 'ข้าม' : 'ยกเลิก'}
        </button>
        <button type="button" onClick={save} style={btnPrimary} disabled={loading}>
          {loading ? 'กำลังบันทึก...' : 'บันทึก Journal'}
        </button>
      </div>
    </Modal>
  )
}
