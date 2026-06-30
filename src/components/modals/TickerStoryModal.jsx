import { useState, useEffect, useMemo } from 'react'
import { api } from '../../lib/api'
import { inp, btnPrimary, btnGhost } from '../../lib/styles'
import { symFor } from '../../lib/constants'
import { MASKED, fmtDate, fmtShares } from '../../lib/format'
import { usePrivacy } from '../../lib/privacy'
import { buildTickerTimeline } from '../../lib/timeline'
import Field from '../ui/Field'
import Modal from '../ui/Modal'
import NewsCard from '../news/NewsCard'

const HORIZONS = ['', '1–3 ปี', '3–5 ปี', '5–10 ปี', '10+ ปี', 'ไม่กำหนด']

export default function TickerStoryModal({
  ticker,
  portfolioId,
  holding,
  transactions,
  journal,
  dividends,
  onClose,
  fmtTx,
}) {
  const { hideValues } = usePrivacy()
  const [thesis, setThesis] = useState({ thesis: '', invalidation: '', horizon: '' })
  const [loadingThesis, setLoadingThesis] = useState(true)
  const [saving, setSaving] = useState(false)
  const [thesisMsg, setThesisMsg] = useState('')
  const [thesisErr, setThesisErr] = useState('')

  const [tickerNews, setTickerNews] = useState([])
  const [loadingNews, setLoadingNews] = useState(true)

  const [aiSummary, setAiSummary] = useState('')
  const [loadingAi, setLoadingAi] = useState(false)
  const [aiErr, setAiErr] = useState('')

  const timeline = useMemo(
    () => buildTickerTimeline(ticker, { transactions, journal, dividends }),
    [ticker, transactions, journal, dividends],
  )

  const journalEntries = useMemo(
    () => journal.filter((j) => timeline.some((e) => e.type === 'journal' && e.journal?.id === j.id)),
    [journal, timeline],
  )

  useEffect(() => {
    let cancelled = false
    setLoadingThesis(true)
    api.get(`/thesis/${encodeURIComponent(ticker)}`, { portfolio_id: portfolioId }).then((r) => {
      if (cancelled) return
      setThesis({
        thesis: r.thesis || '',
        invalidation: r.invalidation || '',
        horizon: r.horizon || '',
      })
      setLoadingThesis(false)
    })
    return () => { cancelled = true }
  }, [ticker, portfolioId])

  useEffect(() => {
    let cancelled = false
    setLoadingNews(true)
    setTickerNews([])
    api.fetch(`/news/ticker/${encodeURIComponent(ticker)}`).then(async (res) => {
      if (cancelled) return
      if (res.ok) {
        const data = await res.json()
        setTickerNews(Array.isArray(data) ? data : [])
      }
      setLoadingNews(false)
    }).catch(() => {
      if (!cancelled) setLoadingNews(false)
    })
    return () => { cancelled = true }
  }, [ticker])

  const saveThesis = async () => {
    setSaving(true)
    setThesisErr('')
    setThesisMsg('')
    const r = await api.put(`/thesis/${encodeURIComponent(ticker)}`, {
      portfolio_id: portfolioId,
      ...thesis,
    })
    setSaving(false)
    if (r.ticker) setThesisMsg('บันทึก thesis แล้ว')
    else setThesisErr(r.error || 'บันทึกไม่สำเร็จ')
  }

  const summarizeJournal = async () => {
    setLoadingAi(true)
    setAiErr('')
    setAiSummary('')
    try {
      const r = await api.post('/ai/ticker-journal', {
        ticker,
        thesis,
        journal: journalEntries.slice(0, 12),
      })
      if (r.summary) setAiSummary(r.summary)
      else if (r.code === 'AI_QUOTA_EXCEEDED') setAiErr(r.error || 'ใช้ครบโควต้าสัปดาห์นี้แล้ว')
      else setAiErr(r.error || 'สรุปไม่สำเร็จ')
    } catch {
      setAiErr('เกิดข้อผิดพลาด กรุณาลองใหม่')
    }
    setLoadingAi(false)
  }

  const renderTimelineItem = (event) => {
    if (event.type === 'transaction') {
      const t = event.tx
      const isBuy = t.type === 'BUY'
      return (
        <div key={event.id} className="dash-timeline-item">
          <div className="dash-timeline-dot dash-timeline-dot--tx" />
          <div className="dash-timeline-body">
            <div className="dash-timeline-meta">{fmtDate(event.date)} · Transaction</div>
            <div className={`dash-timeline-title ${isBuy ? 'dash-text-gain' : 'dash-text-loss'}`}>
              {t.type} {fmtShares(t.shares)} หุ้น
              {!hideValues && <> @ {fmtTx(t, t.price)}</>}
            </div>
            {t.note && <p className="dash-timeline-note">{t.note}</p>}
          </div>
        </div>
      )
    }
    if (event.type === 'journal') {
      const j = event.journal
      return (
        <div key={event.id} className="dash-timeline-item">
          <div className="dash-timeline-dot dash-timeline-dot--journal" />
          <div className="dash-timeline-body">
            <div className="dash-timeline-meta">{fmtDate(event.date)} · Journal{j.tag ? ` · ${j.tag}` : ''}</div>
            <div className="dash-timeline-title">{j.title || 'บันทึก'}</div>
            {j.content && <p className="dash-timeline-note">{j.content}</p>}
          </div>
        </div>
      )
    }
    const d = event.dividend
    return (
      <div key={event.id} className="dash-timeline-item">
        <div className="dash-timeline-dot dash-timeline-dot--div" />
        <div className="dash-timeline-body">
          <div className="dash-timeline-meta">{fmtDate(event.date)} · ปันผล</div>
          <div className="dash-timeline-title dash-text-gain">
            {hideValues ? MASKED : `${symFor(d.currency || 'THB')}${Number(d.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
          {d.note && <p className="dash-timeline-note">{d.note}</p>}
        </div>
      </div>
    )
  }

  return (
    <Modal title={`${ticker}${holding?.name ? ` — ${holding.name}` : ''}`} onClose={onClose} wide>
      <p className="dash-text-muted" style={{ fontSize: '13px', marginBottom: '16px', lineHeight: 1.6 }}>
        บันทึกเหตุผลถือหุ้นและดู timeline การลงทุนต่อตัว — จุดเด่นของ PortDiary
      </p>

      <section className="dash-story-section">
        <h3 className="dash-story-heading">Investment Thesis</h3>
        {loadingThesis ? (
          <p className="dash-text-faint" style={{ fontSize: '13px' }}>กำลังโหลด...</p>
        ) : (
          <>
            <Field label="ทำไมถึงถือ / ซื้อ?">
              <textarea
                style={{ ...inp(), height: '88px', resize: 'vertical', marginBottom: 0 }}
                placeholder="เช่น compounder คุณภาพสูง, moat แข็ง, ถือ 10+ ปี"
                value={thesis.thesis}
                onChange={(e) => setThesis({ ...thesis, thesis: e.target.value })}
              />
            </Field>
            <Field label="เงื่อนไขที่ทำให้เปลี่ยนใจ (Thesis break)">
              <textarea
                style={{ ...inp(), height: '72px', resize: 'vertical', marginBottom: 0 }}
                placeholder="เช่น moat อ่อนลง, หนี้พุ่ง, เปลี่ยน CEO"
                value={thesis.invalidation}
                onChange={(e) => setThesis({ ...thesis, invalidation: e.target.value })}
              />
            </Field>
            <Field label="ระยะเวลาที่ตั้งใจถือ">
              <select
                style={inp({ marginBottom: 0 })}
                value={thesis.horizon}
                onChange={(e) => setThesis({ ...thesis, horizon: e.target.value })}
              >
                {HORIZONS.map((h) => (
                  <option key={h || 'none'} value={h}>{h || '— เลือก —'}</option>
                ))}
              </select>
            </Field>
            {thesisErr && <p className="dash-text-loss" style={{ fontSize: '13px', marginTop: '8px' }}>{thesisErr}</p>}
            {thesisMsg && <p className="dash-text-gain" style={{ fontSize: '13px', marginTop: '8px' }}>{thesisMsg}</p>}
            <button type="button" onClick={saveThesis} style={{ ...btnPrimary, marginTop: '12px' }} disabled={saving}>
              {saving ? 'กำลังบันทึก...' : 'บันทึก Thesis'}
            </button>
          </>
        )}
      </section>

      <section className="dash-story-section">
        <div className="dash-story-heading-row">
          <h3 className="dash-story-heading">Timeline</h3>
          <span className="dash-text-faint" style={{ fontSize: '12px' }}>{timeline.length} เหตุการณ์</span>
        </div>
        {timeline.length === 0 ? (
          <p className="dash-text-faint" style={{ fontSize: '13px' }}>ยังไม่มี transaction, journal หรือปันผลของหุ้นนี้</p>
        ) : (
          <div className="dash-timeline">{timeline.map(renderTimelineItem)}</div>
        )}
      </section>

      {journalEntries.length > 0 && (
        <section className="dash-story-section">
          <div className="dash-story-heading-row">
            <h3 className="dash-story-heading">AI สรุปจาก Journal</h3>
            <button type="button" className="dash-btn-ghost-accent" style={{ width: 'auto', padding: '6px 12px', fontSize: '12px' }} onClick={summarizeJournal} disabled={loadingAi}>
              {loadingAi ? 'กำลังสรุป...' : 'สรุปให้หน่อย'}
            </button>
          </div>
          {aiErr && <p className="dash-text-loss" style={{ fontSize: '13px' }}>{aiErr}</p>}
          {aiSummary && <p className="dash-inset" style={{ padding: '12px', fontSize: '13px', lineHeight: 1.7, margin: 0 }}>{aiSummary}</p>}
          {!aiSummary && !loadingAi && !aiErr && (
            <p className="dash-text-faint" style={{ fontSize: '12px' }}>ให้ AI อ่าน journal ที่เกี่ยวกับ {ticker} และเทียบกับ thesis ของคุณ</p>
          )}
        </section>
      )}

      <section className="dash-story-section" style={{ marginBottom: 0 }}>
        <h3 className="dash-story-heading">ข่าวล่าสุด</h3>
        {loadingNews ? (
          <p className="dash-text-faint" style={{ fontSize: '13px' }}>กำลังโหลดข่าว...</p>
        ) : tickerNews.length === 0 ? (
          <p className="dash-text-faint" style={{ fontSize: '13px' }}>ไม่พบข่าวของหุ้นนี้</p>
        ) : (
          tickerNews.slice(0, 5).map((article, idx) => <NewsCard key={idx} article={article} />)
        )}
      </section>

      <div style={{ marginTop: '16px' }}>
        <button type="button" onClick={onClose} style={btnGhost}>ปิด</button>
      </div>
    </Modal>
  )
}
