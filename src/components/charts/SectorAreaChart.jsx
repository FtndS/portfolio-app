import { SECTOR_COLORS } from '../../lib/constants'

export default function SectorAreaChart({ holdings, prices, displayCurrency, fxRate }) {
  const getVal = (h) => {
    const p = prices[h.ticker] || Number(h.avg_cost)
    const v = Number(h.shares) * p
    if (displayCurrency === 'THB') return h.currency === 'THB' ? v : v * fxRate
    return h.currency === 'THB' ? v / fxRate : v
  }
  const total = holdings.reduce((s, h) => s + getVal(h), 0)
  if (!holdings.length || total === 0) return null
  const sectorMap = {}
  holdings.forEach((h) => {
    const s = h.sector || 'Other'
    sectorMap[s] = (sectorMap[s] || 0) + getVal(h)
  })
  const sectors = Object.entries(sectorMap)
    .map(([name, value]) => ({ name, value, pct: (value / total) * 100 }))
    .sort((a, b) => b.value - a.value)
  const W = 660
  const H = 120
  let x = 0
  return (
    <div className="dash-card">
      <h3 className="dash-card-title">Sector Allocation</h3>
      <p className="dash-card-sub">สัดส่วน sector ในพอร์ตปัจจุบัน</p>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', borderRadius: '8px' }}>
        {sectors.map((s, i) => {
          const w = (s.pct / 100) * W
          const rect = <rect key={i} x={x} y={0} width={w} height={H} fill={SECTOR_COLORS[i % SECTOR_COLORS.length]} />
          x += w
          return rect
        })}
      </svg>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '12px' }}>
        {sectors.map((s, i) => (
          <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px' }}>
            <div style={{ width: 10, height: 10, borderRadius: 3, background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
            <span className="dash-text-secondary">{s.name}</span>
            <span className="dash-text-muted">{s.pct.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  )
}
