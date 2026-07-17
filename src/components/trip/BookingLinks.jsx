/** External booking search chips — opens partner sites in a new tab */

export function BookingLinks({ links, className = '' }) {
  const list = Array.isArray(links) ? links.filter((l) => l?.url && l?.label) : []
  if (!list.length) return null

  return (
    <div className={`trip-booking-links ${className}`.trim()}>
      <span className="trip-booking-links-label">จอง:</span>
      {list.map((link) => (
        <a
          key={link.url}
          className="trip-booking-chip"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.label}
        </a>
      ))}
    </div>
  )
}

export default BookingLinks
