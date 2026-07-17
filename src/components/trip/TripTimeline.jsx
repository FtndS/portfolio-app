import { PlacePhoto } from './TripPlaceSearch'
import { BookingLinks } from './BookingLinks'
import './TripTimeline.css'

const TYPE_LABELS = {
  hotel: 'ที่พัก',
  restaurant: 'ร้านอาหาร',
  airport: 'สนามบิน',
  attraction: 'สถานที่เที่ยว',
  transport: 'การเดินทาง',
  other: 'อื่นๆ',
}

export function dayHeading(dayIndex) {
  if (dayIndex === 1) return 'วันแรก'
  return `วันที่ ${dayIndex}`
}

export function formatTimeTh(t) {
  if (!t) return null
  const s = String(t).trim()
  const m = /^(\d{1,2}):(\d{2})/.exec(s)
  if (!m) return s
  return `${m[1].padStart(2, '0')}.${m[2]} น.`
}

export function periodLabel(startTime) {
  if (!startTime) return null
  const h = Number(String(startTime).split(':')[0])
  if (!Number.isFinite(h)) return null
  if (h < 12) return 'เช้า'
  if (h < 17) return 'บ่าย'
  return 'เย็น'
}

function placeBlurb(place) {
  const parts = []
  if (place.notes) parts.push(place.notes)
  else if (place.address) parts.push(place.address)
  else {
    const type = TYPE_LABELS[place.type] || 'จุดแวะ'
    parts.push(`${type}ในแผนทริป — ${place.name}`)
  }
  if (place.budget != null) {
    parts.push(`งบประมาณประมาณ ฿${Number(place.budget).toLocaleString('th-TH')}`)
  }
  return parts.join(' ')
}

function DaySummary({ places }) {
  const names = (places || []).map((p) => p.name).filter(Boolean)
  if (!names.length) return 'ยังไม่มีจุดแวะ'
  return names.join(' - ')
}

function photoCaption(place) {
  if (place.address) return place.address
  if (place.notes) return place.notes
  return TYPE_LABELS[place.type] || 'จุดแวะ'
}

