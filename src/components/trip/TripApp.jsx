import { useEffect, useMemo, useRef, useState } from 'react'
import { api } from '../../lib/api'
import { btnGhost, btnPrimary, inp } from '../../lib/styles'
import { fmtDate as fmtDateDmy } from '../../lib/format'
import Logo from '../Logo'
import ThemeToggle from '../ThemeToggle'
import DateInput from '../ui/DateInput'
import Modal from '../ui/Modal'
import { readTripId } from '../../lib/appRoutes'
import TripPlaceSearch, { PlacePhoto } from './TripPlaceSearch'
import TripAIPlanner from './TripAIPlanner'
import TripTimeline from './TripTimeline'
import { BookingLinks } from './BookingLinks'
import TripMapPanel from './TripMapPanel'
import SupportModal from '../modals/SupportModal'
import './TripApp.css'
import './TripPlaceSearch.css'
import './TripTimeline.css'

const PLACE_TYPES = [
  ['hotel', 'ที่พัก'],
  ['restaurant', 'ร้านอาหาร'],
  ['airport', 'สนามบิน'],
  ['attraction', 'สถานที่เที่ยว'],
  ['transport', 'การเดินทาง'],
  ['other', 'อื่นๆ'],
]

function typeLabel(type) {
  return PLACE_TYPES.find(([k]) => k === type)?.[1] || type
}

function fmtDate(iso) {
  return fmtDateDmy(iso) || '—'
}

const emptyTripForm = {
  title: '',
  destination: '',
  start_date: '',
  end_date: '',
  notes: '',
}

const emptyPlaceForm = {
  name: '',
  type: 'attraction',
  trip_day_id: '',
  address: '',
  lat: '',
  lng: '',
  start_time: '',
  end_time: '',
  budget: '',
  notes: '',
}

