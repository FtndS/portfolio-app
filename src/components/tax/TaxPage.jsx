import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { MASKED, fmtDate } from '../../lib/format'
import { usePrivacy } from '../../lib/privacy'
import { symFor } from '../../lib/constants'
import { btnPrimary, btnGhost } from '../../lib/styles'

const STATUS_LABEL = {
  set_exempt: 'กำไรขาย SET — โดยทั่วไปยกเว้นสำหรับบุคคล',
  set_dividend_final: 'ใช้หัก ณ ที่จ่ายเป็นภาษีสุดท้าย',
  set_dividend_included: 'รวมเข้าฐานของปีนี้',
  pre_2024: 'เกิดก่อน 1 ม.ค. 2567 — ไม่อยู่ในหลักนำเข้าไทยชุดใหม่',
  not_remitted: 'ยังไม่บันทึกว่าโอนเข้าไทย',
  not_resident: 'ปีที่เกิดเงินได้อยู่ไทยไม่ถึง 180 วัน',
  needs_residence: 'ยังไม่ระบุวันอยู่ในไทยของปีที่เกิดเงินได้',
  needs_fx: 'ยังไม่มีอัตราแลกตอนโอน',
  in_base: 'เข้าฐานของปีนี้',
  remitted_other_year: 'โอนเข้าคนละปีกับปีที่เลือก',
  loss: 'ขาดทุน — ไม่บวกเข้าฐานในหน้านี้',
}

function lineKey(line) {
  return `${line.source_type}:${line.source_id}`
}

function yearOptions() {
  const end = new Date().getFullYear()
  const years = []
  for (let y = end; y >= end - 7; y -= 1) years.push(y)
  return years
}

