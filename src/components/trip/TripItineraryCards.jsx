import { PlacePhoto } from './TripPlaceSearch'
import { TripPlaceBooking } from './FlightBookingPanel'
import { showPlaceOnMap } from '../../lib/tripMap'
import { showPlacePhoto, showPlaceBooking } from '../../lib/tripTransport'
import { formatTripMoney, HOME_CURRENCY } from '../../lib/tripFx'
import './TripStudio.css'

const TYPE_META = {
  hotel: { label: 'ที่พัก', icon: '🏨', kind: 'stay' },
  restaurant: { label: 'ร้านอาหาร', icon: '🍽️', kind: 'place' },
  airport: { label: 'สนามบิน', icon: '✈️', kind: 'airport' },
  attraction: { label: 'สถานที่เที่ยว', icon: '📍', kind: 'place' },
  transport: { label: 'การเดินทาง', icon: '🚌', kind: 'transport' },
  other: { label: 'อื่นๆ', icon: '📌', kind: 'place' },
}

function formatTime(t) {
  if (!t) return null
  const s = String(t).trim()
  const m = /^(\d{1,2}):(\d{2})/.exec(s)
  if (!m) return s
  return `${m[1].padStart(2, '0')}:${m[2]}`
}

function timeRange(place) {
  const a = formatTime(place.start_time)
  const b = formatTime(place.end_time)
  if (a && b) return `${a} – ${b}`
  return a || b || null
}

function FlightCard({ place, onSelect, focused, formatBudget }) {
  const leg = place.flight_leg
  return (
    <article className={`trip-icard trip-icard--flight${focused ? ' is-focused' : ''}`}>
      <div className="trip-icard-rail">
        <span className="trip-icard-dot trip-icard-dot--flight" aria-hidden>✈️</span>
      </div>
      <div className="trip-icard-body">
        <div className="trip-icard-top">
          <span className="trip-icard-badge">เที่ยวบิน</span>
          {timeRange(place) && <span className="trip-icard-time">{timeRange(place)}</span>}
        </div>
        <h4 className="trip-icard-title">{place.name}</h4>
        {leg && (
          <div className="trip-icard-flight-route">
            <strong>{leg.originLabel || leg.origin}</strong>
            <span aria-hidden>→</span>
            <strong>{leg.destinationLabel || leg.destination}</strong>
            {leg.departDate && (
              <span className="trip-icard-muted">
                · {String(leg.departDate).slice(0, 10)}
                {leg.returnDate ? ` – ${String(leg.returnDate).slice(0, 10)}` : ''}
              </span>
            )}
          </div>
        )}
        {place.notes && <p className="trip-icard-notes">{place.notes}</p>}
        {place.budget != null && (
          <p className="trip-icard-price">
            จากงบในแผน <strong>{formatBudget(place.budget)}</strong>
            <span className="trip-icard-price-tag">ประมาณการ</span>
          </p>
        )}
        {showPlaceBooking(place) && <TripPlaceBooking place={place} />}
        {onSelect && showPlaceOnMap(place) && (
          <button type="button" className="trip-icard-map-btn" onClick={() => onSelect(place)}>
            แสดงบนแผนที่
          </button>
        )}
      </div>
    </article>
  )
}

function StayCard({ place, onSelect, focused, formatBudget }) {
  const canMap = onSelect && showPlaceOnMap(place)
  return (
    <article className={`trip-icard trip-icard--stay${focused ? ' is-focused' : ''}`}>
      <div className="trip-icard-rail">
        <span className="trip-icard-dot trip-icard-dot--stay" aria-hidden>🏨</span>
      </div>
      <div className={`trip-icard-body${showPlacePhoto(place) ? ' trip-icard-body--media' : ''}`}>
        {showPlacePhoto(place) && (
          <PlacePhoto
            url={place.photo_url}
            alt={place.name}
            className="trip-icard-photo"
            type="hotel"
          />
        )}
        <div className="trip-icard-content">
          <div className="trip-icard-top">
            <span className="trip-icard-badge">ที่พัก</span>
            {timeRange(place) && <span className="trip-icard-time">{timeRange(place)}</span>}
          </div>
          {canMap ? (
            <button type="button" className="trip-icard-title-btn" onClick={() => onSelect(place)}>
              <h4 className="trip-icard-title">{place.name}</h4>
            </button>
          ) : (
            <h4 className="trip-icard-title">{place.name}</h4>
          )}
          {place.address && <p className="trip-icard-notes">{place.address}</p>}
          {place.notes && <p className="trip-icard-notes">{place.notes}</p>}
          {place.budget != null && (
            <p className="trip-icard-price">
              จากงบในแผน <strong>{formatBudget(place.budget)}</strong>
              <span className="trip-icard-price-tag">ประมาณการ</span>
            </p>
          )}
          {showPlaceBooking(place) && <TripPlaceBooking place={place} />}
        </div>
      </div>
    </article>
  )
}

