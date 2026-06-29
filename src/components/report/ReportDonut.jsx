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

export default function ReportDonut({ slices, centerLabel, centerValue, hideValues, fmtValue, maxLegend = 10 }) {
  const data = slices.filter((s) => s.value > 0)
  if (!data.length) {
    return <p className="dash-report-muted" style={{ fontSize: '13px' }}>ไม่มีข้อมูล</p>
  }

  const paths = buildSlices(data)
  const single = paths.length === 1
  const legendShown = paths.slice(0, maxLegend)
  const legendRest = paths.slice(maxLegend)
  const restPct = legendRest.reduce((s, p) => s + p.pct, 0)
  const restVal = legendRest.reduce((s, p) => s + p.value, 0)

  const centerDisplay = centerValue && String(centerValue).length <= 12 ? centerValue : String(paths.length)

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
          <text x={CX} y={CY - 6} textAnchor="middle" className="dash-report-donut-center-label" fontSize="13" fill="#7a7268">
            {centerLabel}
          </text>
        )}
        {centerDisplay && (
          <text x={CX} y={CY + 16} textAnchor="middle" className="dash-report-donut-center-value" fontSize="22" fontWeight="700" fill="#3d3832">
            {centerDisplay}
          </text>
        )}
      </svg>
      <ul className="dash-report-donut-legend">
        {legendShown.map((s, i) => (
          <li key={i}>
            <span className="dash-report-legend-dot" style={{ background: s.color }} />
            <span className="dash-report-donut-legend-label" title={s.label}>{s.label}</span>
            <span className="dash-report-donut-legend-pct">{s.pct.toFixed(1)}%</span>
            {!hideValues && fmtValue && (
              <span className="dash-report-donut-legend-val">{fmtValue(s.value)}</span>
            )}
          </li>
        ))}
        {legendRest.length > 0 && (
          <li className="dash-report-donut-legend-more">
            <span className="dash-report-legend-dot" style={{ background: '#9a9185' }} />
            <span className="dash-report-donut-legend-label">อื่นๆ ({legendRest.length})</span>
            <span className="dash-report-donut-legend-pct">{restPct.toFixed(1)}%</span>
            {!hideValues && fmtValue && (
              <span className="dash-report-donut-legend-val">{fmtValue(restVal)}</span>
            )}
          </li>
        )}
      </ul>
    </div>
  )
}
