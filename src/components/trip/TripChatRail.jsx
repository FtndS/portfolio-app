import { useState } from 'react'
import './TripStudio.css'

export default function TripChatRail({
  trip,
  fmtDate,
  onOpenAi,
  onEditMode,
  onExport,
  dayCount = 0,
  placeCount = 0,
}) {
  const [draft, setDraft] = useState('')
  const dest = trip?.destination || 'ปลายทางของคุณ'
  const route = [trip?.origin, trip?.destination].filter(Boolean).join(' → ')
  const dates =
    trip?.start_date || trip?.end_date
      ? `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}`
      : null

  const ask = (text) => {
    const q = String(text || draft).trim()
    if (!q) {
      onOpenAi?.()
      return
    }
    setDraft('')
    onOpenAi?.(q)
  }

  return (
    <aside className="trip-chat-rail trip-no-print" aria-label="สรุปและผู้ช่วยทริป">
      <div className="trip-chat-rail-scroll">
        <p className="trip-chat-kicker">Trip Copilot</p>
        <div className="trip-chat-bubble trip-chat-bubble--ai">
          <p>
            แผน <strong>{trip?.title || 'ทริปนี้'}</strong>
            {dest ? <> ที่ <strong>{dest}</strong></> : null}
            {dayCount ? <> · {dayCount} วัน</> : null}
            {placeCount ? <> · {placeCount} จุด</> : null}
          </p>
          {route && <p className="trip-chat-muted">เส้นทาง {route}</p>}
          {dates && <p className="trip-chat-muted">{dates}</p>}
          <p className="trip-chat-muted">
            อ่านแผนเป็นการ์ดด้านกลาง คลิกจุดเพื่อซูมแผนที่ — ราคาบนการ์ดเป็นงบประมาณในแผน
            (เฟสถัดไปจะดึงราคาจริงจากพาร์ทเนอร์)
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
          <button type="button" className="trip-chat-chip" onClick={() => onOpenAi?.()}>
            AI สร้างทริปใหม่
          </button>
          <button type="button" className="trip-chat-chip" onClick={onExport}>
            Export PDF
          </button>
          <button
            type="button"
            className="trip-chat-chip"
            onClick={() => ask(`ช่วยปรับแผนทริป${dest ? ` ${dest}` : ''} ให้เน้นกินและเดินทางสะดวก`)}
          >
            ขอ AI ปรับแผน
          </button>
        </div>
      </div>

      <div className="trip-chat-compose">
        <p className="trip-chat-compose-label">ถามอะไรก็ได้เกี่ยวกับทริป</p>
        <div className="trip-chat-compose-row">
          <input
            type="text"
            value={draft}
            placeholder="เช่น ช่วยเพิ่มวันเที่ยวเกียวโต..."
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') ask()
            }}
          />
          <button type="button" className="trip-chat-send" onClick={() => ask()} aria-label="ส่ง">
            ↑
          </button>
        </div>
      </div>
    </aside>
  )
}
