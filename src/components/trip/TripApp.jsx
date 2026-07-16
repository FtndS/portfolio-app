import { useEffect, useMemo, useState } from 'react'
import { api } from '../../lib/api'
import { btnGhost, btnPrimary, inp } from '../../lib/styles'
import { fmtDate as fmtDateDmy } from '../../lib/format'
import Logo from '../Logo'
import ThemeToggle from '../ThemeToggle'
import DateInput from '../ui/DateInput'
import Modal from '../ui/Modal'
import { readTripId } from '../../lib/appRoutes'
import TripPlaceSearch, { PlacePhoto } from './TripPlaceSearch'
import './TripPlaceSearch.css'

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

function mapEmbedUrl(places) {
  const withCoords = places.filter((p) => p.lat != null && p.lng != null)
  if (!withCoords.length) return null
  const lats = withCoords.map((p) => Number(p.lat))
  const lngs = withCoords.map((p) => Number(p.lng))
  const minLat = Math.min(...lats)
  const maxLat = Math.max(...lats)
  const minLng = Math.min(...lngs)
  const maxLng = Math.max(...lngs)
  const pad = 0.02
  const left = minLng - pad
  const right = maxLng + pad
  const top = maxLat + pad
  const bottom = minLat - pad
  const marker = withCoords[0]
  return `https://www.openstreetmap.org/export/embed.html?bbox=${left}%2C${bottom}%2C${right}%2C${top}&layer=mapnik&marker=${marker.lat}%2C${marker.lng}`
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

  const loadDetail = async (id) => {
    setLoading(true)
    setErr('')
    const r = await api.get(`/trips/${id}`)
    setLoading(false)
    if (r?.error) {
      setErr(r.error)
      setDetail(null)
      return
    }
    setDetail(r)
    setActiveDayId(r.days?.[0]?.id || null)
    setPlaceForm((prev) => ({
      ...prev,
      trip_day_id: r.days?.[0]?.id ? String(r.days[0].id) : '',
    }))
  }

  useEffect(() => {
    if (tripId) loadDetail(tripId)
    else {
      setDetail(null)
      loadList()
    }
  }, [tripId])

  const placesForActiveDay = useMemo(() => {
    if (!detail) return []
    if (!activeDayId) return detail.places || []
    return (detail.places || []).filter((p) => p.trip_day_id === activeDayId)
  }, [detail, activeDayId])

  const mapUrl = useMemo(
    () => mapEmbedUrl(detail?.places || []),
    [detail]
  )

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
    await loadDetail(detail.id)
    setActiveDayId(r.id)
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
        trip_day_id: placeForm.trip_day_id || (activeDayId ? String(activeDayId) : ''),
      })
    }
    await loadDetail(detail.id)
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
    await loadDetail(detail.id)
  }

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
          <button type="button" className="landing-btn-ghost" onClick={onOpenStock}>Stock</button>
          <button type="button" className="landing-btn-ghost" onClick={onBackHub}>Hub</button>
          <button type="button" className="landing-btn-ghost" onClick={onLogout}>ออก</button>
        </div>
      </header>

      <main className="trip-main">
        {err && <p className="dash-text-loss" style={{ marginBottom: 12 }}>{err}</p>}

        {!tripId && (
          <>
            <div className="trip-list-head">
              <div>
                <h1>ทริปของฉัน</h1>
                <p className="dash-text-muted">สร้างแผนเที่ยว จัดวัน และจุดแวะพักได้ในที่เดียว</p>
              </div>
              <button
                type="button"
                style={{ ...btnPrimary, width: 'auto' }}
                onClick={() => setCreating((v) => !v)}
              >
                {creating ? 'ปิดฟอร์ม' : '+ สร้างทริป'}
              </button>
            </div>

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
              <div className="trip-empty">ยังไม่มีทริป — กดสร้างทริปเพื่อเริ่มวางแผน</div>
            )}
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
            <div className="trip-list-head">
              <div>
                <button type="button" className="dash-link-btn" onClick={() => navigate('/trip')}>
                  ← ทริปทั้งหมด
                </button>
                <h1 style={{ marginTop: 8 }}>{detail.title}</h1>
                <p className="dash-text-muted">
                  {detail.destination || 'ไม่ระบุปลายทาง'} · {fmtDate(detail.start_date)} – {fmtDate(detail.end_date)}
                </p>
              </div>
              <button type="button" style={{ ...btnGhost, width: 'auto' }} onClick={() => setConfirmDelete({ type: 'trip' })}>
                ลบทริป
              </button>
            </div>

            <div className="trip-detail-grid">
              <section className="trip-card">
                <div className="trip-section-head">
                  <h3>แผนรายวัน</h3>
                  <button type="button" className="dash-link-btn" onClick={addDay}>+ เพิ่มวัน</button>
                </div>
                <div className="trip-day-tabs">
                  {(detail.days || []).map((d) => (
                    <button
                      key={d.id}
                      type="button"
                      className={`trip-day-tab${activeDayId === d.id ? ' is-active' : ''}`}
                      onClick={() => {
                        setActiveDayId(d.id)
                        setPlaceForm((prev) => ({ ...prev, trip_day_id: String(d.id) }))
                      }}
                    >
                      {d.title || `วันที่ ${d.day_index}`}
                      <span>{fmtDate(d.date)}</span>
                    </button>
                  ))}
                </div>

                <div className="trip-places">
                  {placesForActiveDay.length === 0 && (
                    <p className="dash-text-muted" style={{ fontSize: 13 }}>ยังไม่มีจุดแวะในวันนี้</p>
                  )}
                  {placesForActiveDay.map((p) => (
                    <div key={p.id} className="trip-place-row">
                      <div className="trip-place-row-with-photo">
                        <PlacePhoto
                          url={p.photo_url}
                          alt={p.name}
                          className="trip-place-row-thumb"
                          type={p.type}
                        />
                        <div className="trip-place-row-body">
                          <div className="trip-place-name">
                            <span className="trip-place-type">{typeLabel(p.type)}</span>
                            {p.name}
                          </div>
                          <div className="dash-text-muted" style={{ fontSize: 12, marginTop: 4 }}>
                            {[p.start_time, p.end_time].filter(Boolean).join(' – ') || 'ไม่ระบุเวลา'}
                            {p.address ? ` · ${p.address}` : ''}
                            {p.budget != null ? ` · ฿${Number(p.budget).toLocaleString('th-TH')}` : ''}
                          </div>
                          {p.lat != null && p.lng != null && (
                            <a
                              className="dash-link-btn"
                              style={{ fontSize: 12, marginTop: 6, display: 'inline-block' }}
                              href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}#map=15/${p.lat}/${p.lng}`}
                              target="_blank"
                              rel="noreferrer"
                            >
                              เปิดแผนที่
                            </a>
                          )}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="dash-link-btn"
                        onClick={() => setConfirmDelete({ type: 'place', id: p.id, name: p.name })}
                      >
                        ลบ
                      </button>
                    </div>
                  ))}
                </div>

                <div className="trip-place-form">
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
                          placeholder="เวลาเริ่ม เช่น 09:00"
                          value={placeForm.start_time}
                          onChange={(e) => setPlaceForm({ ...placeForm, start_time: e.target.value })}
                        />
                        <input
                          style={inp({ marginBottom: 0 })}
                          placeholder="เวลาจบ เช่น 11:00"
                          value={placeForm.end_time}
                          onChange={(e) => setPlaceForm({ ...placeForm, end_time: e.target.value })}
                        />
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
              </section>

              <section className="trip-card trip-map-card">
                <h3>แผนที่</h3>
                {mapUrl ? (
                  <iframe
                    title="Trip map"
                    className="trip-map-frame"
                    src={mapUrl}
                    loading="lazy"
                    referrerPolicy="no-referrer-when-downgrade"
                  />
                ) : (
                  <div className="trip-empty">
                    ใส่พิกัดละติจูด/ลองจิจูดที่จุดแวะ เพื่อแสดงแผนที่ OpenStreetMap
                  </div>
                )}
                <p className="dash-text-muted" style={{ fontSize: 12, marginTop: 10 }}>
                  MVP ใช้แผนที่เปิด — ยังไม่ผูก affiliate จองที่พัก (เฟส 2)
                </p>
              </section>
            </div>
          </>
        )}
      </main>

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
