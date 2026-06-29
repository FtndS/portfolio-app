const DONUT_MAX = 8

export function shouldUseBarChart(count) {
  return count > DONUT_MAX
}

export default function ReportBarChart({ items, hideValues, fmtValue, maxItems = 20 }) {
  const total = items.reduce((s, it) => s + it.value, 0)
  if (!total) {
    return <p className="dash-report-muted" style={{ fontSize: '13px' }}>ไม่มีข้อมูล</p>
  }

  const rows = items.map((it, i) => ({
    ...it,
    pct: (it.value / total) * 100,
    color: it.color,
  }))

  const shown = rows.slice(0, maxItems)
  const rest = rows.slice(maxItems)
  const restPct = rest.reduce((s, r) => s + r.pct, 0)
  const restVal = rest.reduce((s, r) => s + r.value, 0)

  return (
    <ul className="dash-report-bars dash-report-bars--chart">
      {shown.map((row) => (
        <li key={row.label}>
          <div className="dash-report-bar-head">
            <span className="dash-report-bar-label">{row.label}</span>
            <span>
              {row.pct.toFixed(1)}%
              {!hideValues && fmtValue && ` · ${fmtValue(row.value)}`}
            </span>
          </div>
          <div className="dash-report-bar-track">
            <div
              className="dash-report-bar-fill"
              style={{ width: `${Math.max(row.pct, 0.5)}%`, background: row.color }}
            />
          </div>
        </li>
      ))}
      {rest.length > 0 && (
        <li>
          <div className="dash-report-bar-head">
            <span className="dash-report-bar-label">อื่นๆ ({rest.length} รายการ)</span>
            <span>
              {restPct.toFixed(1)}%
              {!hideValues && fmtValue && ` · ${fmtValue(restVal)}`}
            </span>
          </div>
          <div className="dash-report-bar-track">
            <div
              className="dash-report-bar-fill"
              style={{ width: `${Math.max(restPct, 0.5)}%`, background: '#9a9185' }}
            />
          </div>
        </li>
      )}
    </ul>
  )
}
