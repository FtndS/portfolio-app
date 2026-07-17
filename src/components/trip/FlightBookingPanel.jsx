/** Flight booking panel — Phase 1 deep links (compare prices on partner sites). */

import { BookingLinks } from './BookingLinks'

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

export function FlightBookingPanel({ flightLeg, links, className = '', compact = false }) {
  const list = Array.isArray(links) ? links.filter((l) => l?.url && l?.label) : []
  if (!flightLeg || !list.length) return null

  const tripTypeLabel = flightLeg.tripType === 'roundtrip' ? 'ไป–กลับ' : 'เที่ยวเดียว'

  return (
    <div className={`trip-flight-panel${compact ? ' trip-flight-panel--compact' : ''} ${className}`.trim()}>
      <div className="trip-flight-summary">
        <div className="trip-flight-summary-head">
          <strong>เที่ยวบิน</strong>
          <span className="trip-flight-meta">
            {tripTypeLabel} · Economy · {flightLeg.passengers || 1} ผู้โดยสาร
          </span>
        </div>
        <div className="trip-flight-leg">
          <span className="trip-flight-code">{flightLeg.origin}</span>
          <span className="trip-flight-arrow" aria-hidden>→</span>
          <span className="trip-flight-code">{flightLeg.destination}</span>
          {flightLeg.departDate && (
            <span className="trip-flight-dates">
              · {fmtDate(flightLeg.departDate)}
              {flightLeg.returnDate ? ` – ${fmtDate(flightLeg.returnDate)}` : ''}
            </span>
          )}
        </div>
        {flightLeg.label && <p className="trip-flight-route-label">{flightLeg.label}</p>}
      </div>

      <div className="trip-flight-options">
        <p className="trip-flight-options-head">เปรียบเทียบราคา — กดเพื่อดูที่เว็บ</p>
        <ul className="trip-flight-options-list">
          {list.map((link) => (
            <li key={link.url}>
              <a
                className="trip-flight-option"
                href={link.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                <span className="trip-flight-option-name">{link.label}</span>
                <span className="trip-flight-option-cta">ดูราคา</span>
              </a>
            </li>
          ))}
        </ul>
      </div>

      <p className="trip-flight-disclaimer">
        ราคาจริงแสดงบนเว็บพาร์ทเนอร์เมื่อกดดูราคา (ยังไม่ดึงราคาเข้าแอป)
      </p>
    </div>
  )
}

export function TripPlaceBooking({ place, className = '', compact = false }) {
  if (!place) return null
  if (place.type === 'transport' && place.flight_leg && place.booking_links?.length) {
    return (
      <FlightBookingPanel
        flightLeg={place.flight_leg}
        links={place.booking_links}
        className={className}
        compact={compact}
      />
    )
  }
  return <BookingLinks links={place.booking_links} className={className} />
}

export function PlaceBooking(props) {
  return <TripPlaceBooking {...props} />
}

export default FlightBookingPanel
