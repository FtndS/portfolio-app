import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { btnGhost, btnPrimary, inp } from '../../lib/styles'
import Modal from '../ui/Modal'
import './TripAIPlanner.css'

function typeLabel(type) {
  const map = {
    hotel: 'ที่พัก',
    restaurant: 'ร้านอาหาร',
    airport: 'สนามบิน',
    attraction: 'สถานที่เที่ยว',
    transport: 'การเดินทาง',
    other: 'อื่นๆ',
  }
  return map[type] || type
}

function formatQuota(quota) {
  if (!quota) return null
  if (quota.isOwner) return 'โควต้าไม่จำกัด'
  const slot = quota.tripPlan
  const limit = quota.limits?.tripPlan
  if (!slot || limit == null) return null
  return `เหลือ ${slot.remaining ?? 0}/${limit} ครั้ง/สัปดาห์`
}

export default function TripAIPlanner({ onClose, onCreated }) {
  const [input, setInput] = useState('')
  const [messages, setMessages] = useState([])
  const [questions, setQuestions] = useState([])
  const [draftPlan, setDraftPlan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [err, setErr] = useState('')
  const [quotaHint, setQuotaHint] = useState('')
  const bottomRef = useRef(null)

  useEffect(() => {
    api.get('/ai/quota').then((q) => {
      if (q && !q.error) setQuotaHint(formatQuota(q) || '')
    })
  }, [])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, questions, draftPlan, loading])

  const send = async (textOverride) => {
    const text = String(textOverride ?? input).trim()
    if (!text || loading || applying) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setErr('')
    setQuestions([])
    setDraftPlan(null)
    setLoading(true)

    const r = await api.post('/ai/trip-plan', { messages: nextMessages, apply: false })
    setLoading(false)

    if (r?.error) {
      setErr(r.error)
      return
    }

    if (r.status === 'clarify') {
      setQuestions(r.questions || [])
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `ขอข้อมูลเพิ่มนิดหน่อย:\n${(r.questions || []).map((q, i) => `${i + 1}. ${q}`).join('\n')}`,
        },
      ])
      return
    }

    if (r.status === 'plan' && r.trip) {
      setDraftPlan(r.trip)
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `ร่างแผน: ${r.trip.title}${r.trip.destination ? ` · ${r.trip.destination}` : ''} (${r.trip.days?.length || 0} วัน)`,
        },
      ])
    }
  }

  const applyPlan = async () => {
    if (!draftPlan || applying) return
    setApplying(true)
    setErr('')
    const r = await api.post('/ai/trip-plan', {
      messages,
      apply: true,
      plan: draftPlan,
    })
    setApplying(false)
    if (r?.error) {
      setErr(r.error)
      if (r.status === 'clarify' && Array.isArray(r.questions)) {
        setQuestions(r.questions)
        setDraftPlan(null)
      }
      return
    }
    if (r?.trip_id) {
      onCreated?.(r.trip_id)
      return
    }
    setErr('สร้างทริปไม่สำเร็จ')
  }

  return (
    <Modal title="AI จัดทริป" onClose={onClose}>
      <p className="dash-text-muted" style={{ margin: '0 0 12px', fontSize: 13, lineHeight: 1.5 }}>
        บอกความต้องการแบบสั้นๆ เช่น “จัดทริปญี่ปุ่น 5 วัน 4 คืน เน้นกิน” — AI จะถามเพิ่มก่อนสร้างแผน
        {quotaHint ? ` · ${quotaHint}` : ''}
      </p>

      <div className="trip-ai-chat">
        {messages.length === 0 && (
          <div className="trip-ai-empty">
            ลองพิมพ์: “จัดทริปเที่ยวญี่ปุ่นให้หน่อย 5 วัน 4 คืน เน้นกิน”
          </div>
        )}
        {messages.map((m, i) => (
          <div key={`${m.role}-${i}`} className={`trip-ai-bubble trip-ai-bubble--${m.role}`}>
            {m.content}
          </div>
        ))}
        {loading && <div className="trip-ai-bubble trip-ai-bubble--assistant">กำลังคิดแผน...</div>}
        <div ref={bottomRef} />
      </div>

      {questions.length > 0 && !draftPlan && (
        <ul className="trip-ai-questions-list">
          {questions.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ul>
      )}

      {draftPlan && (
        <div className="trip-ai-plan-preview">
          <strong>{draftPlan.title}</strong>
          <div className="dash-text-muted" style={{ fontSize: 12, marginTop: 4 }}>
            {draftPlan.destination || 'ไม่ระบุปลายทาง'}
            {draftPlan.start_date ? ` · ${draftPlan.start_date}` : ''}
            {draftPlan.end_date ? ` – ${draftPlan.end_date}` : ''}
          </div>
          <div className="trip-ai-plan-days">
            {(draftPlan.days || []).map((d) => (
              <div key={d.day_index} className="trip-ai-plan-day">
                <div className="trip-ai-plan-day-title">{d.title || `วันที่ ${d.day_index}`}</div>
                <ul>
                  {(d.places || []).slice(0, 8).map((p, idx) => (
                    <li key={`${d.day_index}-${idx}`}>
                      <span className="trip-place-type">{typeLabel(p.type)}</span>
                      {' '}
                      {p.name}
                      {(p.start_time || p.end_time) && (
                        <span className="dash-text-muted">
                          {' '}
                          {[p.start_time, p.end_time].filter(Boolean).join('–')}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <button type="button" style={btnPrimary} disabled={applying} onClick={applyPlan}>
            {applying ? 'กำลังสร้างทริป...' : 'สร้างทริปตามแผนนี้'}
          </button>
        </div>
      )}

      {err && <p className="dash-text-loss" style={{ fontSize: 13, marginTop: 10 }}>{err}</p>}

      <div className="trip-ai-compose">
        <textarea
          style={{ ...inp(), minHeight: 72, resize: 'vertical', marginBottom: 0 }}
          placeholder="พิมพ์ความต้องการทริป..."
          value={input}
          disabled={loading || applying}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault()
              send()
            }
          }}
        />
        <div className="trip-ai-compose-actions">
          <button type="button" style={{ ...btnGhost, width: 'auto' }} onClick={onClose}>
            ปิด
          </button>
          <button type="button" style={{ ...btnPrimary, width: 'auto' }} disabled={loading || applying || !input.trim()} onClick={() => send()}>
            ส่ง
          </button>
        </div>
      </div>
    </Modal>
  )
}
