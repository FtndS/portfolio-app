import { useState } from 'react'
import { fmtDate } from '../../lib/format'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import Field from '../ui/Field'
import Modal from '../ui/Modal'

export default function ImportCsvModal({ portfolioId, onClose, onSave }) {
  const [csvText, setCsvText] = useState('')
  const [preview, setPreview] = useState(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const readFile = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      setCsvText(String(reader.result || ''))
      setPreview(null)
      setError('')
    }
    reader.readAsText(file)
    e.target.value = ''
  }

  const runPreview = async () => {
    if (!csvText.trim()) return setError('กรุณาเลือกไฟล์หรือวางข้อมูล CSV')
    setLoading(true)
    setError('')
    const r = await api.post('/transactions/import', { csv: csvText, portfolio_id: portfolioId, dry_run: true })
    setLoading(false)
    if (r.validCount != null) {
      setPreview(r)
      if (!r.validCount && r.errors?.length) setError('ไม่พบรายการที่ถูกต้อง — ตรวจสอบรูปแบบด้านล่าง')
    } else {
      setError(r.error || 'ตรวจสอบไฟล์ไม่สำเร็จ')
      setPreview(null)
    }
  }

  const runImport = async () => {
    if (!preview?.validCount) return runPreview()
    if (!confirm(`นำเข้า ${preview.validCount} รายการ${preview.errors?.length ? ` (ข้าม ${preview.errors.length} แถวที่ผิดพลาด)` : ''}?`)) return
    setLoading(true)
    setError('')
    const r = await api.post('/transactions/import', { csv: csvText, portfolio_id: portfolioId })
    setLoading(false)
    if (r.imported != null) {
      onSave()
      onClose()
    } else {
      setError(r.error || 'นำเข้าไม่สำเร็จ')
    }
  }

  return (
    <Modal title="Import CSV" onClose={onClose}>
      <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
        นำเข้า transaction หลายรายการพร้อมกัน คอลัมน์ที่ต้องมี:{' '}
        <code className="dash-text-accent">date, ticker, type, shares, price</code>
        <br />
        ไม่บังคับ: <code className="dash-text-accent">currency</code> (ถ้าไม่ใส่ จะเดาจาก ticker เช่น SCB-BK → THB), <code className="dash-text-accent">note</code>
      </p>
      <p className="dash-text-muted" style={{ fontSize: '12px', marginBottom: '14px' }}>
        <a href="/import-template.csv" download className="dash-link">ดาวน์โหลดไฟล์ตัวอย่าง</a>
        {' · '}รองรับวันที่ DD/MM/YYYY (แนะนำ) หรือ YYYY-MM-DD · ประเภท BUY/SELL หรือ ซื้อ/ขาย
      </p>

      <Field label="เลือกไฟล์ .csv">
        <input type="file" accept=".csv,text/csv" onChange={readFile} style={{ ...inp(), padding: '8px' }} />
      </Field>
      <Field label="หรือวางข้อมูล CSV">
        <textarea
          value={csvText}
          onChange={(e) => { setCsvText(e.target.value); setPreview(null) }}
          placeholder={'date,ticker,type,shares,price,currency,note\n15/01/2024,VOO,BUY,10,450.25,USD,'}
          style={{ ...inp(), height: '120px', resize: 'vertical', fontFamily: 'monospace', fontSize: '12px', marginBottom: 0 }}
        />
      </Field>

      {error && <p className="dash-text-loss" style={{ fontSize: '13px', margin: '12px 0' }}>{error}</p>}

      {preview && (
        <div style={{ marginTop: '16px', marginBottom: '12px' }}>
          <p className="dash-text-gain" style={{ fontSize: '13px', marginBottom: '8px' }}>
            พร้อมนำเข้า {preview.validCount} / {preview.total} รายการ
          </p>
          {preview.errors?.length > 0 && (
            <div className="dash-inset dash-inset--loss" style={{ padding: '10px 12px', marginBottom: '10px', maxHeight: '100px', overflowY: 'auto' }}>
              {preview.errors.map((e, i) => (
                <p key={i} className="dash-text-loss" style={{ fontSize: '12px', margin: '2px 0' }}>แถว {e.line}: {e.message}</p>
              ))}
            </div>
          )}
          <div className="dash-csv-preview">
            <table>
              <thead>
                <tr>
                  {['วันที่', 'Ticker', 'Type', 'Shares', 'Price', 'CCY'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.validRows?.slice(0, 20).map((r, i) => (
                  <tr key={i}>
                    <td>{fmtDate(r.date)}</td>
                    <td style={{ fontWeight: 600 }}>{r.ticker}</td>
                    <td>{r.type}</td>
                    <td>{r.shares}</td>
                    <td>{r.price}</td>
                    <td>{r.currency}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.validCount > 20 && (
              <p className="dash-text-faint" style={{ padding: '8px', fontSize: '11px' }}>…และอีก {preview.validCount - 20} รายการ</p>
            )}
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '10px', marginTop: '16px' }} className="dash-modal-actions">
        <button type="button" onClick={onClose} style={btnGhost}>ยกเลิก</button>
        <button type="button" onClick={runPreview} className="dash-btn-ghost-accent" style={{ width: 'auto' }} disabled={loading}>
          {loading && !preview ? 'กำลังตรวจสอบ...' : 'ตรวจสอบ'}
        </button>
        <button type="button" onClick={runImport} style={btnPrimary} disabled={loading || !preview?.validCount}>
          {loading && preview ? 'กำลังนำเข้า...' : 'นำเข้า'}
        </button>
      </div>
    </Modal>
  )
}