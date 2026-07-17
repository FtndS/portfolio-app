import { PlacePhoto } from './TripPlaceSearch'
import { BookingLinks } from './BookingLinks'

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
  emptyHint = 'คลิกชื่อสถานที่ (ที่พัก, ร้านอาหาร, สถานที่เที่ยว) เพื่อดูบน Google Maps',
}) {
  const resolved = mapState?.place
  const embedUrl = mapState?.embedUrl
  const openUrl = mapState?.openUrl
  const displayName = focusPlace?.name || resolved?.name
  const displayType = focusPlace?.type || resolved?.category
  const displayAddress = focusPlace?.address || resolved?.address
  const displayPhoto = focusPlace?.photo_url || (resolved?.matchQuality === 'strong' ? resolved?.photoUrl : null)
  const showWeakWarn = resolved?.matchQuality === 'weak'
    || (resolved?.matchedName && displayName && resolved.matchedName !== displayName)

  return (
    <section className="trip-card trip-map-card trip-no-print">
      <h3>แผนที่</h3>

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
            {focusPlace?.type !== 'transport' && (
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
          {emptyHint}
        </div>
      )}
      <p className="trip-map-hint">
        คลิกชื่อสถานที่ (ที่พัก, ร้านอาหาร, สถานที่เที่ยว) เพื่อดูรายละเอียดและซูมแผนที่
      </p>
    </section>
  )
}