export default function TaxPage() {
  const { hideValues } = usePrivacy()
  const [year, setYear] = useState(() => new Date().getFullYear())
  const [estimate, setEstimate] = useState(null)
  const [factsForm, setFactsForm] = useState({
    days: '',
    w8ben: false,
    mode: 'final',
    basis: 'gross',
    other: '',
  })
  const [drafts, setDrafts] = useState({})
  const [loading, setLoading] = useState(true)
  const [savingFacts, setSavingFacts] = useState(false)
  const [savingKey, setSavingKey] = useState('')
  const [error, setError] = useState('')
  const [rowError, setRowError] = useState('')
  const [reload, setReload] = useState(0)

  const money = (n, ccy = 'THB') => {
    if (n == null || n === '' || !Number.isFinite(Number(n))) return '—'
    if (hideValues) return MASKED
    const sym = symFor(ccy)
    return `${sym}${Number(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
  }

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    api.get('/tax/estimate', { year }).then((res) => {
      if (cancelled) return
      if (res?.ok === false) {
        setError(res.error || 'โหลดประมาณภาษีไม่สำเร็จ')
        setEstimate(null)
      } else {
        setError('')
        setEstimate(res)
        setFactsForm({
          days: res.facts?.days_in_thailand ?? '',
          w8ben: Boolean(res.facts?.us_w8ben),
          mode: res.facts?.set_dividend_mode || 'final',
          basis: res.facts?.dividend_amount_basis || 'gross',
          other: res.facts?.other_assessable_thb ?? '',
        })
        const next = {}
        for (const line of res.foreign || []) {
          next[lineKey(line)] = {
            remitted: Boolean(line.remitted_on),
            remitted_on: line.remitted_on || '',
            fx: line.fx_thb_per_unit ?? '',
          }
        }
        setDrafts(next)
      }
      setLoading(false)
    })
    return () => { cancelled = true }
  }, [year, reload])

  const saveFacts = async (e) => {
    e.preventDefault()
    setSavingFacts(true)
    setError('')
    const res = await api.put(`/tax/years/${year}`, {
      days_in_thailand: factsForm.days === '' ? null : Number(factsForm.days),
      us_w8ben: factsForm.w8ben,
      set_dividend_mode: factsForm.mode,
      dividend_amount_basis: factsForm.basis,
      other_assessable_thb: factsForm.other === '' ? null : Number(factsForm.other),
    })
    setSavingFacts(false)
    if (res?.ok === false) {
      setError(res.error || 'บันทึกข้อเท็จจริงไม่สำเร็จ')
      return
    }
    setReload((n) => n + 1)
  }

  const patchDraft = (key, patch) => {
    setDrafts((prev) => ({ ...prev, [key]: { ...prev[key], ...patch } }))
  }

  const saveRemittance = async (line, draft) => {
    const key = lineKey(line)
    setSavingKey(key)
    setRowError('')
    let res
    if (!draft.remitted) {
      res = await api.put('/tax/remittances', {
        source_type: line.source_type,
        source_id: line.source_id,
        remitted: false,
      })
    } else {
      if (!draft.remitted_on) {
        setSavingKey('')
        setRowError('ระบุวันที่โอนเข้าไทย')
        return
      }
      const fx = draft.fx === '' || draft.fx == null ? null : Number(draft.fx)
      if (fx != null && !(fx > 0)) {
        setSavingKey('')
        setRowError('อัตราแลกต้องมากกว่า 0')
        return
      }
      res = await api.put('/tax/remittances', {
        source_type: line.source_type,
        source_id: line.source_id,
        remitted: true,
        remitted_on: draft.remitted_on,
        fx_thb_per_unit: line.currency === 'THB' ? 1 : fx,
      })
    }
    setSavingKey('')
    if (res?.ok === false) {
      setRowError(res.error || 'บันทึกการโอนไม่สำเร็จ')
      if (!draft.remitted && line.remitted_on) {
        patchDraft(key, {
          remitted: true,
          remitted_on: line.remitted_on,
          fx: line.fx_thb_per_unit ?? '',
        })
      }
      return
    }
    setReload((n) => n + 1)
  }

  const thaiSells = estimate?.thai?.sells || []
  const thaiDivs = estimate?.thai?.dividends || []
  const foreign = estimate?.foreign || []

  return (
    <div className="dash-tax-page">
      <header className="dash-tax-head">
        <div>
          <p className="dash-checkout-kicker">ประมาณการ</p>
          <h2 className="dash-sub-title">ภาษีจากรายการที่บันทึก</h2>
          <p className="dash-sub-lead">
            แยกหุ้นไทยกับหุ้นนอกตามธุรกรรมและปันผลในทุกพอร์ต วันอยู่ในไทยกับวันที่โอนเข้าไทยบันทึกไว้ใช้ปีถัดไป
          </p>
        </div>
        <label className="dash-tax-year">
          ปีภาษี
          <select className="dash-select" value={year} onChange={(e) => setYear(Number(e.target.value))}>
            {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </label>
      </header>

      {error && <p className="dash-tax-error">{error}</p>}
      {loading && <p className="dash-text-muted">กำลังคำนวณ...</p>}

      {estimate && !loading && (
        <>
          <form className="dash-card dash-tax-card" onSubmit={saveFacts}>
            <h3 className="dash-card-title">ข้อเท็จจริงของปี {year}</h3>
            <p className="dash-card-sub">
              วันอยู่ในไทยและ W-8BEN ใช้กับเงินได้ที่เกิดในปีนี้ ถ้าโอนกำไรของปีอื่น ให้สลับไปบันทึกปีที่เงินได้เกิดด้วย
            </p>
            <div className="dash-tax-facts">
              <label>
                วันอยู่ในไทย
                <input
                  type="number"
                  min="0"
                  max="366"
                  className="dash-tax-input"
                  value={factsForm.days}
                  onChange={(e) => setFactsForm({ ...factsForm, days: e.target.value })}
                />
              </label>
              <label>
                รายได้อื่นในปีนี้ (บาท)
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="dash-tax-input"
                  value={factsForm.other}
                  onChange={(e) => setFactsForm({ ...factsForm, other: e.target.value })}
                />
              </label>
              <label>
                ปันผลไทย
                <select
                  className="dash-select"
                  value={factsForm.mode}
                  onChange={(e) => setFactsForm({ ...factsForm, mode: e.target.value })}
                >
                  <option value="final">ใช้หัก 10% เป็นภาษีสุดท้าย</option>
                  <option value="include">นำไปรวมคำนวณ</option>
                </select>
              </label>
              <label>
                ยอดปันผลที่บันทึก
                <select
                  className="dash-select"
                  value={factsForm.basis}
                  onChange={(e) => setFactsForm({ ...factsForm, basis: e.target.value })}
                >
                  <option value="gross">ก่อนหัก ณ ที่จ่าย</option>
                  <option value="net">หลังหัก ณ ที่จ่าย (ยอดที่ได้รับ)</option>
                </select>
              </label>
            </div>
            <label className="dash-tax-check">
              <input
                type="checkbox"
                checked={factsForm.w8ben}
                onChange={(e) => setFactsForm({ ...factsForm, w8ben: e.target.checked })}
              />
              ส่ง W-8BEN สำหรับปันผลสหรัฐในปีนี้ (ใช้อัตราหัก 15% แทน 30%)
            </label>
            <p className="dash-tax-hint">
              ฟอร์มปันผลถามจำนวนที่ได้รับ ถ้าบันทึกยอดหลังหัก ให้เลือก “หลังหัก ณ ที่จ่าย”
            </p>
            <button type="submit" style={{ ...btnPrimary, width: 'auto' }} disabled={savingFacts}>
              {savingFacts ? 'กำลังบันทึก...' : 'บันทึกข้อเท็จจริง'}
            </button>
          </form>

          <section className="dash-card dash-tax-card">
            <h3 className="dash-card-title">หุ้นไทย</h3>
            <p className="dash-card-sub">
              กำไรขายหลักทรัพย์จดทะเบียนแสดงเป็นกลุ่มที่ยกเว้นสำหรับบุคคลทั่วไป และไม่บวกเข้าฐาน
            </p>
            <div className="dash-tax-metrics">
              <div>
                <span>ปันผลที่นำไปรวม</span>
                <strong>{money(estimate.thai.dividendIncludedThb)}</strong>
              </div>
              <div>
                <span>ภาษีหัก ณ ที่จ่ายโดยประมาณ</span>
                <strong>{money(estimate.thai.dividendWithheldThb)}</strong>
              </div>
            </div>
            {thaiSells.length === 0 && thaiDivs.length === 0 ? (
              <p className="dash-text-muted">ไม่มีรายการขายหรือปันผลหุ้นไทยในปีนี้</p>
            ) : (
              <div className="dash-tax-table-wrap">
                <table className="dash-table dash-tax-table">
                  <thead>
                    <tr>
                      <th>รายการ</th>
                      <th>วันที่</th>
                      <th>จำนวน</th>
                      <th>สถานะ</th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...thaiSells, ...thaiDivs].map((line) => (
                      <tr key={lineKey(line)}>
                        <td>{line.ticker} · {line.kind_label}</td>
                        <td>{fmtDate(line.income_date)}</td>
                        <td>{money(line.native_amount, line.currency)}</td>
                        <td>{STATUS_LABEL[line.status] || line.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dash-card dash-tax-card">
            <h3 className="dash-card-title">หุ้นนอก</h3>
            <p className="dash-card-sub">
              เข้าฐานเมื่อเงินได้เกิดตั้งแต่ 1 ม.ค. 2567 อยู่ไทยอย่างน้อย 180 วันในปีนั้น และบันทึกวันโอนเข้าไทยพร้อมอัตราบาทต่อ 1 หน่วยสกุลเงิน ระบบไม่ใส่เรตวันนี้แทน
            </p>
            {estimate.cryptoSkipped > 0 && (
              <p className="dash-tax-hint">ไม่รวมคริปโต {estimate.cryptoSkipped} รายการ</p>
            )}
            {estimate.incomplete.length > 0 && (
              <p className="dash-tax-hint">
                มี {estimate.incomplete.length} รายการที่ยังไม่ครบวันอยู่ในไทยหรืออัตราแลก จึงยังไม่ถูกแปลงเข้าฐาน
              </p>
            )}
            {rowError && <p className="dash-tax-error">{rowError}</p>}
            {foreign.length === 0 ? (
              <p className="dash-text-muted">ไม่มีรายการขายหรือปันผลหุ้นนอก</p>
            ) : (
              <div className="dash-tax-table-wrap">
                <table className="dash-table dash-tax-table">
                  <thead>
                    <tr>
                      <th>รายการ</th>
                      <th>เกิดปี</th>
                      <th>จำนวน</th>
                      <th>หักต่างประเทศ</th>
                      <th>สถานะ</th>
                      <th>โอนเข้าไทย</th>
                    </tr>
                  </thead>
                  <tbody>
                    {foreign.map((line) => {
                      const key = lineKey(line)
                      const draft = drafts[key] || { remitted: false, remitted_on: '', fx: '' }
                      return (
                        <tr key={key}>
                          <td>{line.ticker} · {line.kind_label}<div className="dash-tax-sub">{fmtDate(line.income_date)}</div></td>
                          <td>{line.earning_year || '—'}</td>
                          <td>{money(line.native_amount, line.currency)}</td>
                          <td>{line.kind_label === 'ปันผล' ? money(line.withheld_native, line.currency) : '—'}</td>
                          <td>
                            <span className={`dash-tax-status dash-tax-status--${line.status}`}>
                              {STATUS_LABEL[line.status] || line.status}
                            </span>
                            {line.amount_thb != null && (
                              <div className="dash-tax-sub">{money(line.amount_thb)}</div>
                            )}
                          </td>
                          <td>
                            <label className="dash-tax-check">
                              <input
                                type="checkbox"
                                checked={draft.remitted}
                                onChange={(e) => {
                                  const remitted = e.target.checked
                                  const next = { ...draft, remitted }
                                  patchDraft(key, { remitted })
                                  if (!remitted) saveRemittance(line, next)
                                }}
                              />
                              โอนแล้ว
                            </label>
                            {draft.remitted && (
                              <div className="dash-tax-remit">
                                <input
                                  type="date"
                                  className="dash-tax-input"
                                  value={draft.remitted_on}
                                  onChange={(e) => patchDraft(key, { remitted_on: e.target.value })}
                                />
                                {line.currency !== 'THB' && (
                                  <input
                                    type="number"
                                    min="0"
                                    step="0.0001"
                                    placeholder={`บาทต่อ 1 ${line.currency}`}
                                    className="dash-tax-input"
                                    value={draft.fx}
                                    onChange={(e) => patchDraft(key, { fx: e.target.value })}
                                  />
                                )}
                                <button
                                  type="button"
                                  style={{ ...btnGhost, width: 'auto', padding: '8px 12px' }}
                                  disabled={savingKey === key}
                                  onClick={() => saveRemittance(line, draft)}
                                >
                                  {savingKey === key ? 'กำลังบันทึก...' : 'บันทึก'}
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <section className="dash-card dash-tax-card dash-tax-summary">
            <h3 className="dash-card-title">ฐานของปี {year}</h3>
            <div className="dash-tax-metrics">
              <div>
                <span>หุ้นนอกที่โอนเข้าปีนี้</span>
                <strong>{money(estimate.base.foreignRemittedThb)}</strong>
              </div>
              <div>
                <span>ปันผลไทยที่เลือกนำไปรวม</span>
                <strong>{money(estimate.base.thaiDividendsThb)}</strong>
              </div>
              <div>
                <span>รายได้อื่น</span>
                <strong>{money(estimate.base.otherThb)}</strong>
              </div>
              <div>
                <span>ฐานรวม</span>
                <strong>{money(estimate.base.totalThb)}</strong>
              </div>
              <div>
                <span>ภาษีขั้นบันไดก่อนลดหย่อน</span>
                <strong>{money(estimate.bracket.taxBeforeAllowancesThb)}</strong>
              </div>
            </div>
            <p className="dash-tax-hint">{estimate.bracket.note}</p>
            <p className="dash-tax-hint">
              ภาษีที่ถูกหักในต่างประเทศเป็นยอดโดยประมาณ เครดิตจริงใช้สูตรของกรมสรรพากร{' '}
              <a href={estimate.ftcGuideUrl} target="_blank" rel="noreferrer">คู่มือเครดิตภาษีต่างประเทศ</a>
            </p>
            <p className="dash-tax-disclaimer">{estimate.disclaimer}</p>
          </section>
        </>
      )}
    </div>
  )
}
