import { useEffect, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { inp } from '../../lib/styles'
import './TripPlaceSearch.css'

const TYPE_ICONS = {
  hotel: '🏨',
  restaurant: '🍽️',
  airport: '✈️',
  attraction: '📍',
  transport: '🚉',
  other: '📌',
}

function needsAuthFetch(url) {
  return url && !url.startsWith('http')
}

export function PlacePhoto({ url, alt, className, type = 'other' }) {
  const [src, setSrc] = useState(() => (url && !needsAuthFetch(url) ? url : null))
  const blobRef = useRef(null)

  useEffect(() => {
    if (blobRef.current) {
      URL.revokeObjectURL(blobRef.current)
      blobRef.current = null
    }

    if (!url) {
      setSrc(null)
      return undefined
    }

    if (!needsAuthFetch(url)) {
      setSrc(url)
      return undefined
    }

    let cancelled = false
    setSrc(null)

    api.fetch(url).then(async (res) => {
      if (cancelled || !res.ok) return
      const blob = await res.blob()
      if (cancelled) return
      const objectUrl = URL.createObjectURL(blob)
      blobRef.current = objectUrl
      setSrc(objectUrl)
    })

    return () => {
      cancelled = true
      if (blobRef.current) {
        URL.revokeObjectURL(blobRef.current)
        blobRef.current = null
      }
    }
  }, [url])

  if (src) {
    return <img src={src} alt={alt} className={className} loading="lazy" />
  }

  return (
    <div className={`trip-place-photo-fallback${className ? ` ${className}` : ''}`} aria-hidden>
      {TYPE_ICONS[type] || TYPE_ICONS.other}
    </div>
  )
}

export default function TripPlaceSearch({ destination, type, onSelect, disabled }) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState([])
  const [loading, setLoading] = useState(false)
  const [provider, setProvider] = useState('')
  const [searchErr, setSearchErr] = useState('')
  const debounceRef = useRef(null)

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)

    const q = query.trim()
    const near = (destination || '').trim()
    if (q.length < 2 && near.length < 2) {
      setResults([])
      setSearchErr('')
      return undefined
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      setSearchErr('')
      const r = await api.get('/trips/places/search', { q, type, near })
      setLoading(false)
      if (r?.error) {
        setSearchErr(r.error)
        setResults([])
        return
      }
      setResults(Array.isArray(r?.results) ? r.results : [])
      setProvider(r?.provider || '')
    }, 420)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, type, destination])

  return (
    <div className="trip-place-search">
      <input
        style={inp()}
        placeholder="ค้นหาที่พัก ร้านอาหาร สถานที่เที่ยว..."
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        disabled={disabled}
      />
      <p className="trip-place-search-hint dash-text-muted">
        {destination
          ? `ค้นหาใกล้ ${destination}${provider === 'google' ? ' · Google Places' : provider === 'osm' ? ' · OpenStreetMap' : ''}`
          : 'พิมพ์ชื่อสถานที่หรือเพิ่มปลายทางทริปเพื่อค้นหาได้แม่นขึ้น'}
      </p>

      {loading && <p className="dash-text-muted" style={{ fontSize: 13 }}>กำลังค้นหา...</p>}
      {searchErr && <p className="dash-text-loss" style={{ fontSize: 13 }}>{searchErr}</p>}

      {!loading && query.trim().length >= 2 && results.length === 0 && !searchErr && (
        <p className="dash-text-muted" style={{ fontSize: 13 }}>ไม่พบผลลัพธ์ — ลองคำอื่นหรือใส่เองด้านล่าง</p>
      )}

      {results.length > 0 && (
        <div className="trip-place-search-results">
          {results.map((item) => (
            <button
              key={item.id}
              type="button"
              className="trip-place-search-item"
              disabled={disabled}
              onClick={() => onSelect?.(item)}
            >
              <PlacePhoto
                url={item.photoUrl}
                alt={item.name}
                className="trip-place-search-thumb"
                type={item.type || type}
              />
              <div className="trip-place-search-meta">
                <strong>{item.name}</strong>
                {item.address && (
                  <span className="dash-text-muted">{item.address}</span>
                )}
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
