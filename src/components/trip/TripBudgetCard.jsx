import {
  HOME_CURRENCY,
  convertTripAmount,
  formatTripMoney,
  currencyMeta,
} from '../../lib/tripFx'

const BUFFER_OPTIONS = [0, 10, 15, 20]

export default function TripBudgetCard({
  totalNative,
  nativeCurrency,
  foreign,
  unitsPerUsd,
  inverted,
  bufferPct,
  onBufferChange,
  pricedCount,
  placeCount,
}) {
  const totalHome = convertTripAmount(totalNative, nativeCurrency, HOME_CURRENCY, unitsPerUsd)
  const totalForeign = convertTripAmount(totalNative, nativeCurrency, foreign, unitsPerUsd)
  const prepareHome = totalHome * (1 + bufferPct / 100)
  const prepareForeign = totalForeign * (1 + bufferPct / 100)
  const foreignMeta = currencyMeta(foreign)

  const primaryCurrency = inverted ? foreign : HOME_CURRENCY
  const secondaryCurrency = inverted ? HOME_CURRENCY : foreign
  const totalPrimary = inverted ? totalForeign : totalHome
  const totalSecondary = inverted ? totalHome : totalForeign
  const preparePrimary = inverted ? prepareForeign : prepareHome
  const prepareSecondary = inverted ? prepareHome : prepareForeign

  return (
    <section className="trip-budget-card trip-no-print">
      <div className="trip-budget-card-head">
        <h3>ประเมินค่าใช้จ่าย</h3>
        <label className="trip-budget-buffer">
          <span>เผื่อ</span>
          <select
            value={bufferPct}
            onChange={(e) => onBufferChange(Number(e.target.value))}
            aria-label="เผื่อค่าใช้จ่ายเพิ่ม"
          >
            {BUFFER_OPTIONS.map((n) => (
              <option key={n} value={n}>{n === 0 ? 'ไม่เผื่อ' : `+${n}%`}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="trip-budget-card-meta">
        {pricedCount > 0
          ? `จากงบในแผน ${pricedCount}/${placeCount} จุด · สกุลต้นทาง ${nativeCurrency} · แสดงผลเป็น ${primaryCurrency}`
          : 'ยังไม่มีงบในจุดแวะ — ใส่ประมาณการที่ฟอร์มเพิ่มจุดแวะ'}
      </p>
      <div className="trip-budget-grid">
        <div>
          <span className="trip-budget-label">รวมในแผน</span>
          <strong>{formatTripMoney(totalPrimary, primaryCurrency)}</strong>
          <span className="trip-budget-alt">
            ≈ {formatTripMoney(totalSecondary, secondaryCurrency)} {secondaryCurrency}
          </span>
        </div>
        <div>
          <span className="trip-budget-label">เงินที่ต้องเตรียม</span>
          <strong>{formatTripMoney(preparePrimary, primaryCurrency)}</strong>
          <span className="trip-budget-alt">
            ≈ {formatTripMoney(prepareSecondary, secondaryCurrency)} {secondaryCurrency}
          </span>
        </div>
      </div>
      <p className="trip-budget-hint">
        ใช้ประเมินเงินสด/บัตรก่อนเดินทาง อัตราเป็นราคาตลาดโดยประมาณ — ธนาคารอาจบวก spread
      </p>
    </section>
  )
}
