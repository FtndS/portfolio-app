import { useMemo } from 'react'
import { symFor, CHART_RANGES, BENCHMARK_OPTIONS } from '../../lib/constants'

function dateKey(d) {
  return d?.split?.('T')?.[0] || d
}

function indexedSeries(values) {
  const first = values.find((v) => v > 0) || values[0] || 1
  return values.map((v) => (first > 0 ? (v / first) * 100 : 100))
}

export default function PortfolioChart({
  history,
  benchmark,
  displayCurrency,
  chartRange,
  onChartRangeChange,
  benchmarkMode,
  onBenchmarkModeChange,
  loading,
}) {
  const sym = symFor(displayCurrency === 'THB' ? 'THB' : 'USD')

  const chartData = useMemo(() => {
    if (!history?.length) return null

    const vals = history.map((d) => Number(d.total_value))
    const costs = history.map((d) => Number(d.total_cost || 0))
    const dates = history.map((d) => dateKey(d.date))

    const bmMap = Object.fromEntries(
      (benchmark?.series || []).map((p) => [dateKey(p.date), Number(p.indexed)])
    )
    let lastBm = null
    const bmVals = dates.map((d) => {
      if (bmMap[d] != null) lastBm = bmMap[d]
      return lastBm
    })

    const hasBenchmark = benchmark?.series?.length > 0 && benchmarkMode !== 'none'
    const portIndexed = indexedSeries(vals)
    const latest = vals[vals.length - 1]
    const first = vals[0]
    const portChg = first > 0 ? ((latest - first) / first) * 100 : 0

    return {
      vals,
      costs,
      dates,
      bmVals,
      hasBenchmark,
      portIndexed,
      latest,
      portChg,
      bmChg: benchmark?.changePct ?? 0,
    }
  }, [history, benchmark, benchmarkMode])

  if (!history?.length) {
    return (
      <div className="dash-chart-card dash-chart-card--empty">
        📈 บันทึก Transaction เพื่อดูกราฟมูลค่าพอร์ต
      </div>
    )
  }

  if (!chartData) return null

  const W = 660
  const H = 220
  const pad = 30
  const { vals, costs, dates, bmVals, hasBenchmark, portIndexed, latest, portChg, bmChg } = chartData
  const compareMode = hasBenchmark

  const ySeries = compareMode
    ? [portIndexed, ...bmVals.filter((v) => v != null)]
    : [...vals, ...costs].filter((v) => v > 0)

  const min = ySeries.length ? Math.min(...ySeries) * (compareMode ? 0.98 : 0.98) : 0
  const max = ySeries.length ? Math.max(...ySeries) * (compareMode ? 1.02 : 1.02) : 1
  const range = max - min || 1

  const toPts = (arr) =>
    arr
      .map((v, i) => {
        if (v == null || (compareMode ? false : v <= 0 && i > 0)) return null
        const x = history.length < 2 ? W / 2 : pad + (i / (history.length - 1)) * (W - pad * 2)
        const y = H - pad - ((Number(v) - min) / range) * (H - pad * 2)
        return `${x},${y}`
      })
      .filter(Boolean)
      .join(' ')

  const portLine = compareMode ? portIndexed : vals
  const portPts = toPts(portLine)
  const costPts = compareMode ? '' : toPts(costs)
  const bmPts = compareMode ? toPts(bmVals) : ''

  const btnStyle = (active) => ({
    padding: '5px 12px',
    fontSize: '12px',
    borderRadius: '6px',
    border: `1px solid ${active ? '#6c5ce7' : '#2a2a2a'}`,
    background: active ? '#2d2a5e' : 'transparent',
    color: active ? '#a29bfe' : '#555',
    cursor: 'pointer',
  })

  return (
    <div className="dash-chart-card">
      <div className="dash-chart-head">
        <div>
          <h3 className="dash-chart-title">Portfolio Value</h3>
          <p className="dash-chart-sub">
            {compareMode ? 'เทียบ % จากจุดเริ่มต้นช่วงที่เลือก (ฐาน 100)' : 'มูลค่าพอร์ตจาก transaction + ราคาย้อนหลัง'}
          </p>
        </div>
        <div className="dash-chart-stats">
          {!compareMode && (
            <div className="dash-chart-stat-value">{sym}{latest.toLocaleString('en-US', { minimumFractionDigits: 2 })}</div>
          )}
          <div className="dash-chart-stat-chg" style={{ color: portChg >= 0 ? '#27ae60' : '#e74c3c' }}>
            พอร์ต {portChg >= 0 ? '+' : ''}{portChg.toFixed(2)}%
            {hasBenchmark && (
              <span style={{ color: '#888', marginLeft: '8px' }}>
                vs {benchmark.label} {bmChg >= 0 ? '+' : ''}{bmChg.toFixed(2)}%
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="dash-chart-toolbar">
        <div className="dash-chart-toolbar-group">
          <span className="dash-chart-toolbar-label">ช่วงเวลา</span>
          {CHART_RANGES.map((r) => (
            <button
              key={r.id}
              type="button"
              style={btnStyle(chartRange === r.id)}
              onClick={() => onChartRangeChange?.(r.id)}
              disabled={loading}
            >
              {r.label}
            </button>
          ))}
        </div>
        <div className="dash-chart-toolbar-group">
          <span className="dash-chart-toolbar-label">Benchmark</span>
          {BENCHMARK_OPTIONS.map((b) => (
            <button
              key={b.id}
              type="button"
              style={btnStyle(benchmarkMode === b.id)}
              onClick={() => onBenchmarkModeChange?.(b.id)}
              disabled={loading}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="dash-chart-loading">กำลังโหลดกราฟ...</p>}

      <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart-svg">
        {!compareMode && costPts && (
          <polyline points={costPts} fill="none" stroke="#555" strokeWidth="1.5" strokeDasharray="4,4" strokeLinejoin="round" />
        )}
        {portPts && (
          <polyline points={portPts} fill="none" stroke="#6c5ce7" strokeWidth="2.5" strokeLinejoin="round" />
        )}
        {compareMode && bmPts && (
          <polyline points={bmPts} fill="none" stroke="#e17055" strokeWidth="2" strokeDasharray="6,4" strokeLinejoin="round" />
        )}
      </svg>

      <div className="dash-chart-foot">
        <span>{dates[0]}</span>
        <span className="dash-chart-legend">
          <span><span className="dash-chart-legend-line" style={{ background: '#6c5ce7' }} /> {compareMode ? 'พอร์ต (indexed)' : 'มูลค่า'}</span>
          {!compareMode && <span><span className="dash-chart-legend-line dash-chart-legend-line--dashed" style={{ background: '#555' }} /> ทุน</span>}
          {compareMode && benchmark?.label && (
            <span><span className="dash-chart-legend-line dash-chart-legend-line--dashed" style={{ background: '#e17055' }} /> {benchmark.label}</span>
          )}
        </span>
        <span>{dates[dates.length - 1]}</span>
      </div>
    </div>
  )
}