export function TripDayTimeline({
  day,
  places,
  fmtDate,
  eagerPhotos = false,
  focusedPlaceId = null,
  onSelectPlace = null,
}) {
  const sorted = [...(places || [])].sort((a, b) => {
    const at = String(a.start_time || '')
    const bt = String(b.start_time || '')
    if (at && bt && at !== bt) return at.localeCompare(bt)
    if (at && !bt) return -1
    if (!at && bt) return 1
    const ao = a.sort_order ?? 0
    const bo = b.sort_order ?? 0
    if (ao !== bo) return ao - bo
    return (a.id || 0) - (b.id || 0)
  })

  let lastPeriod = null

  return (
    <section className="trip-tl-day">
      <header className="trip-tl-day-head">
        <div className="trip-tl-day-label">
          <strong>{dayHeading(day.day_index)}</strong>
          {day.date && <span>{fmtDate(day.date)}</span>}
        </div>
        <p className="trip-tl-day-summary">
          <DaySummary places={sorted} />
        </p>
      </header>

      <div className="trip-tl-day-body">
        {sorted.length === 0 && (
          <p className="trip-tl-empty">ยังไม่มีรายละเอียดในวันนี้</p>
        )}
        {sorted.map((place) => {
          const period = periodLabel(place.start_time)
          const showPeriod = period && period !== lastPeriod
          if (showPeriod) lastPeriod = period
          const hero = Boolean(place.photo_url) && (place.type === 'attraction' || place.type === 'airport')
          const inline = Boolean(place.photo_url) && !hero
          const timeLabel = formatTimeTh(place.start_time)
          const isFocused = focusedPlaceId != null && String(focusedPlaceId) === String(place.id)
          const canFocus = Boolean(onSelectPlace) && place.type !== 'transport'

          return (
            <div
              key={place.id || `${place.name}-${place.start_time}`}
              className={`trip-tl-block${isFocused ? ' is-map-focused' : ''}`}
            >
              {showPeriod && (
                <div className="trip-tl-period">{period}</div>
              )}
              <div className="trip-tl-row">
                <div className="trip-tl-time">
                  {timeLabel || (showPeriod ? '' : '—')}
                </div>
                <div className={`trip-tl-content${hero ? ' trip-tl-content--hero' : ''}`}>
                  <p className="trip-tl-text">
                    {canFocus ? (
                      <button
                        type="button"
                        className="trip-tl-place-name trip-tl-place-name--btn"
                        onClick={() => onSelectPlace(place)}
                        title={place.lat != null ? 'แสดงบนแผนที่' : 'ยังไม่มีพิกัด'}
                      >
                        {place.name}
                      </button>
                    ) : (
                      <span className="trip-tl-place-name">{place.name}</span>
                    )}
                    {place.type && (
                      <span className="trip-tl-type"> · {TYPE_LABELS[place.type] || place.type}</span>
                    )}
                    {' — '}
                    {placeBlurb(place)}
                    {place.end_time && (
                      <span className="trip-tl-end"> (ถึง {formatTimeTh(place.end_time)})</span>
                    )}
                  </p>
                  <BookingLinks links={place.booking_links} />
                  {place.photo_url && (
                    <div className={hero ? 'trip-tl-photo-hero' : 'trip-tl-photo-inline'}>
                      <PlacePhoto
                        url={place.photo_url}
                        alt={place.name}
                        className={hero ? 'trip-tl-img-hero' : 'trip-tl-img-thumb'}
                        type={place.type}
                        eager={eagerPhotos}
                      />
                      {inline && (
                        <p className="trip-tl-caption">{photoCaption(place)}</p>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export default function TripTimeline({
  trip,
  days,
  places,
  fmtDate,
  activeDayId,
  allDays = false,
  eagerPhotos = false,
  focusedPlaceId = null,
  onSelectPlace = null,
}) {
  const dayList = allDays
    ? (days || [])
    : (days || []).filter((d) => d.id === activeDayId)

  const placesByDay = (dayId) =>
    (places || []).filter((p) => p.trip_day_id === dayId)

  if (!dayList.length) {
    return <div className="trip-tl-empty">เลือกวันเพื่อดูแผน</div>
  }

  const tripMeta = [trip?.destination, trip?.start_date && trip?.end_date
    ? `${fmtDate(trip.start_date)} – ${fmtDate(trip.end_date)}`
    : null].filter(Boolean).join(' · ')

  const nightCount = Math.max(0, dayList.length - 1)
  const durationLabel = dayList.length
    ? (nightCount > 0 ? `${dayList.length} วัน ${nightCount} คืน` : `${dayList.length} วัน`)
    : null
  const highlightNames = dayList
    .flatMap((d) => placesByDay(d.id))
    .map((p) => p.name)
    .filter(Boolean)
    .slice(0, 8)

  return (
    <div className={`trip-tl${allDays ? ' trip-tl--export' : ''}`}>
      {allDays && (
        <header className="trip-tl-cover">
          <p className="trip-tl-cover-kicker">PortDiary Trip Plan</p>
          <h1 className="trip-tl-cover-title">{trip?.title || 'แผนทริป'}</h1>
          {tripMeta && <p className="trip-tl-cover-meta">{tripMeta}</p>}
          {durationLabel && <p className="trip-tl-cover-duration">{durationLabel}</p>}
          {highlightNames.length > 0 && (
            <div className="trip-tl-cover-highlights">
              <p className="trip-tl-cover-highlights-label">ไฮไลต์ในทริป</p>
              <ul>
                {highlightNames.map((name) => (
                  <li key={name}>{name}</li>
                ))}
              </ul>
            </div>
          )}
          <p className="trip-tl-cover-note">
            แผนแนะนำเท่านั้น — ลิงก์จองเปิดไปยังเว็บภายนอก ไม่ได้จองในแอป
          </p>
        </header>
      )}
      {dayList.map((day) => (
        <TripDayTimeline
          key={day.id}
          day={day}
          places={placesByDay(day.id)}
          fmtDate={fmtDate}
          eagerPhotos={eagerPhotos || allDays}
          focusedPlaceId={allDays ? null : focusedPlaceId}
          onSelectPlace={allDays ? null : onSelectPlace}
        />
      ))}
    </div>
  )
}
