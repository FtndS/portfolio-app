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

  return (
    <footer className="trip-sticky-bar trip-no-print">
      <div className="trip-sticky-bar-price">
        <span className="trip-sticky-bar-label">
          จากงบในแผน
          {pricedCount > 0 ? ` · ${pricedCount}/${placeCount} จุด` : ' · ยังไม่มีงบ'}
        </span>
        <strong className="trip-sticky-bar-total">
          {formatTripMoney(preparePrimary, primary)}
          <span className="trip-sticky-bar-tag">ประมาณการ</span>
        </strong>
        <span className="trip-sticky-bar-sub">
          รวมดิบ {formatTripMoney(totalPrimary, primary)}
          {bufferPct > 0 ? ` · เผื่อ +${bufferPct}%` : ''}
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
