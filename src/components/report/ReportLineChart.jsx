import { useId } from 'react'
import { fmtDate, fmtChartAxis } from '../../lib/format'

export default function ReportLineChart({ history, hideValues, sym = '$' }) {
  const gradId = useId().replace(/:/g, '')

  if (!history?.length) {
    return <p className="dash-report-muted" style={{ fontSize: '13px' }}>ไม่มีประวัติมูลค่าพอร์ต</p>
  }

  const vals = history.map((d) => Number(d.total_value))
  const costs = history.map((d) => Number(d.total_cost || 0))
  const dates = history.map((d) => d.date)

  const portNums = vals.filter((n) => Number.isFinite(n) && n > 0)
  const minV = portNums.length ? Math.min(...portNums) * 0.98 : 0
  const maxV = portNums.length ? Math.max(...portNums) * 1.02 : 1
  const range = maxV - minV || 1

  const yTicks = [minV, minV + range * 0.5, maxV]
  const fmtAxis = (n) => fmtChartAxis(n, sym, { hideValues })
  const maxLabelLen = Math.max(...yTicks.map((v) => fmtAxis(v).length))
  const padL = Math.max(56, Math.min(80, maxLabelLen * 6 + 14))

  const W = 640
  const H = 220
  const pad = { t: 20, r: 16, b: 36, l: padL }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const xAt = (i) => pad.l + (i / Math.max(history.length - 1, 1)) * innerW
  const yAt = (v) => pad.t + innerH - ((v - minV) / range) * innerH

  const toPath = (series) =>
    series
      .map((v, i) => `${i === 0 ? 'M' : 'L'}${xAt(i).toFixed(1)} ${yAt(v).toFixed(1)}`)
      .join(' ')

  const portPath = toPath(vals)
  const costPath = toPath(costs)
  const areaPath = `${portPath} L${xAt(vals.length - 1).toFixed(1)} ${(pad.t + innerH).toFixed(1)} L${pad.l} ${(pad.t + innerH).toFixed(1)} Z`

  const first = vals.find((v) => v > 0) ?? vals[0] ?? 0
  const last = vals[vals.length - 1] ?? 0
  const chg = first > 0 ? ((last - first) / first) * 100 : 0

  return (
    <div className="dash-report-line-wrap">
      <p className="dash-report-chart-caption">
        กราฟเส้นแสดงมูลค่าพอร์ตตามเวลา (คำนวณจาก transaction + ราคาย้อนหลัง)
        — หากนำเข้าหรือเพิ่มหุ้นจำนวนมากในวันเดียว กราฟอาจกระโดดขึ้นในช่วงนั้น
      </p>
      <div className="dash-report-line-meta">
        <span className={chg >= 0 ? 'dash-text-gain' : 'dash-text-loss'}>
          {hideValues ? '—' : `${chg >= 0 ? '+' : ''}${chg.toFixed(2)}%`}
          {!hideValues && <span className="dash-report-muted" style={{ fontWeight: 400, marginLeft: '6px' }}>ตั้งแต่ต้นช่วง</span>}
        </span>
        <span className="dash-report-muted">
          {fmtDate(dates[0])} → {fmtDate(dates[dates.length - 1])}
        </span>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="dash-report-line-svg" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {yTicks.map((v, i) => (
          <g key={i}>
            <line
              x1={pad.l}
              y1={yAt(v)}
              x2={W - pad.r}
              y2={yAt(v)}
              stroke="#e5ddd0"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
            <text x={pad.l - 6} y={yAt(v) + 4} textAnchor="end" className="dash-report-line-tick" fill="#7a7268">
              {fmtAxis(v)}
            </text>
          </g>
        ))}
        <path d={areaPath} fill={`url(#${gradId})`} />
        <path d={costPath} fill="none" stroke="#9a9185" strokeWidth="1.5" strokeDasharray="5 4" />
        <path d={portPath} fill="none" stroke="#6c5ce7" strokeWidth="2.5" strokeLinejoin="round" />
        <text x={pad.l} y={H - 10} className="dash-report-line-tick" fill="#7a7268">{fmtDate(dates[0])}</text>
        <text x={W - pad.r} y={H - 10} textAnchor="end" className="dash-report-line-tick" fill="#7a7268">
          {fmtDate(dates[dates.length - 1])}
        </text>
      </svg>
      <div className="dash-report-line-legend">
        <span><i className="dash-report-line-swatch dash-report-line-swatch--port" /> มูลค่าพอร์ต</span>
        <span><i className="dash-report-line-swatch dash-report-line-swatch--cost" /> ทุน</span>
      </div>
    </div>
  )
}
