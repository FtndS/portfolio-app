const CX = 100
const CY = 100
const R = 82
const RI = 50

function buildSlices(items) {
  const total = items.reduce((s, it) => s + it.value, 0)
  if (!total) return []

  let angle = -Math.PI / 2
  const MIN_ANGLE = 0.12

  return items.map((it) => {
    const rawPct = it.value / total
    const sweep = Math.max(rawPct * 2 * Math.PI, items.length === 1 ? 2 * Math.PI : MIN_ANGLE)
    const x1 = CX + R * Math.cos(angle)
    const y1 = CY + R * Math.sin(angle)
    angle += sweep
    const x2 = CX + R * Math.cos(angle)
    const y2 = CY + R * Math.sin(angle)
    const ix1 = CX + RI * Math.cos(angle - sweep)
    const iy1 = CY + RI * Math.sin(angle - sweep)
    const ix2 = CX + RI * Math.cos(angle)
    const iy2 = CY + RI * Math.sin(angle)
    const large = sweep > Math.PI ? 1 : 0
    const d = `M${x1} ${y1} A${R} ${R} 0 ${large} 1 ${x2} ${y2} L${ix2} ${iy2} A${RI} ${RI} 0 ${large} 0 ${ix1} ${iy1} Z`
    return { ...it, d, pct: rawPct * 100 }
  })
}

export default function ReportDonut({ slices, centerLabel, centerValue, hideValues, fmtValue }) {
  const data = slices.filter((s) => s.value > 0)
  if (!data.length) {
    return <p className="dash-report-muted" style={{ fontSize: '13px' }}>ไม่มีข้อมูล</p>
  }

  const paths = buildSlices(data)
  const single = paths.length === 1

  return (
    <div className="dash-report-donut">
      <svg viewBox="0 0 200 200" className="dash-report-donut-svg" aria-hidden>
        {single ? (
          <circle
            cx={CX}
            cy={CY}
            r={(R + RI) / 2}
            fill="none"
            stroke={paths[0].color}
            strokeWidth={R - RI}
          />
        ) : (
          paths.map((s, i) => (
            <path key={i} d={s.d} fill={s.color} stroke="#fff" strokeWidth="1.5" />
          ))
        )}
        {centerLabel && (
          <text x={CX} y={CY - 4} textAnchor="middle" className="dash-report-donut-center-label">
            {centerLabel}
          </text>
        )}
        {centerValue && (
          <text x={CX} y={CY + 14} textAnchor="middle" className="dash-report-donut-center-value">
            {centerValue}
          </text>
        )}
      </svg>
      <ul className="dash-report-donut-legend">
        {paths.map((s, i) => (
          <li key={i}>
            <span className="dash-report-legend-dot" style={{ background: s.color }} />
            <span className="dash-report-donut-legend-label">{s.label}</span>
            <span className="dash-report-donut-legend-pct">{s.pct.toFixed(1)}%</span>
            {!hideValues && fmtValue && (
              <span className="dash-report-donut-legend-val">{fmtValue(s.value)}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  )
}
