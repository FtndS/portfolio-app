import { formatTripMoney, HOME_CURRENCY, convertTripAmount } from '../../lib/tripFx'
import './TripStudio.css'

const BUFFER_OPTIONS = [0, 10, 15, 20]

export default function TripStickyBar({
  totalNative,
  nativeCurrency = HOME_CURRENCY,
  foreign,
  unitsPerUsd,
  inverted,
  bufferPct,
  onBufferChange,
  pricedCount,
  placeCount,
  budgetedCount = 0,
  estimatedCount = 0,
  liveCount = 0,
  onExport,
  onEditMode,
  viewMode,
}) {
  const totalHome = convertTripAmount(totalNative, nativeCurrency, HOME_CURRENCY, unitsPerUsd)
  const totalForeign = convertTripAmount(totalNative, nativeCurrency, foreign, unitsPerUsd)
  const prepareHome = totalHome * (1 + bufferPct / 100)
  const prepareForeign = totalForeign * (1 + bufferPct / 100)
  const primary = inverted ? foreign : HOME_CURRENCY
  const totalPrimary = inverted ? totalForeign : totalHome
  const preparePrimary = inverted ? prepareForeign : prepareHome

  const mixLabel = (() => {
    if (pricedCount <= 0) return 'ยังไม่มีตัวเลข'
    const parts = []
    if (budgetedCount > 0) parts.push(`งบ ${budgetedCount}`)
    if (liveCount > 0) parts.push(`ตั๋วจริง ${liveCount}`)
    if (estimatedCount > 0) parts.push(`ประมาณ ${estimatedCount}`)
    return `${parts.join(' · ') || `${pricedCount} จุด`} / ${placeCount} จุด`
  })()

  return (
    <footer className="trip-sticky-bar trip-no-print">
      <div className="trip-sticky-bar-price">
        <span className="trip-sticky-bar-label">
          รวมทริป · {mixLabel}
        </span>
        <strong className="trip-sticky-bar-total">
          {formatTripMoney(preparePrimary, primary)}
          <span className="trip-sticky-bar-tag">
            {liveCount > 0 ? 'ผสมราคาจริงใกล้เคียง' : 'ประมาณการ'}
          </span>
        </strong>
        <span className="trip-sticky-bar-sub">
          รวมดิบ {formatTripMoney(totalPrimary, primary)}
          {bufferPct > 0 ? ` · เผื่อ +${bufferPct}%` : ''}
          {liveCount > 0
            ? ' · ตั๋วจาก Google Flights (SerpAPI) · จองนอกแอป'
            : ' · ยังไม่ใช่ราคาจองจริง'}
        </span>
      </div>
      <label className="trip-sticky-buffer">
        <span>เผื่อ</span>
        <select
          value={bufferPct}
          onChange={(e) => onBufferChange(Number(e.target.value))}
          aria-label="เผื่อค่าใช้จ่าย"
        >
          {BUFFER_OPTIONS.map((n) => (
            <option key={n} value={n}>{n === 0 ? '0%' : `+${n}%`}</option>
          ))}
        </select>
      </label>
      <div className="trip-sticky-actions">
        {viewMode === 'plan' ? (
          <button type="button" className="trip-sticky-btn trip-sticky-btn--ghost" onClick={onEditMode}>
            จัดแผน
          </button>
        ) : null}
        <button type="button" className="trip-sticky-btn trip-sticky-btn--primary" onClick={onExport}>
          Export
        </button>
      </div>
    </footer>
  )
}