export default function TripApp({ user, path, navigate, onBackHub, onOpenStock, onLogout }) {
  const tripId = readTripId(path)
  const [trips, setTrips] = useState([])
  const [detail, setDetail] = useState(null)
  const [loading, setLoading] = useState(true)
  const [err, setErr] = useState('')
  const [creating, setCreating] = useState(false)
  const [tripForm, setTripForm] = useState(emptyTripForm)
  const [placeForm, setPlaceForm] = useState(emptyPlaceForm)
  const [saving, setSaving] = useState(false)
  const [activeDayId, setActiveDayId] = useState(null)
  const [confirmDelete, setConfirmDelete] = useState(null)
  const [deleting, setDeleting] = useState(false)
  const [placeAddMode, setPlaceAddMode] = useState('search')
  const [editingPlaceId, setEditingPlaceId] = useState(null)
  const [editTime, setEditTime] = useState({ start_time: '', end_time: '' })
  const [aiOpen, setAiOpen] = useState(false)
  const [dragIndex, setDragIndex] = useState(null)
  const [detailView, setDetailView] = useState('plan') // plan | edit
  const [mapFocusId, setMapFocusId] = useState(null)
  const [mapPanel, setMapPanel] = useState(null)
  const [mapLoading, setMapLoading] = useState(false)
  const [supportOpen, setSupportOpen] = useState(false)
  const [enriching, setEnriching] = useState(false)
  const [exportReady, setExportReady] = useState(false)
  const enrichedTripRef = useRef(null)
  const activeDayRef = useRef(null)
  const placeDayRef = useRef('')
  const prevTitleRef = useRef('')

  useEffect(() => {
    activeDayRef.current = activeDayId
  }, [activeDayId])

  useEffect(() => {
    placeDayRef.current = placeForm.trip_day_id
  }, [placeForm.trip_day_id])

  const loadList = async () => {
    setLoading(true)
    setErr('')
    const rows = await api.get('/trips')
    setLoading(false)
    if (rows?.error) {
      setErr(rows.error)
      return
    }
    setTrips(Array.isArray(rows) ? rows : [])
  }

  const loadDetail = async (id, { preserveSelection = false, showLoading = true } = {}) => {
    if (showLoading) setLoading(true)
    setErr('')
    const r = await api.get(`/trips/${id}`)
    if (showLoading) setLoading(false)
    if (r?.error) {
      setErr(r.error)
      setDetail(null)
      return null
    }
    setDetail(r)
    const days = r.days || []
    const prevDay = activeDayRef.current
    const prevFormDay = placeDayRef.current
    const keepActive = preserveSelection && prevDay && days.some((d) => d.id === prevDay)
    const nextActive = keepActive ? prevDay : (days[0]?.id || null)
    setActiveDayId(nextActive)

    const keepForm =
      preserveSelection &&
      prevFormDay &&
      days.some((d) => String(d.id) === String(prevFormDay))
    setPlaceForm((prev) => ({
      ...prev,
      trip_day_id: keepForm
        ? String(prevFormDay)
        : (nextActive ? String(nextActive) : ''),
    }))
    return r
  }

  const placeNeedsEnrich = (places) => {
    const seen = new Set()
    const dupUrls = new Set()
    for (const p of places || []) {
      if (p.photo_url) {
        if (seen.has(p.photo_url)) dupUrls.add(p.photo_url)
        else seen.add(p.photo_url)
      }
    }
    return (places || []).some(
      (p) =>
        !p.photo_url
        || /แนะนำ|หรือ|ค้นหา|มื้อเย็น|ร้านซีฟู้ด|บ้านพักแบบ/i.test(p.name || '')
        || (p.photo_url && dupUrls.has(p.photo_url))
    )
  }

  const enrichPhotos = async (tripDetail) => {
    const t = tripDetail || detail
    if (!t?.id || enriching) return
    if (!placeNeedsEnrich(t.places)) return
    setEnriching(true)
    const r = await api.post(`/trips/${t.id}/enrich-photos`, { limit: 36 })
    setEnriching(false)
    if (r?.error) {
      setErr(r.error)
      return
    }
    if (r?.trip) setDetail(r.trip)
  }

  useEffect(() => {
    if (tripId) {
      activeDayRef.current = null
      placeDayRef.current = ''
      enrichedTripRef.current = null
      loadDetail(tripId).then((r) => {
        if (!r?.id) return
        if (enrichedTripRef.current === r.id) return
        const missing = placeNeedsEnrich(r.places)
        if (missing) {
          enrichedTripRef.current = r.id
          enrichPhotos(r)
        }
      })
    } else {
      setDetail(null)
      loadList()
    }
  }, [tripId])

  const placesForActiveDay = useMemo(() => {
    if (!detail) return []
    if (!activeDayId) return detail.places || []
    return (detail.places || []).filter((p) => p.trip_day_id === activeDayId)
  }, [detail, activeDayId])

  const mapFocusPlace = useMemo(
    () => (detail?.places || []).find((p) => String(p.id) === String(mapFocusId)) || null,
    [detail?.places, mapFocusId]
  )

  const focusPlaceOnMap = async (place) => {
    if (!place) return
    setErr('')
    setMapFocusId(place.id)
    setMapLoading(true)
    try {
      const r = await api.get('/trips/places/map', {
        q: place.name,
        type: place.type || 'other',
        near: detail?.destination || '',
        address: place.address || '',
        lat: place.lat ?? '',
        lng: place.lng ?? '',
        placeId: place.external_id || '',
      })
      if (r?.error) {
        setErr(r.error)
        setMapPanel(null)
        return
      }
      setMapPanel(r)
      // Persist coords if we discovered valid ones and place was missing them
      const foundLat = r?.place?.lat
      const foundLng = r?.place?.lng
      const foundOk =
        Number.isFinite(Number(foundLat))
        && Number.isFinite(Number(foundLng))
        && !(Math.abs(Number(foundLat)) < 0.01 && Math.abs(Number(foundLng)) < 0.01)
      const placeMissingCoords =
        place.lat == null
        || place.lng == null
        || (Math.abs(Number(place.lat)) < 0.01 && Math.abs(Number(place.lng)) < 0.01)
      if (place.id && placeMissingCoords && foundOk) {
        const updated = await api.put(`/trips/${detail.id}/places/${place.id}`, {
          ...place,
          lat: foundLat,
          lng: foundLng,
          address: place.address || r.place.address || null,
          photo_url: place.photo_url || r.place.photoUrl || null,
          external_id: place.external_id || r.place.placeId || null,
          external_source: place.external_source || r.place.source || null,
        })
        if (updated && !updated.error) {
          setDetail((prev) => {
            if (!prev) return prev
            return {
              ...prev,
              places: (prev.places || []).map((p) => (p.id === place.id ? { ...p, ...updated } : p)),
            }
          })
        }
      }
    } catch {
      setErr('โหลดแผนที่ไม่สำเร็จ')
    } finally {
      setMapLoading(false)
    }
  }

  const createTrip = async () => {
    setSaving(true)
    setErr('')
    const r = await api.post('/trips', tripForm)
    setSaving(false)
    if (r?.error) {
      setErr(r.error)
      return
    }
    setCreating(false)
    setTripForm(emptyTripForm)
    navigate(`/trip/${r.id}`)
  }

  const deleteTrip = async () => {
    if (!detail) return
    setDeleting(true)
    setErr('')
    const r = await api.delete(`/trips/${detail.id}`)
    setDeleting(false)
    if (r?.error) {
      setErr(r.error)
      return
    }
    setConfirmDelete(null)
    navigate('/trip')
  }

  const addDay = async () => {
    const r = await api.post(`/trips/${detail.id}/days`, {})
    if (r?.error) {
      setErr(r.error)
      return
    }
    await loadDetail(detail.id, { preserveSelection: true, showLoading: false })
    setActiveDayId(r.id)
    setPlaceForm((prev) => ({ ...prev, trip_day_id: String(r.id) }))
  }

  const addPlace = async (payloadOverride) => {
    setSaving(true)
    setErr('')
    const base = payloadOverride || {
      ...placeForm,
      trip_day_id: placeForm.trip_day_id || activeDayId || null,
      lat: placeForm.lat === '' ? null : placeForm.lat,
      lng: placeForm.lng === '' ? null : placeForm.lng,
      budget: placeForm.budget === '' ? null : placeForm.budget,
    }
    const r = await api.post(`/trips/${detail.id}/places`, base)
    setSaving(false)
    if (r?.error) {
      setErr(r.error)
      return false
    }
    if (!payloadOverride) {
      setPlaceForm({
        ...emptyPlaceForm,
        type: placeForm.type,
        trip_day_id: placeForm.trip_day_id || (activeDayId ? String(activeDayId) : ''),
        start_time: '',
        end_time: '',
      })
    }
    await loadDetail(detail.id, { preserveSelection: true, showLoading: false })
    return true
  }

  const addPlaceFromSearch = async (result) => {
    await addPlace({
      name: result.name,
      type: result.type || placeForm.type,
      trip_day_id: placeForm.trip_day_id || activeDayId || null,
      address: result.address || null,
      lat: result.lat,
      lng: result.lng,
      photo_url: result.photoUrl || null,
      external_id: result.externalId || result.id || null,
      external_source: result.source || null,
      start_time: placeForm.start_time || null,
      end_time: placeForm.end_time || null,
    })
  }

  const removePlace = async (placeId) => {
    setDeleting(true)
    setErr('')
    const r = await api.delete(`/trips/${detail.id}/places/${placeId}`)
    setDeleting(false)
    if (r?.error) {
      setErr(r.error)
      return
    }
    setConfirmDelete(null)
    await loadDetail(detail.id, { preserveSelection: true, showLoading: false })
  }

  const savePlaceTimes = async (place) => {
    setSaving(true)
    setErr('')
    const r = await api.put(`/trips/${detail.id}/places/${place.id}`, {
      ...place,
      start_time: editTime.start_time || null,
      end_time: editTime.end_time || null,
    })
    setSaving(false)
    if (r?.error) {
      setErr(r.error)
      return
    }
    setEditingPlaceId(null)
    await loadDetail(detail.id, { preserveSelection: true, showLoading: false })
  }

  const persistOrder = async (orderedPlaces) => {
    if (!activeDayId || !detail) return
    const r = await api.put(`/trips/${detail.id}/places/reorder`, {
      day_id: activeDayId,
      place_ids: orderedPlaces.map((p) => p.id),
    })
    if (r?.error) {
      setErr(r.error)
      await loadDetail(detail.id, { preserveSelection: true, showLoading: false })
      return
    }
    setDetail(r)
  }

  const exportPlan = async () => {
    if (!detail) return
    setExportReady(true)
    prevTitleRef.current = document.title
    document.title = `แผนทริป-${detail.title || 'trip'}`

    // Wait for print-root images (incl. auth blob fetches) to settle
    await new Promise((r) => setTimeout(r, 1200))
    const imgs = document.querySelectorAll('.trip-tl-print-root img')
    await Promise.all(
      [...imgs].map(
        (img) =>
          new Promise((resolve) => {
            if (img.complete) return resolve()
            img.onload = () => resolve()
            img.onerror = () => resolve()
            setTimeout(resolve, 2500)
          })
      )
    )

    const restore = () => {
      document.title = prevTitleRef.current || 'PortDiary'
      setExportReady(false)
      window.removeEventListener('afterprint', restore)
    }
    window.addEventListener('afterprint', restore)
    window.print()
    // Fallback if afterprint never fires
    setTimeout(() => {
      if (document.title.startsWith('แผนทริป-')) restore()
    }, 60_000)
  }

  const movePlace = async (index, direction) => {
    const next = index + direction
    if (next < 0 || next >= placesForActiveDay.length) return
    const ordered = [...placesForActiveDay]
    const [item] = ordered.splice(index, 1)
    ordered.splice(next, 0, item)
    setDetail((prev) => {
      if (!prev) return prev
      const others = (prev.places || []).filter((p) => p.trip_day_id !== activeDayId)
      return { ...prev, places: [...others, ...ordered] }
    })
    await persistOrder(ordered)
  }

  const onDropPlace = async (toIndex) => {
    if (dragIndex == null || dragIndex === toIndex) {
      setDragIndex(null)
      return
    }
    const ordered = [...placesForActiveDay]
    const [item] = ordered.splice(dragIndex, 1)
    ordered.splice(toIndex, 0, item)
    setDragIndex(null)
    setDetail((prev) => {
      if (!prev) return prev
      const others = (prev.places || []).filter((p) => p.trip_day_id !== activeDayId)
      return { ...prev, places: [...others, ...ordered] }
    })
    await persistOrder(ordered)
  }

  const timeFields = (
    <div className="trip-form-row">
      <label>
        <span>เวลาเริ่ม</span>
        <input
          style={inp({ marginBottom: 0 })}
          placeholder="เช่น 09:00"
          value={placeForm.start_time}
          onChange={(e) => setPlaceForm({ ...placeForm, start_time: e.target.value })}
        />
      </label>
      <label>
        <span>เวลาจบ</span>
        <input
          style={inp({ marginBottom: 0 })}
          placeholder="เช่น 11:00"
          value={placeForm.end_time}
          onChange={(e) => setPlaceForm({ ...placeForm, end_time: e.target.value })}
        />
      </label>
    </div>
  )

  return (
    <div className="trip-shell">
      <header className="trip-topbar">
        <div className="trip-topbar-left">
          <button type="button" className="trip-brand-btn" onClick={onBackHub} title="กลับ Hub">
            <Logo size={24} />
          </button>
          <div>
            <div className="trip-topbar-title">Trip Planner</div>
            <div className="trip-topbar-sub">สวัสดี, {user?.name}</div>
          </div>
        </div>
        <div className="trip-topbar-actions">
          <ThemeToggle />
          <button
            type="button"
            className="landing-btn-ghost"
            onClick={() => setSupportOpen(true)}
            title="ช่วยเหลือ / แจ้งปัญหา"
          >
            ช่วยเหลือ
          </button>
          <button type="button" className="landing-btn-ghost" onClick={onOpenStock}>พอร์ต</button>
          <button type="button" className="landing-btn-ghost" onClick={onBackHub}>Hub</button>
          <button type="button" className="landing-btn-ghost" onClick={onLogout}>ออก</button>
        </div>
      </header>

      <main className="trip-main">
        {err && <p className="dash-text-loss" style={{ marginBottom: 12 }}>{err}</p>}

        {!tripId && (
          <>
            <section className="trip-home-intro">
              <h1>ทริปของฉัน</h1>
              <p className="trip-home-intro-lead">
                วางแผนเที่ยวแบบครบในที่เดียว — ให้ AI ช่วยร่างเส้นทาง ที่พัก ร้านอาหาร และการเดินทาง
                จากนั้นจัดวันใน Timeline พร้อมลิงก์จอง Agoda / Booking / Trip.com / ตั๋วเครื่องบิน และ Export เป็น PDF ได้ทันที
              </p>
              <div className="trip-home-actions">
                <button
                  type="button"
                  className="trip-btn-ai"
                  onClick={() => setAiOpen(true)}
                >
                  AI จัดทริป
                </button>
                <button
                  type="button"
                  className="trip-btn-secondary"
                  onClick={() => setCreating((v) => !v)}
                >
                  {creating ? 'ปิดฟอร์ม' : '+ สร้างทริปเอง'}
                </button>
              </div>
              <div className="trip-home-features">
                <div className="trip-home-feature">
                  <strong>AI ร่างแผน</strong>
                  <p>บอกปลายทางและสไตล์เที่ยว แล้วได้แผนวันต่อวันพร้อมเวลา</p>
                </div>
                <div className="trip-home-feature">
                  <strong>จองนอกแอป</strong>
                  <p>ลิงก์ไป Agoda, Booking, Trip.com, 12Go, Grab, Google Flights</p>
                </div>
                <div className="trip-home-feature">
                  <strong>Export PDF</strong>
                  <p>พิมพ์แผนทั้งทริปเป็นโบรชัวร์ พร้อมหน้าปกและรายละเอียดรายวัน</p>
                </div>
              </div>
            </section>

            {creating && (
              <div className="trip-card">
                <h3>ทริปใหม่</h3>
                <input
                  style={inp()}
                  placeholder="ชื่อทริป เช่น เชียงใหม่ 3 วัน"
                  value={tripForm.title}
                  onChange={(e) => setTripForm({ ...tripForm, title: e.target.value })}
                />
                <input
                  style={inp()}
                  placeholder="ปลายทาง"
                  value={tripForm.destination}
                  onChange={(e) => setTripForm({ ...tripForm, destination: e.target.value })}
                />
                <div className="trip-form-row">
                  <label>
                    <span>วันเริ่ม (วว/ดด/ปปปป)</span>
                    <DateInput
                      style={inp({ marginBottom: 0 })}
                      value={tripForm.start_date}
                      onChange={(start_date) => setTripForm({ ...tripForm, start_date })}
                    />
                  </label>
                  <label>
                    <span>วันสิ้นสุด (วว/ดด/ปปปป)</span>
                    <DateInput
                      style={inp({ marginBottom: 0 })}
                      value={tripForm.end_date}
                      onChange={(end_date) => setTripForm({ ...tripForm, end_date })}
                    />
                  </label>
                </div>
                <textarea
                  style={{ ...inp(), minHeight: 80, resize: 'vertical' }}
                  placeholder="โน้ตเพิ่มเติม (ถ้ามี)"
                  value={tripForm.notes}
                  onChange={(e) => setTripForm({ ...tripForm, notes: e.target.value })}
                />
                <button type="button" style={btnPrimary} disabled={saving} onClick={createTrip}>
                  {saving ? 'กำลังสร้าง...' : 'สร้างทริป'}
                </button>
              </div>
            )}

            {loading && <p className="dash-text-muted">กำลังโหลด...</p>}
            {!loading && trips.length === 0 && (
              <div className="trip-empty">ยังไม่มีทริป — กด AI จัดทริป หรือสร้างทริปเองเพื่อเริ่มวางแผน</div>
            )}
            {trips.length > 0 && <p className="trip-section-label">ทริปที่บันทึกไว้</p>}
            <div className="trip-list">
              {trips.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="trip-list-item"
                  onClick={() => navigate(`/trip/${t.id}`)}
                >
                  <div>
                    <strong>{t.title}</strong>
                    <div className="dash-text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                      {t.destination || 'ไม่ระบุปลายทาง'} · {fmtDate(t.start_date)} – {fmtDate(t.end_date)}
                    </div>
                  </div>
                  <div className="trip-list-meta">
                    {t.day_count || 0} วัน · {t.place_count || 0} จุด
                  </div>
                </button>
              ))}
            </div>
          </>
        )}

        {tripId && loading && <p className="dash-text-muted">กำลังโหลดทริป...</p>}

        {tripId && !loading && detail && (
          <>
            <div className="trip-list-head trip-detail-head trip-no-print">
              <div className="trip-detail-head-text">
                <button type="button" className="dash-link-btn" onClick={() => navigate('/trip')}>
                  ← ทริปทั้งหมด
                </button>
                <h1>{detail.title}</h1>
                <p className="trip-detail-meta">
                  <span>{detail.destination || 'ไม่ระบุปลายทาง'}</span>
                  {(detail.start_date || detail.end_date) && (
                    <span>{fmtDate(detail.start_date)} – {fmtDate(detail.end_date)}</span>
                  )}
                  <span>{(detail.days || []).length} วัน · {(detail.places || []).length} จุด</span>
                </p>
              </div>
              <div className="trip-list-head-actions">
                <button
                  type="button"
                  style={{ ...btnGhost, width: 'auto' }}
                  disabled={enriching}
                  onClick={() => enrichPhotos()}
                >
                  {enriching ? 'กำลังเติมรูป...' : 'เติมรูป'}
                </button>
                <button type="button" style={{ ...btnPrimary, width: 'auto' }} onClick={exportPlan}>
                  Export plan
                </button>
                <button type="button" style={{ ...btnGhost, width: 'auto' }} onClick={() => setConfirmDelete({ type: 'trip' })}>
                  ลบทริป
                </button>
              </div>
            </div>

            <div className="trip-detail-grid">
              <section className="trip-card trip-itinerary-card">
                <div className="trip-section-head trip-no-print">
                  <h3>แผนรายวัน</h3>
                  <div className="trip-view-switch">
                    <button
                      type="button"
                      className={`trip-view-btn${detailView === 'plan' ? ' is-active' : ''}`}
                      onClick={() => setDetailView('plan')}
                    >
                      Timeline
                    </button>
                    <button
                      type="button"
                      className={`trip-view-btn${detailView === 'edit' ? ' is-active' : ''}`}
                      onClick={() => setDetailView('edit')}
                    >
                      แก้ไข
                    </button>
                    <button type="button" className="trip-add-day-btn" onClick={addDay}>+ เพิ่มวัน</button>
                  </div>
                </div>
                <div className="trip-day-tabs trip-no-print" role="tablist" aria-label="วันในทริป">
                  {(detail.days || []).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      role="tab"
                      aria-selected={activeDayId === d.id}
                      className={`trip-day-tab${activeDayId === d.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setActiveDayId(d.id)
                        setMapFocusId(null)
                        setMapPanel(null)
                        setPlaceForm((prev) => ({ ...prev, trip_day_id: String(d.id) }))
                      }}
                    >
                      <span className="trip-day-tab-index">วัน {d.day_index}</span>
                      <span className="trip-day-tab-date">{fmtDate(d.date)}</span>
                    </button>
                  ))}
                </div>

                {detailView === 'plan' ? (
                  <div className="trip-no-print">
                    <TripTimeline
                      trip={detail}
                      days={detail.days}
                      places={detail.places}
                      fmtDate={fmtDate}
                      activeDayId={activeDayId}
                      allDays={false}
                      focusedPlaceId={mapFocusId}
                      onSelectPlace={focusPlaceOnMap}
                    />
                  </div>
                ) : (
                <>
                <div className="trip-places trip-no-print">
                  {placesForActiveDay.length === 0 && (
                    <div className="trip-empty trip-empty-compact">ยังไม่มีจุดแวะในวันนี้ — ค้นหาหรือใส่เองด้านล่าง</div>
                  )}
                  {placesForActiveDay.map((p, index) => (
                    <article
                      key={p.id}
                      className={`trip-place-card${dragIndex === index ? ' is-dragging' : ''}`}
                      draggable
                      onDragStart={() => setDragIndex(index)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => onDropPlace(index)}
                      onDragEnd={() => setDragIndex(null)}
                    >
                      <div className="trip-place-card-time">
                        <span>{p.start_time || '—'}</span>
                        <span className="trip-place-card-time-sep" aria-hidden />
                        <span>{p.end_time || '—'}</span>
                      </div>
                      <PlacePhoto
                        url={p.photo_url}
                        alt={p.name}
                        className="trip-place-card-thumb"
                        type={p.type}
                      />
                      <div className="trip-place-card-body">
                        <div className="trip-place-card-top">
                          <span className="trip-place-type">{typeLabel(p.type)}</span>
                          <button
                            type="button"
                            className="trip-place-card-title-btn"
                            onClick={() => focusPlaceOnMap(p)}
                            title={p.lat != null ? 'แสดงบนแผนที่' : 'ยังไม่มีพิกัด'}
                          >
                            <h4 className="trip-place-card-title">{p.name}</h4>
                          </button>
                        </div>
                        {editingPlaceId === p.id ? (
                          <div className="trip-place-edit-time">
                            <input
                              style={inp({ marginBottom: 0 })}
                              placeholder="เริ่ม"
                              value={editTime.start_time}
                              onChange={(e) => setEditTime({ ...editTime, start_time: e.target.value })}
                            />
                            <input
                              style={inp({ marginBottom: 0 })}
                              placeholder="จบ"
                              value={editTime.end_time}
                              onChange={(e) => setEditTime({ ...editTime, end_time: e.target.value })}
                            />
                            <button type="button" className="dash-link-btn" disabled={saving} onClick={() => savePlaceTimes(p)}>
                              บันทึก
                            </button>
                            <button type="button" className="dash-link-btn" onClick={() => setEditingPlaceId(null)}>
                              ยกเลิก
                            </button>
                          </div>
                        ) : (
                          <>
                            {p.address && <p className="trip-place-card-address">{p.address}</p>}
                            {p.notes && <p className="trip-place-card-address">{p.notes}</p>}
                            {p.budget != null && (
                              <p className="trip-place-card-budget">฿{Number(p.budget).toLocaleString('th-TH')}</p>
                            )}
                            <BookingLinks links={p.booking_links} />
                          </>
                        )}
                        <div className="trip-place-card-toolbar">
                          <div className="trip-place-card-links">
                            {p.lat != null && p.lng != null && (
                              <a
                                className="dash-link-btn"
                                href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}`}
                                target="_blank"
                                rel="noreferrer"
                              >
                                แผนที่
                              </a>
                            )}
                            {editingPlaceId !== p.id && (
                              <button
                                type="button"
                                className="dash-link-btn"
                                onClick={() => {
                                  setEditingPlaceId(p.id)
                                  setEditTime({
                                    start_time: p.start_time || '',
                                    end_time: p.end_time || '',
                                  })
                                }}
                              >
                                แก้เวลา
                              </button>
                            )}
                          </div>
                          <div className="trip-place-card-actions">
                            <button
                              type="button"
                              className="trip-reorder-btn"
                              disabled={index === 0}
                              onClick={() => movePlace(index, -1)}
                              title="เลื่อนขึ้น"
                            >
                              ↑
                            </button>
                            <button
                              type="button"
                              className="trip-reorder-btn"
                              disabled={index === placesForActiveDay.length - 1}
                              onClick={() => movePlace(index, 1)}
                              title="เลื่อนลง"
                            >
                              ↓
                            </button>
                            <button
                              type="button"
                              className="trip-place-delete-btn"
                              onClick={() => setConfirmDelete({ type: 'place', id: p.id, name: p.name })}
                            >
                              ลบ
                            </button>
                          </div>
                        </div>
                      </div>
                    </article>
                  ))}
                </div>

                <div className="trip-place-form trip-no-print">
                  <h4>เพิ่มจุดแวะ</h4>
                  <div className="trip-add-mode-tabs">
                    <button
                      type="button"
                      className={`trip-add-mode-tab${placeAddMode === 'search' ? ' is-active' : ''}`}
                      onClick={() => setPlaceAddMode('search')}
                    >
                      ค้นหา
                    </button>
                    <button
                      type="button"
                      className={`trip-add-mode-tab${placeAddMode === 'manual' ? ' is-active' : ''}`}
                      onClick={() => setPlaceAddMode('manual')}
                    >
                      ใส่เอง
                    </button>
                  </div>

                  <div className="trip-form-row">
                    <label>
                      <span>ประเภท</span>
                      <select
                        style={inp({ marginBottom: 0 })}
                        value={placeForm.type}
                        onChange={(e) => setPlaceForm({ ...placeForm, type: e.target.value })}
                      >
                        {PLACE_TYPES.map(([k, label]) => (
                          <option key={k} value={k}>{label}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>วัน</span>
                      <select
                        style={inp({ marginBottom: 0 })}
                        value={placeForm.trip_day_id}
                        onChange={(e) => setPlaceForm({ ...placeForm, trip_day_id: e.target.value })}
                      >
                        <option value="">ไม่ผูกวัน</option>
                        {(detail.days || []).map((d) => (
                          <option key={d.id} value={d.id}>
                            {d.title || `วันที่ ${d.day_index}`}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {timeFields}

                  {placeAddMode === 'search' ? (
                    <TripPlaceSearch
                      destination={detail.destination}
                      type={placeForm.type}
                      disabled={saving}
                      onSelect={addPlaceFromSearch}
                    />
                  ) : (
                    <>
                      <input
                        style={inp()}
                        placeholder="ชื่อสถานที่"
                        value={placeForm.name}
                        onChange={(e) => setPlaceForm({ ...placeForm, name: e.target.value })}
                      />
                      <input
                        style={inp()}
                        placeholder="ที่อยู่ (ถ้ามี)"
                        value={placeForm.address}
                        onChange={(e) => setPlaceForm({ ...placeForm, address: e.target.value })}
                      />
                      <div className="trip-form-row">
                        <input
                          style={inp({ marginBottom: 0 })}
                          placeholder="ละติจูด"
                          value={placeForm.lat}
                          onChange={(e) => setPlaceForm({ ...placeForm, lat: e.target.value })}
                        />
                        <input
                          style={inp({ marginBottom: 0 })}
                          placeholder="ลองจิจูด"
                          value={placeForm.lng}
                          onChange={(e) => setPlaceForm({ ...placeForm, lng: e.target.value })}
                        />
                      </div>
                      <div className="trip-form-row">
                        <input
                          style={inp({ marginBottom: 0 })}
                          placeholder="งบ (บาท)"
                          value={placeForm.budget}
                          onChange={(e) => setPlaceForm({ ...placeForm, budget: e.target.value })}
                        />
                      </div>
                      <button type="button" style={btnPrimary} disabled={saving} onClick={() => addPlace()}>
                        {saving ? 'กำลังบันทึก...' : 'เพิ่มจุดแวะ'}
                      </button>
                    </>
                  )}
                </div>
                </>
                )}
              </section>

              <TripMapPanel
                mapState={mapPanel}
                loading={mapLoading}
                bookingLinks={mapFocusPlace?.booking_links || []}
              />
            </div>

            <div className={`trip-tl-print-root${exportReady ? ' is-exporting' : ''}`} aria-hidden={!exportReady}>
              <TripTimeline
                trip={detail}
                days={detail.days}
                places={detail.places}
                fmtDate={fmtDate}
                activeDayId={activeDayId}
                allDays
                eagerPhotos
              />
            </div>
          </>
        )}
      </main>

      {aiOpen && (
        <TripAIPlanner
          onClose={() => setAiOpen(false)}
          onCreated={(id) => {
            setAiOpen(false)
            navigate(`/trip/${id}`)
          }}
        />
      )}

      {supportOpen && (
        <SupportModal onClose={() => setSupportOpen(false)} />
      )}

      {confirmDelete?.type === 'trip' && detail && (
        <Modal title="ลบทริป?" onClose={() => !deleting && setConfirmDelete(null)}>
          <p className="dash-text-secondary" style={{ margin: '0 0 16px', lineHeight: 1.65 }}>
            ต้องการลบทริป <strong>{detail.title}</strong> หรือไม่? ข้อมูลวันและจุดแวะจะถูกลบถาวร
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={{ ...btnGhost, width: 'auto', flex: 1 }} disabled={deleting} onClick={() => setConfirmDelete(null)}>
              ยกเลิก
            </button>
            <button
              type="button"
              style={{ ...btnPrimary, width: 'auto', flex: 1, background: 'var(--loss)' }}
              disabled={deleting}
              onClick={deleteTrip}
            >
              {deleting ? 'กำลังลบ...' : 'ลบทริป'}
            </button>
          </div>
        </Modal>
      )}

      {confirmDelete?.type === 'place' && detail && (
        <Modal title="ลบจุดแวะ?" onClose={() => !deleting && setConfirmDelete(null)}>
          <p className="dash-text-secondary" style={{ margin: '0 0 16px', lineHeight: 1.65 }}>
            ต้องการลบ <strong>{confirmDelete.name}</strong> ออกจากทริปนี้หรือไม่?
          </p>
          <div style={{ display: 'flex', gap: 10 }}>
            <button type="button" style={{ ...btnGhost, width: 'auto', flex: 1 }} disabled={deleting} onClick={() => setConfirmDelete(null)}>
              ยกเลิก
            </button>
            <button
              type="button"
              style={{ ...btnPrimary, width: 'auto', flex: 1, background: 'var(--loss)' }}
              disabled={deleting}
              onClick={() => removePlace(confirmDelete.id)}
            >
              {deleting ? 'กำลังลบ...' : 'ลบจุดแวะ'}
            </button>
          </div>
        </Modal>
      )}
    </div>
  )
}
