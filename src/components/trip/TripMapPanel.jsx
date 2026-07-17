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
  bookingLinks = [],
  emptyHint = 'คลิกชื่อสถานที่ (ที่พัก, ร้านอาหาร, สถานที่เที่ยว) เพื่อดูบนแผนที่',
}) {
  const place = mapState?.place
  const embedUrl = mapState?.embedUrl
  const openUrl = mapState?.openUrl

  return (
    <section className="trip-card trip-map-card trip-no-print">
      <h3>แผนที่</h3>

      {loading && (
        <p className="trip-map-hint" style={{ marginTop: 0 }}>กำลังโหลดรายละเอียดสถานที่...</p>
      )}

      {place && !loading && (
        <div className="trip-map-place-card">
          {place.photoUrl && (
            <PlacePhoto
              url={place.photoUrl}
              alt={place.name}
              className="trip-map-place-photo"
              type={place.category || 'other'}
            />
          )}
          <div className="trip-map-place-body">
            <div className="trip-map-place-type">
              {TYPE_LABELS[place.category] || TYPE_LABELS[place.type] || place.category || 'สถานที่'}
            </div>
            <h4 className="trip-map-place-name">{place.name}</h4>
            {place.rating != null && (
              <p className="trip-map-place-rating">
                ★ {Number(place.rating).toFixed(1)}
                {place.userRatingCount != null ? ` · ${Number(place.userRatingCount).toLocaleString('th-TH')} รีวิว` : ''}
              </p>
            )}
            {place.address && <p className="trip-map-place-address">{place.address}</p>}
            <div className="trip-map-place-actions">
              {openUrl && (
                <a className="trip-map-open-btn" href={openUrl} target="_blank" rel="noopener noreferrer">
                  เปิดใน Google Maps
                </a>
              )}
            </div>
            <BookingLinks links={bookingLinks} />
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
