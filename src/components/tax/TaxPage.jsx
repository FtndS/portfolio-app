import { useEffect, useState } from 'react'
import { api } from '../../lib/api'
import { MASKED, fmtDate } from '../../lib/format'
import { usePrivacy } from '../../lib/privacy'
import { symFor } from '../../lib/constants'
import { btnPrimary, btnGhost } from '../../lib/styles'

const STATUS_LABEL = {
  set_exempt: 'กำไรขาย โดยทั่วไปยกเว้น',
  set_dividend_final: 'หัก 10% แล้วจบ',
  set_dividend_included: 'นำไปรวมในฐานปีนี้',
  pre_2024: 'เกิดก่อนปี 2567 ไม่เข้าหลักนี้',
  not_remitted: 'ยังไม่ได้ติ๊กว่าโอนเข้าไทย',
  not_resident: 'ปีที่เกิดเงินได้อยู่ไทยไม่ถึง 180 วัน',
  needs_residence: 'ขาดจำนวนวันอยู่ในไทยของปีที่เกิดเงินได้',
  needs_fx: 'ขาดอัตราแลกตอนโอน',
  in_base: 'นำเข้าฐานของปีที่เลือกแล้ว',
  remitted_other_year: 'โอนเข้าคนละปีกับปีที่เลือก',
  loss: 'ขาดทุน ไม่บวกเข้าฐาน',
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
  const [savedFlash, setSavedFlash] = useState(false)
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
    setSavedFlash(true)
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
  const thaiRows = [...thaiSells, ...thaiDivs]
  const daysSaved = estimate?.facts?.days_in_thailand != null
  const foreignGaps = estimate?.incomplete?.length || 0

  const steps = [
    {
      id: 'tax-step-1',
      n: '1',
      title: 'วันอยู่ในไทย',
      detail: daysSaved ? `${estimate.facts.days_in_thailand} วัน` : 'ยังไม่กรอก',
      state: daysSaved ? 'done' : 'todo',
    },
    {
      id: 'tax-step-2',
      n: '2',
      title: 'วิธีคิดปันผล',
      detail: factsForm.mode === 'include' ? 'นำไปรวมคำนวณ' : 'หัก 10% แล้วจบ',
      state: 'ready',
    },
    {
      id: 'tax-step-3',
      n: '3',
      title: 'ตรวจหุ้นไทย',
      detail: thaiRows.length ? `${thaiRows.length} รายการ` : 'ไม่มีในปีนี้',
      state: 'ready',
    },
    {
      id: 'tax-step-4',
      n: '4',
      title: 'หุ้นนอกที่โอนกลับ',
      detail: foreign.length === 0 ? 'ยังไม่มีรายการ' : foreignGaps ? `อีก ${foreignGaps} รายการ` : 'ครบแล้ว',
      state: foreign.length === 0 ? 'ready' : foreignGaps ? 'todo' : 'done',
    },
  ]

  const jumpTo = (id) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  return (
    <div className="dash-tax-page">
      <header className="dash-tax-head">
        <div>
          <p className="dash-checkout-kicker">ประมาณการ</p>
          <h2 className="dash-sub-title">ภาษีจากรายการที่บันทึก</h2>
          <p className="dash-sub-lead">
            กรอกตาม 4 ขั้นด้านล่าง ระบบดึงยอดซื้อขายและปันผลจากทุกพอร์ตให้แล้ว ส่วนที่ต้องพิมพ์เองมีแค่ข้อมูลที่แอปไม่มี
          </p>
        </div>
      </header>

      <nav className="dash-tax-steps" aria-label="ขั้นตอนกรอกข้อมูลภาษี">
        {steps.map((step) => (
          <button
            key={step.id}
            type="button"
            className={`dash-tax-step dash-tax-step--${step.state}`}
            onClick={() => jumpTo(step.id)}
          >
            <span className="dash-tax-step-n">{step.n}</span>
            <span>
              <strong>{step.title}</strong>
              <em>{step.detail}</em>
            </span>
          </button>
        ))}
      </nav>

      {error && <p className="dash-tax-error">{error}</p>}
      {loading && <p className="dash-text-muted">กำลังคำนวณ...</p>}

      {estimate && !loading && (
        <>
          <form onSubmit={saveFacts}>
            <section id="tax-step-1" className="dash-card dash-tax-card">
              <p className="dash-tax-kicker">ขั้นที่ 1</p>
              <h3 className="dash-card-title">เลือกปี แล้วกรอกวันอยู่ในไทย</h3>
              <ol className="dash-tax-howto">
                <li>เลือกปีปฏิทินที่ต้องการดู ตั้งแต่เดือนมกราคมถึงธันวาคม</li>
                <li>นับทุกวันที่อยู่ในประเทศไทยในปีนั้น แล้วใส่เป็นจำนวนวัน</li>
                <li>ถ้าอยู่ถึง 180 วัน กำไรและปันผลหุ้นนอกที่โอนเข้าไทยอาจต้องนำไปรวมภาษี</li>
              </ol>
              <div className="dash-tax-facts">
                <label>
                  ปีภาษี
                  <select
                    className="dash-select"
                    value={year}
                    onChange={(e) => {
                      setSavedFlash(false)
                      setYear(Number(e.target.value))
                    }}
                  >
                    {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <span className="dash-tax-field-help">เปลี่ยนปีแล้ว วันอยู่ในไทยกับแบบ W-8BEN ของปีนั้นจะคนละชุด</span>
                </label>
                <label>
                  วันอยู่ในไทย
                  <input
                    type="number"
                    min="0"
                    max="366"
                    placeholder="เช่น 365"
                    className="dash-tax-input"
                    value={factsForm.days}
                    onChange={(e) => setFactsForm({ ...factsForm, days: e.target.value })}
                  />
                  <span className="dash-tax-field-help">อยู่ทั้งปีใส่ 365 ถ้ายังไม่แน่ใจให้เว้นไว้ รายการหุ้นนอกจะบอกว่าขาดข้อมูลนี้</span>
                </label>
                <label>
                  รายได้อื่นในปีนี้ (บาท)
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    placeholder="เว้นว่างได้"
                    className="dash-tax-input"
                    value={factsForm.other}
                    onChange={(e) => setFactsForm({ ...factsForm, other: e.target.value })}
                  />
                  <span className="dash-tax-field-help">เช่น เงินเดือน ใส่เมื่ออยากเห็นฐานรวมคร่าว ๆ หน้านี้ยังไม่หักค่าลดหย่อน</span>
                </label>
                <label className="dash-tax-check dash-tax-check--field">
                  <input
                    type="checkbox"
                    checked={factsForm.w8ben}
                    onChange={(e) => setFactsForm({ ...factsForm, w8ben: e.target.checked })}
                  />
                  <span>
                    ส่งแบบ W-8BEN ให้โบรกเกอร์หุ้นสหรัฐในปีนี้แล้ว
                    <span className="dash-tax-field-help">ส่งแล้วปันผลสหรัฐใช้หัก 15% ยังไม่ส่งใช้ 30% ติ๊กเฉพาะปีที่ส่งแบบแล้ว</span>
                  </span>
                </label>
              </div>
            </section>

            <section id="tax-step-2" className="dash-card dash-tax-card">
              <p className="dash-tax-kicker">ขั้นที่ 2</p>
              <h3 className="dash-card-title">เลือกวิธีคิดปันผล แล้วบันทึก</h3>
              <ol className="dash-tax-howto">
                <li>คนส่วนใหญ่เลือก “หัก 10% แล้วจบ” เพื่อไม่เอาปันผลไทยไปรวมในแบบยื่น</li>
                <li>แท็บปันผลให้กรอกยอดที่เข้าบัญชี ดังนั้นเลือก “หลังหัก ณ ที่จ่าย”</li>
                <li>กดบันทึกครั้งเดียว ขั้นที่ 1 และขั้นที่ 2 จะถูกเก็บไว้ปีหน้า</li>
              </ol>
              <div className="dash-tax-facts">
                <label>
                  ปันผลไทยในปีนี้
                  <select
                    className="dash-select"
                    value={factsForm.mode}
                    onChange={(e) => setFactsForm({ ...factsForm, mode: e.target.value })}
                  >
                    <option value="final">หัก 10% แล้วจบ ไม่ต้องรวมในแบบ</option>
                    <option value="include">นำไปรวมคำนวณกับรายได้อื่น</option>
                  </select>
                </label>
                <label>
                  ยอดในแท็บปันผลเป็นแบบไหน
                  <select
                    className="dash-select"
                    value={factsForm.basis}
                    onChange={(e) => setFactsForm({ ...factsForm, basis: e.target.value })}
                  >
                    <option value="net">หลังหัก ณ ที่จ่าย (ยอดที่ได้รับ)</option>
                    <option value="gross">ก่อนหัก ณ ที่จ่าย</option>
                  </select>
                </label>
              </div>
              {savedFlash && <p className="dash-tax-saved">บันทึกแล้ว ตัวเลขด้านล่างใช้ค่านี้</p>}
              <button type="submit" style={{ ...btnPrimary, width: 'auto' }} disabled={savingFacts}>
                {savingFacts ? 'กำลังบันทึก...' : 'บันทึกขั้นที่ 1 และ 2'}
              </button>
            </section>
          </form>

          <section id="tax-step-3" className="dash-card dash-tax-card">
            <p className="dash-tax-kicker">ขั้นที่ 3</p>
            <h3 className="dash-card-title">ตรวจรายการหุ้นไทย</h3>
            <ol className="dash-tax-howto">
              <li>ขั้นนี้ไม่ต้องพิมพ์ ระบบดึงจากแท็บซื้อ/ขายและปันผลของทุกพอร์ต</li>
              <li>พอร์ตที่เลือกทางซ้ายไม่มีผลกับหน้านี้อยู่แล้ว</li>
              <li>กำไรขายหุ้นในตลาดไทยของบุคคลทั่วไปอยู่ในกลุ่มที่ยกเว้น จึงไม่บวกเข้าฐาน</li>
            </ol>
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
            {thaiRows.length === 0 ? (
              <p className="dash-text-muted">ไม่มีรายการขายหรือปันผลหุ้นไทยในปี {year} ถ้ามีให้ไปบันทึกที่แท็บซื้อ/ขายหรือปันผล</p>
            ) : (
              <ul className="dash-tax-lines">
                {thaiRows.map((line) => (
                  <li key={lineKey(line)}>
                    <div>
                      <strong>{line.ticker}</strong>
                      <span>{line.kind_label} · {fmtDate(line.income_date)}</span>
                    </div>
                    <div className="dash-tax-line-amt">{money(line.native_amount, line.currency)}</div>
                    <div className={`dash-tax-status dash-tax-status--${line.status}`}>
                      {STATUS_LABEL[line.status] || line.status}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section id="tax-step-4" className="dash-card dash-tax-card">
            <p className="dash-tax-kicker">ขั้นที่ 4</p>
            <h3 className="dash-card-title">ติ๊กหุ้นนอกที่โอนเงินกลับไทย</h3>
            <ol className="dash-tax-howto">
              <li>รายการมาจากขายหรือปันผลที่บันทึกแล้ว หุ้นที่ยังถืออยู่จะไม่โผล่</li>
              <li>ติ๊กเฉพาะก้อนที่โอนเข้าบัญชีไทย เงินที่ยังอยู่ต่างประเทศปล่อยว่างไว้</li>
              <li>ใส่วันที่เงินเข้าบัญชี และอัตราแลกจากสลิปวันนั้น เช่น 35.20 บาทต่อ 1 USD</li>
              <li>กดบันทึกที่รายการนั้น ระบบจะไม่ใส่เรตวันนี้ให้เอง</li>
            </ol>
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
              <p className="dash-text-muted">
                ยังไม่มีกำไรขายหรือปันผลหุ้นนอก ไปบันทึกที่แท็บซื้อ/ขายหรือปันผล แล้วกลับมาติ๊กเฉพาะก้อนที่โอนเข้าไทย
              </p>
            ) : (
              <ul className="dash-tax-foreign">
                {foreign.map((line) => {
                  const key = lineKey(line)
                  const draft = drafts[key] || { remitted: false, remitted_on: '', fx: '' }
                  return (
                    <li key={key}>
                      <div className="dash-tax-foreign-top">
                        <div>
                          <strong>{line.ticker}</strong>
                          <span>{line.kind_label} · เกิด {fmtDate(line.income_date)} · ปี {line.earning_year || '—'}</span>
                        </div>
                        <div className="dash-tax-line-amt">
                          {money(line.native_amount, line.currency)}
                          {line.kind_label === 'ปันผล' && (
                            <span>หักต่างประเทศ {money(line.withheld_native, line.currency)}</span>
                          )}
                        </div>
                      </div>
                      <p className={`dash-tax-status dash-tax-status--${line.status}`}>
                        {STATUS_LABEL[line.status] || line.status}
                        {line.amount_thb != null ? ` · ${money(line.amount_thb)}` : ''}
                      </p>
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
                        โอนเงินก้อนนี้เข้าไทยแล้ว
                      </label>
                      {draft.remitted && (
                        <div className="dash-tax-remit">
                          <label>
                            วันที่เงินเข้าบัญชี
                            <input
                              type="date"
                              className="dash-tax-input"
                              value={draft.remitted_on}
                              onChange={(e) => patchDraft(key, { remitted_on: e.target.value })}
                            />
                          </label>
                          {line.currency !== 'THB' && (
                            <label>
                              บาทต่อ 1 {line.currency}
                              <input
                                type="number"
                                min="0"
                                step="0.0001"
                                placeholder="เช่น 35.20"
                                className="dash-tax-input"
                                value={draft.fx}
                                onChange={(e) => patchDraft(key, { fx: e.target.value })}
                              />
                            </label>
                          )}
                          <button
                            type="button"
                            style={{ ...btnGhost, width: 'auto', padding: '8px 14px' }}
                            disabled={savingKey === key}
                            onClick={() => saveRemittance(line, draft)}
                          >
                            {savingKey === key ? 'กำลังบันทึก...' : 'บันทึกรายการนี้'}
                          </button>
                        </div>
                      )}
                    </li>
                  )
                })}
              </ul>
            )}
          </section>

          <section id="tax-step-result" className="dash-card dash-tax-card dash-tax-summary">
            <p className="dash-tax-kicker">ผลลัพธ์</p>
            <h3 className="dash-card-title">ฐานโดยประมาณของปี {year}</h3>
            <p className="dash-card-sub">ตัวเลขนี้เปลี่ยนหลังบันทึกขั้นที่ 1–2 และหลังบันทึกแต่ละรายการในขั้นที่ 4</p>
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
