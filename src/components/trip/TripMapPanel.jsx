import { PlacePhoto } from './TripPlaceSearch'
import { BookingLinks } from './BookingLinks'
import {
  buildDayOverviewEmbedUrl,
  mappableDayPlaces,
  unmappedDayPlaces,
} from '../../lib/tripMap'

const TYPE_LABELS = {
  hotel: 'ที่พัก',
  restaurant: 'ร้านอาหาร',
  airport: 'สนามบิน',
  attraction: 'สถานที่เที่ยว',
  transport: 'การเดินทาง',
  other: 'อื่นๆ',
}

export default function TripMapPanel({
  mapState,
  loading,
  focusPlace = null,
  bookingLinks = [],
  dayPlaces = [],
  destination = '',
  onSelectPlace = null,
}) {
  const resolved = mapState?.place
  const pins = mappableDayPlaces(dayPlaces)
  const missing = unmappedDayPlaces(dayPlaces)
  const overviewUrl = buildDayOverviewEmbedUrl({
    places: dayPlaces,
    destination,
    focus: focusPlace,
  })
  const embedUrl = mapState?.embedUrl || overviewUrl
  const openUrl = mapState?.openUrl
  const displayName = focusPlace?.name || resolved?.name
  const displayType = focusPlace?.type || resolved?.category
  const displayAddress = focusPlace?.address || resolved?.address
  const displayPhoto = focusPlace?.photo_url || (resolved?.matchQuality === 'strong' ? resolved?.photoUrl : null)
  const showWeakWarn = resolved?.matchQuality === 'weak'
    || (resolved?.matchedName && displayName && resolved.matchedName !== displayName)

  return (
    <section className="trip-card trip-map-card trip-no-print">
      <div className="trip-map-card-head">
        <h3>แผนที่วันนี้</h3>
        {pins.length > 0 && (
          <span className="trip-map-pin-count">{pins.length} หมุด</span>
        )}
      </div>

      {loading && (
        <p className="trip-map-hint" style={{ marginTop: 0 }}>กำลังโหลดรายละเอียดสถานที่...</p>
      )}

      {displayName && !loading && (
        <div className="trip-map-place-card">
          {displayPhoto && (
            <PlacePhoto
              url={displayPhoto}
              alt={displayName}
              className="trip-map-place-photo"
              type={displayType || 'other'}
            />
          )}
          <div className="trip-map-place-body">
            <div className="trip-map-place-type">
              {TYPE_LABELS[displayType] || displayType || 'สถานที่'}
            </div>
            <h4 className="trip-map-place-name">{displayName}</h4>
            {showWeakWarn && (
              <p className="trip-map-match-warn">
                แผนที่อาจไม่ตรง 100% — ลองเปิด Google Maps หรือแก้ชื่อ/ที่อยู่ในแผน
              </p>
            )}
            {resolved?.matchQuality === 'strong' && resolved?.rating != null && (
              <p className="trip-map-place-rating">
                ★ {Number(resolved.rating).toFixed(1)}
                {resolved.userRatingCount != null ? ` · ${Number(resolved.userRatingCount).toLocaleString('th-TH')} รีวิว` : ''}
              </p>
            )}
            {displayAddress && <p className="trip-map-place-address">{displayAddress}</p>}
            <div className="trip-map-place-actions">
              {openUrl && (
                <a className="trip-map-open-btn" href={openUrl} target="_blank" rel="noopener noreferrer">
                  เปิดใน Google Maps
                </a>
              )}
            </div>
            {focusPlace?.type === 'hotel' && (
              <BookingLinks links={bookingLinks} />
            )}
          </div>
        </div>
      )}

      {embedUrl ? (
        <iframe
          key={embedUrl}
          title="Google Maps"
          className="trip-map-frame"
          src={embedUrl}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
        />
      ) : (
        <div className="trip-empty trip-empty-compact">
          ยังไม่มีพิกัดในวันนี้ — สลับไปโหมดจัดแผนแล้วค้นหาสถานที่จากช่องค้นหา
        </div>
      )}

      {pins.length > 0 && (
        <div className="trip-map-pins" role="list" aria-label="หมุดสถานที่วันนี้">
          {pins.map((p, i) => (
            <button
              key={p.id}
              type="button"
              role="listitem"
              className={`trip-map-pin-btn${String(focusPlace?.id) === String(p.id) ? ' is-active' : ''}`}
              onClick={() => onSelectPlace?.(p)}
              title={p.name}
            >
              <span className={`trip-map-pin-n trip-map-pin-n--${p.type || 'other'}`}>{i + 1}</span>
              <span className="trip-map-pin-label">{p.name}</span>
            </button>
          ))}
        </div>
      )}

      {missing.length > 0 && (
        <p className="trip-map-missing">
          ยังไม่มีบนแผนที่: {missing.map((p) => p.name).join(' · ')}
        </p>
      )}

      <p className="trip-map-hint">
        {pins.length
          ? 'หมุดมาจากพิกัดในแผนวันนี้ — คลิกหมุดหรือชื่อในไทม์ไลน์เพื่อซูม'
          : 'เมื่อจุดมีพิกัด แผนที่จะโชว์หมุดทั้งวันอัตโนมัติ'}
      </p>
    </section>
  )
}
