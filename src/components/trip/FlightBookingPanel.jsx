/** Flight booking panel — deep links; collapses when live quote already shown. */

import { useState } from 'react'
import { BookingLinks } from './BookingLinks'
import { showPlaceBooking } from '../../lib/tripTransport'

function fmtDate(iso) {
  if (!iso) return ''
  const [y, m, d] = String(iso).slice(0, 10).split('-')
  if (!y || !m || !d) return iso
  return `${d}/${m}/${y}`
}

function pickPrimaryLink(links) {
  const google = links.find((l) => /google/i.test(l.label || ''))
  return google || links[0] || null
}

export function FlightBookingPanel({
  flightLeg,
  links,
  className = '',
  compact = false,
  hideSummary = false,
  hasLiveQuote = false,
  defaultExpanded = false,
}) {
  const list = Array.isArray(links) ? links.filter((l) => l?.url && l?.label) : []
  const [expanded, setExpanded] = useState(Boolean(defaultExpanded) && !hasLiveQuote)
  if (!flightLeg || !list.length) return null

  const tripTypeLabel = flightLeg.tripType === 'roundtrip' ? 'ไป–กลับ' : 'เที่ยวเดียว'
  const metaParts = [
    tripTypeLabel,
    flightLeg.cabin || null,
    flightLeg.passengers ? `${flightLeg.passengers} ผู้โดยสาร` : null,
  ].filter(Boolean)

  const primary = pickPrimaryLink(list)
  const others = list.filter((l) => l !== primary)
  const collapseByDefault = hasLiveQuote || hideSummary

  return (
    <div
      className={[
        'trip-flight-panel',
        compact ? 'trip-flight-panel--compact' : '',
        hasLiveQuote ? 'trip-flight-panel--live' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      {!hideSummary && (
        <div className="trip-flight-summary">
          <div className="trip-flight-summary-head">
            <strong>เที่ยวบิน</strong>
            {metaParts.length > 0 && (
              <span className="trip-flight-meta">{metaParts.join(' · ')}</span>
            )}
          </div>
          <div className="trip-flight-leg">
            <span className="trip-flight-code">{flightLeg.originLabel || flightLeg.origin}</span>
            <span className="trip-flight-arrow" aria-hidden>→</span>
            <span className="trip-flight-code">{flightLeg.destinationLabel || flightLeg.destination}</span>
            {flightLeg.departDate && (
              <span className="trip-flight-dates">
                · {fmtDate(flightLeg.departDate)}
                {flightLeg.returnDate ? ` – ${fmtDate(flightLeg.returnDate)}` : ''}
              </span>
            )}
          </div>
          {flightLeg.label && <p className="trip-flight-route-label">{flightLeg.label}</p>}
        </div>
      )}

      <div className="trip-flight-actions">
        {primary && (
          <a
            className="trip-action-btn trip-action-btn--primary"
            href={primary.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            จองบน {primary.label}
          </a>
        )}
        {others.length > 0 && (
          <button
            type="button"
            className={`trip-action-btn trip-action-btn--ghost${expanded ? ' is-open' : ''}`}
            aria-expanded={expanded}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? 'ซ่อนตัวเลือกอื่น' : `เปรียบเทียบที่อื่น (${others.length})`}
          </button>
        )}
      </div>

      {expanded && (
        <div className="trip-flight-options trip-flight-options--anim">
          {!collapseByDefault && (
            <p className="trip-flight-options-head">เปรียบเทียบราคา — กดเพื่อดูที่เว็บ</p>
          )}
          <ul className="trip-flight-options-list">
            {(collapseByDefault ? others : list).map((link) => (
              <li key={link.url}>
                <a
                  className="trip-flight-option"
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <span className="trip-flight-option-name">{link.label}</span>
                  <span className="trip-action-btn trip-action-btn--tiny">เปิด</span>
                </a>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="trip-flight-disclaimer">
        {hasLiveQuote
          ? 'ราคาด้านบนจาก Google Flights ในแอป — กดจองเพื่อเปิดเว็บพาร์ทเนอร์'
          : 'กดจองเพื่อเปิดเว็บพาร์ทเนอร์ ราคาจริงยืนยันบนเว็บนั้น'}
      </p>
    </div>
  )
}

export function TripPlaceBooking({
  place,
  className = '',
  compact = false,
  hideSummary = false,
  hasLiveQuote = false,
}) {
  if (!place || !showPlaceBooking(place)) return null
  if (place.type === 'transport' && place.flight_leg && place.booking_links?.length) {
    return (
      <FlightBookingPanel
        flightLeg={place.flight_leg}
        links={place.booking_links}
        className={className}
        compact={compact}
        hideSummary={hideSummary}
        hasLiveQuote={hasLiveQuote}
      />
    )
  }
  return <BookingLinks links={place.booking_links} className={className} />
}

export function PlaceBooking(props) {
  return <TripPlaceBooking {...props} />
}

export default FlightBookingPanel
