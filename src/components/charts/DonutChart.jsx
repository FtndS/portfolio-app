import { SECTOR_COLORS } from '../../lib/constants'
import { convertAmount } from '../../lib/currency'

export default function DonutChart({ holdings, prices, displayCurrency, fxRate }) {
  const getVal = (h) => {
    const p = prices[h.ticker] || Number(h.avg_cost)
    const v = Number(h.shares) * p
    return convertAmount(v, h.currency || 'USD', displayCurrency, fxRate)
  }
  const total = holdings.reduce((s, h) => s + getVal(h), 0)
  if (!holdings.length || total === 0) return null
  const sorted = [...holdings].sort((a, b) => getVal(b) - getVal(a))

  const CX = 100
  const CY = 100
  const R = 80
  const ri = 48
  const isSingleHolding = sorted.length === 1

  let angle = -Math.PI / 2
  const MIN_ANGLE = 0.15
  const slices = sorted.map((h, i) => {
    const val = getVal(h)
    const rawPct = val / total
    const sweep = Math.max(rawPct * 2 * Math.PI, MIN_ANGLE)
    const x1 = CX + R * Math.cos(angle)
    const y1 = CY + R * Math.sin(angle)
    angle += sweep
    const x2 = CX + R * Math.cos(angle)
    const y2 = CY + R * Math.sin(angle)
    const ix1 = CX + ri * Math.cos(angle - sweep)
    const iy1 = CY + ri * Math.sin(angle - sweep)
    const ix2 = CX + ri * Math.cos(angle)
    const iy2 = CY + ri * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const d = `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${ri} ${ri} 0 ${large} 0 ${ix1} ${iy1} Z`
    return { ...h, d, color: SECTOR_COLORS[i % SECTOR_COLORS.length], pct: (rawPct * 100).toFixed(1) }
  })

  return (
    <div className="dash-donut">
      <svg viewBox="0 0 200 200" style={{ width: '160px', flexShrink: 0 }}>
        {isSingleHolding ? (
          <circle cx={CX} cy={CY} r={(R + ri) / 2} fill="none" stroke={SECTOR_COLORS[0]} strokeWidth={R - ri} />
        ) : (
          slices.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} stroke="var(--bg)" strokeWidth="2" />
          ))
        )}
        <text x={CX} y={CY - 6} textAnchor="middle" fontSize="10" fill="var(--text-muted)" fontFamily="var(--font)">พอร์ตทั้งหมด</text>
        <text x={CX} y={CY + 10} textAnchor="middle" fontSize="13" fontWeight="600" fill="var(--text)" fontFamily="var(--font)">{holdings.length} หลักทรัพย์</text>
      </svg>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '10px' }}>
        {slices.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div style={{ width: '10px', height: '10px', borderRadius: '3px', background: s.color, flexShrink: 0 }} />
            <span className="dash-donut-ticker" style={{ fontSize: '13px', fontWeight: 500, minWidth: '55px' }}>{s.ticker}</span>
            <div className="dash-donut-bar" style={{ flex: 1, height: '4px', borderRadius: '999px', overflow: 'hidden' }}>
              <div style={{ width: `${s.pct}%`, height: '100%', background: s.color, borderRadius: '999px' }} />
            </div>
            <span className="dash-text-muted" style={{ fontSize: '12px', minWidth: '42px', textAlign: 'right' }}>{s.pct}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