function PlaceCard({ place, onSelect, focused, formatBudget }) {
  const meta = TYPE_META[place.type] || TYPE_META.other
  const canMap = onSelect && showPlaceOnMap(place)
  const withPhoto = showPlacePhoto(place)
  return (
    <article className={`trip-icard trip-icard--place${focused ? ' is-focused' : ''}`}>
      <div className="trip-icard-rail">
        <span className={`trip-icard-dot trip-icard-dot--${place.type || 'other'}`} aria-hidden>
          {meta.icon}
        </span>
      </div>
      <div className={`trip-icard-body${withPhoto ? ' trip-icard-body--media' : ''}`}>
        {withPhoto && (
          <PlacePhoto
            url={place.photo_url}
            alt={place.name}
            className="trip-icard-photo trip-icard-photo--sm"
            type={place.type || 'other'}
          />
        )}
        <div className="trip-icard-content">
          <div className="trip-icard-top">
            <span className="trip-icard-badge">{meta.label}</span>
            {timeRange(place) && <span className="trip-icard-time">{timeRange(place)}</span>}
          </div>
          {canMap ? (
            <button type="button" className="trip-icard-title-btn" onClick={() => onSelect(place)}>
              <h4 className="trip-icard-title">{place.name}</h4>
            </button>
          ) : (
            <h4 className="trip-icard-title">{place.name}</h4>
          )}
          {place.address && <p className="trip-icard-notes">{place.address}</p>}
          {place.notes && <p className="trip-icard-notes">{place.notes}</p>}
          {place.budget != null && (
            <p className="trip-icard-price">
              จากงบในแผน <strong>{formatBudget(place.budget)}</strong>
              <span className="trip-icard-price-tag">ประมาณการ</span>
            </p>
          )}
          {showPlaceBooking(place) && <TripPlaceBooking place={place} />}
        </div>
      </div>
    </article>
  )
}

function TransportCard({ place, onSelect, focused, formatBudget }) {
  if (place.flight_leg) {
    return <FlightCard place={place} onSelect={onSelect} focused={focused} formatBudget={formatBudget} />
  }
  return (
    <article className={`trip-icard trip-icard--transport${focused ? ' is-focused' : ''}`}>
      <div className="trip-icard-rail">
        <span className="trip-icard-dot trip-icard-dot--transport" aria-hidden>🚆</span>
      </div>
      <div className="trip-icard-body">
        <div className="trip-icard-top">
          <span className="trip-icard-badge">การเดินทาง</span>
          {timeRange(place) && <span className="trip-icard-time">{timeRange(place)}</span>}
        </div>
        <h4 className="trip-icard-title">{place.name}</h4>
        {place.notes && <p className="trip-icard-notes">{place.notes}</p>}
        {place.budget != null && (
          <p className="trip-icard-price">
            จากงบในแผน <strong>{formatBudget(place.budget)}</strong>
            <span className="trip-icard-price-tag">ประมาณการ</span>
          </p>
        )}
        {showPlaceBooking(place) && <TripPlaceBooking place={place} />}
      </div>
    </article>
  )
}

export default function TripItineraryCards({
  day,
  places,
  fmtDate,
  focusedPlaceId = null,
  onSelectPlace = null,
  formatBudget = (n) => formatTripMoney(n, HOME_CURRENCY),
}) {
  const sorted = [...(places || [])].sort((a, b) => {
    const at = String(a.start_time || '')
    const bt = String(b.start_time || '')
    if (at && bt && at !== bt) return at.localeCompare(bt)
    if (at && !bt) return -1
    if (!at && bt) return 1
    return (a.sort_order ?? 0) - (b.sort_order ?? 0)
  })

  return (
    <div className="trip-icards">
      <header className="trip-icards-dayhead">
        <div>
          <p className="trip-icards-kicker">Day {day?.day_index ?? '—'}</p>
          <h3 className="trip-icards-daytitle">
            {day?.title || `วันที่ ${day?.day_index || ''}`}
            {day?.date ? <span> · {fmtDate(day.date)}</span> : null}
          </h3>
        </div>
        <span className="trip-icards-count">{sorted.length} จุด</span>
      </header>

      {sorted.length === 0 && (
        <div className="trip-empty trip-empty-compact">ยังไม่มีจุดในวันนี้ — สลับไปโหมดจัดแผนเพื่อเพิ่ม</div>
      )}

      <div className="trip-icards-list">
        {sorted.map((place) => {
          const focused = focusedPlaceId != null && String(focusedPlaceId) === String(place.id)
          const props = {
            place,
            focused,
            onSelect: onSelectPlace,
            formatBudget,
          }
          if (place.type === 'hotel') return <StayCard key={place.id} {...props} />
          if (place.type === 'transport') return <TransportCard key={place.id} {...props} />
          if (place.type === 'airport') return <PlaceCard key={place.id} {...props} />
          return <PlaceCard key={place.id} {...props} />
        })}
      </div>
    </div>
  )
}
