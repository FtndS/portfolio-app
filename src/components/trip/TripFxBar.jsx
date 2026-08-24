import {
  HOME_CURRENCY,
  currencyMeta,
  foreignCurrencyOptions,
  formatTripMoney,
  convertTripAmount,
} from '../../lib/tripFx'

function ForeignSelect({ value, onChange }) {
  return (
    <select
      className="trip-fx-select"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      aria-label="สกุลเงินปลายทาง"
    >
      {foreignCurrencyOptions().map((c) => (
        <option key={c.code} value={c.code}>{c.code}</option>
      ))}
    </select>
  )
}

export default function TripFxBar({
  foreign,
  inverted,
  onForeignChange,
  onSwap,
  unitsPerUsd,
}) {
  const home = currencyMeta(HOME_CURRENCY)
  const other = currencyMeta(foreign)
  const oneForeignInHome = convertTripAmount(1, foreign, HOME_CURRENCY, unitsPerUsd)
  const oneHomeInForeign = convertTripAmount(1, HOME_CURRENCY, foreign, unitsPerUsd)

  return (
    <div className="trip-fx-bar" title="แปลงค่าเงินสำหรับทริปต่างประเทศ">
      {inverted ? (
        <ForeignSelect value={foreign} onChange={onForeignChange} />
      ) : (
        <span className="trip-fx-chip">{home.code}</span>
      )}
      <button
        type="button"
        className="trip-fx-swap"
        onClick={onSwap}
        title="สลับทิศทางแปลงค่าเงิน"
        aria-label="สลับทิศทางแปลงค่าเงิน"
      >
        ⇄
      </button>
      {inverted ? (
        <span className="trip-fx-chip">{home.code}</span>
      ) : (
        <ForeignSelect value={foreign} onChange={onForeignChange} />
      )}
      <span className="trip-fx-rate">
        {inverted
          ? `1 ${other.code} ≈ ${formatTripMoney(oneForeignInHome, HOME_CURRENCY)}`
          : `1 ${home.code} ≈ ${formatTripMoney(oneHomeInForeign, foreign)}`}
      </span>
    </div>
  )
}
