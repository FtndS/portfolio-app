import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import './TripStudio.css'

function actionSummary(actions) {
  if (!actions?.length) return ''
  const counts = { add_place: 0, remove_place: 0, update_place: 0, set_day_title: 0 }
  for (const a of actions) {
    if (counts[a.type] != null) counts[a.type] += 1
  }
  const parts = []
  if (counts.add_place) parts.push(`เพิ่ม ${counts.add_place} จุด`)
  if (counts.remove_place) parts.push(`ลบ ${counts.remove_place} จุด`)
  if (counts.update_place) parts.push(`แก้ ${counts.update_place} จุด`)
  if (counts.set_day_title) parts.push(`แก้ชื่อวัน ${counts.set_day_title}`)
  return parts.join(' · ')
}

export default function TripChatRail({
  trip,
  fmtDate,
  onOpenAi,
  onEditMode,
  onExport,
  onTripUpdated,
  dayCount = 0,
  placeCount = 0,
}) {
  const [draft, setDraft] = useState('')
  const [messages, setMessages] = useState([])
  const [pendingActions, setPendingActions] = useState([])
  const [loading, setLoading] = useState(false)
  const [applying, setApplying] = useState(false)
  const [err, setErr] = useState('')
  const [quotaHint, setQuotaHint] = useState('')
  const bottomRef = useRef(null)
  const tripId = trip?.id

  const dest = trip?.destination || 'ปลายทางของคุณ'
  const route = [trip?.origin, trip?.destination].filter(Boolean).join(' → ')
  const dates =
    trip?.start_date || trip?.end_date
      ? `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}`
      : null

  useEffect(() => {
    api.get('/ai/quota').then((q) => {
      if (!q || q.error) return
      if (q.isOwner) {
        setQuotaHint('โควต้าไม่จำกัด')
        return
      }
      const slot = q.tripChat
      const limit = q.limits?.tripChat
      if (slot && limit != null) {
        setQuotaHint(`เหลือ ${slot.remaining ?? 0}/${limit} ครั้ง/สัปดาห์`)
      }
    }).catch(() => {})
  }, [tripId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading, pendingActions])

  useEffect(() => {
    setMessages([])
    setPendingActions([])
    setErr('')
    setDraft('')
  }, [tripId])

  const send = async (textOverride) => {
    const text = String(textOverride ?? draft).trim()
    if (!text || !tripId || loading || applying) return

    const nextMessages = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setDraft('')
    setErr('')
    setPendingActions([])
    setLoading(true)

    try {
      const r = await api.post('/ai/trip-chat', {
        trip_id: tripId,
        messages: nextMessages,
        apply: false,
      })
      if (r?.error) {
        setErr(r.error)
        return
      }
      const reply = String(r.reply || '').trim()
      if (reply) {
        setMessages((prev) => [...prev, { role: 'assistant', content: reply }])
      }
      setPendingActions(Array.isArray(r.actions) ? r.actions : [])
      if (r.quota?.remaining != null && r.quota?.limit != null) {
        setQuotaHint(`เหลือ ${r.quota.remaining}/${r.quota.limit} ครั้ง/สัปดาห์`)
      }
    } catch {
      setErr('เชื่อมต่อ AI ไม่สำเร็จ กรุณาลองใหม่')
    } finally {
      setLoading(false)
    }
  }

  const applyPending = async () => {
    if (!tripId || !pendingActions.length || applying) return
    setApplying(true)
    setErr('')
    try {
      const r = await api.post('/ai/trip-chat', {
        trip_id: tripId,
        apply: true,
        actions: pendingActions,
      })
      if (r?.error) {
        setErr(r.error)
        return
      }
      setPendingActions([])
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `บันทึกการปรับแผนแล้ว${r.applied?.length ? ` (${r.applied.length} รายการ)` : ''}`,
        },
      ])
      if (r.trip) onTripUpdated?.(r.trip)
    } catch {
      setErr('บันทึกการปรับแผนไม่สำเร็จ')
    } finally {
      setApplying(false)
    }
  }

  return (
    <aside className="trip-chat-rail trip-no-print" aria-label="Trip Copilot ในทริปนี้">
      <div className="trip-chat-rail-scroll">
        <p className="trip-chat-kicker">Trip Copilot</p>
        <div className="trip-chat-bubble trip-chat-bubble--ai">
          <p>
            ถามหรือขอให้ปรับ <strong>{trip?.title || 'ทริปนี้'}</strong>
            {dayCount ? <> · {dayCount} วัน</> : null}
            {placeCount ? <> · {placeCount} จุด</> : null}
          </p>
          {route && <p className="trip-chat-muted">เส้นทาง {route}</p>}
          {dates && <p className="trip-chat-muted">{dates}</p>}
          <p className="trip-chat-muted">
            {quotaHint ? `${quotaHint} · ` : ''}
            ถ้า AI เสนอการแก้แผน จะมีปุ่มยืนยันก่อนบันทึก
          </p>
        </div>

        <div className="trip-chat-card">
          <div>
            <strong>{trip?.title}</strong>
            <p className="trip-chat-muted">{dest}{dates ? ` · ${dates}` : ''}</p>
          </div>
          <button type="button" className="trip-chat-open-btn" onClick={onEditMode}>
            จัดแผน
          </button>
        </div>

        <div className="trip-chat-actions">
          <button
            type="button"
            className="trip-chat-chip"
            disabled={loading || applying}
            onClick={() => send(`ช่วยดูแผนวันนี้แล้วแนะนำจุดกินที่ดังใน${dest}`)}
          >
            แนะนำร้านดัง
          </button>
          <button
            type="button"
            className="trip-chat-chip"
            disabled={loading || applying}
            onClick={() => send('ช่วยจัดเวลาในแผนให้เดินทางสะดวกขึ้น โดยแก้เวลาที่มีอยู่')}
          >
            จัดเวลาใหม่
          </button>
          <button type="button" className="trip-chat-chip" onClick={() => onOpenAi?.()}>
            AI สร้างทริปใหม่
          </button>
          <button type="button" className="trip-chat-chip" onClick={onExport}>
            Export PDF
          </button>
        </div>

        <div className="trip-chat-thread" aria-live="polite">
          {messages.map((m, i) => (
            <div
              key={`${m.role}-${i}`}
              className={`trip-chat-bubble trip-chat-bubble--${m.role === 'user' ? 'user' : 'ai'}`}
            >
              <p style={{ whiteSpace: 'pre-wrap', margin: 0 }}>{m.content}</p>
            </div>
          ))}
          {loading && (
            <div className="trip-chat-bubble trip-chat-bubble--ai">
              <p className="trip-chat-muted" style={{ margin: 0 }}>กำลังคิด...</p>
            </div>
          )}
          <div ref={bottomRef} />
        </div>

        {pendingActions.length > 0 && (
          <div className="trip-chat-apply">
            <p className="trip-chat-muted">
              เสนอแก้แผน: {actionSummary(pendingActions) || `${pendingActions.length} รายการ`}
            </p>
            <div className="trip-chat-apply-actions">
              <button
                type="button"
                className="trip-chat-chip"
                disabled={applying}
                onClick={() => setPendingActions([])}
              >
                ยกเลิก
              </button>
              <button
                type="button"
                className="trip-chat-open-btn"
                disabled={applying}
                onClick={applyPending}
              >
                {applying ? 'กำลังบันทึก...' : 'ใช้การปรับแผนนี้'}
              </button>
            </div>
          </div>
        )}

        {err && <p className="trip-chat-err">{err}</p>}
      </div>

      <div className="trip-chat-compose">
        <p className="trip-chat-compose-label">ถามหรือขอให้ปรับทริปนี้</p>
        <div className="trip-chat-compose-row">
          <input
            type="text"
            value={draft}
            placeholder="เช่น เพิ่มร้านราเมงในวันที่ 2..."
            disabled={loading || applying}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') send()
            }}
          />
          <button
            type="button"
            className="trip-chat-send"
            disabled={loading || applying || !draft.trim()}
            onClick={() => send()}
            aria-label="ส่ง"
          >
            ↑
          </button>
        </div>
      </div>
    </aside>
  )
}
