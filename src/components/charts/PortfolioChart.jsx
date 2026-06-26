import { useMemo } from 'react'
import { symFor, CHART_RANGES, BENCHMARK_OPTIONS } from '../../lib/constants'
import { fmtPct } from '../../lib/format'

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
  hideValues = false,
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
    ? [...portIndexed, ...bmVals.filter((v) => v != null)]
    : [...vals, ...costs].filter((v) => v > 0)

  const finite = ySeries.filter((v) => Number.isFinite(v))
  let min = 0
  let max = 1
  if (finite.length) {
    let dataMin = Math.min(...finite)
    let dataMax = Math.max(...finite)
    if (compareMode && dataMax - dataMin < 3) {
      const mid = (dataMax + dataMin) / 2
      dataMin = mid - 3
      dataMax = mid + 3
    } else {
      dataMin *= 0.98
      dataMax *= 1.02
    }
    min = dataMin
    max = dataMax
  }
  const range = max - min || 1

  const daySpan =
    dates.length >= 2
      ? Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000)
      : 0
  const shortHistory = daySpan < 7

  const toPts = (arr) =>
    arr
      .map((v, i) => {
        if (v == null || (compareMode ? false : v <= 0 && i > 0)) return null
        const x = history.length < 2 ? W / 2 : pad + (i / (history.length - 1)) * (W - pad * 2)
        const y = H - pad - ((Number(v) - min) / range) * (H - pad * 2)
        if (!Number.isFinite(y)) return null
        return `${x},${y}`
      })
      .filter(Boolean)
      .join(' ')

  const portLine = compareMode ? portIndexed : vals
  const portPts = toPts(portLine)
  const costPts = compareMode ? '' : toPts(costs)
  const bmPts = compareMode ? toPts(bmVals) : ''

  const segmentClass = (active) =>
    `dash-chart-segment-btn${active ? ' dash-chart-segment-btn--active' : ''}`

  return (
    <div className="dash-chart-card">
      <div className="dash-chart-head">
        <div>
          <h3 className="dash-chart-title">Portfolio Value</h3>
          <p className="dash-chart-sub">
            {compareMode
              ? 'เทียบ % การเปลี่ยนในช่วงที่เลือก (ฐาน 100) — ไม่ใช่กำไรรวมจากทุน'
              : 'มูลค่าพอร์ตจาก transaction + ราคาย้อนหลัง'}
          </p>
        </div>
        <div className="dash-chart-stats">
          <div className="dash-chart-stat-value">
            {hideValues
              ? fmtPct(portChg)
              : `${sym}${latest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="dash-chart-stat-chg" style={{ color: portChg >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
            {compareMode ? 'ในช่วงนี้ ' : ''}{portChg >= 0 ? '+' : ''}{portChg.toFixed(2)}%
            {hasBenchmark && (
              <span className="dash-text-muted" style={{ marginLeft: '8px' }}>
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
              className={segmentClass(chartRange === r.id)}
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
              className={segmentClass(benchmarkMode === b.id)}
              onClick={() => onBenchmarkModeChange?.(b.id)}
              disabled={loading}
            >
              {b.label}
            </button>
          ))}
        </div>
      </div>

      {loading && <p className="dash-chart-loading">กำลังโหลดกราฟ...</p>}

      {shortHistory && !loading && (
        <p className="dash-chart-hint">
          พอร์ตมีข้อมูล {dates.length} วันในช่วงนี้ (เริ่ม {dates[0]})
          {compareMode && ' — ลองปิด Benchmark หรือเลือกช่วง All เพื่อดูมูลค่าเต็ม'}
        </p>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart-svg" preserveAspectRatio="xMidYMid meet">
        {!compareMode && costPts && (
          <polyline points={costPts} fill="none" stroke="var(--chart-cost)" strokeWidth="1.5" strokeDasharray="4,4" strokeLinejoin="round" />
        )}
        {portPts && (
          <polyline points={portPts} fill="none" stroke="var(--chart-port)" strokeWidth="2.5" strokeLinejoin="round" />
        )}
        {compareMode && bmPts && (
          <polyline points={bmPts} fill="none" stroke="var(--chart-benchmark)" strokeWidth="2" strokeDasharray="6,4" strokeLinejoin="round" />
        )}
      </svg>

      <div className="dash-chart-foot">
        <span>{dates[0]}</span>
        <span className="dash-chart-legend">
          <span><span className="dash-chart-legend-line" style={{ background: 'var(--chart-port)' }} /> {compareMode ? 'พอร์ต (indexed)' : 'มูลค่า'}</span>
          {!compareMode && <span><span className="dash-chart-legend-line dash-chart-legend-line--dashed" style={{ background: 'var(--chart-cost)' }} /> ทุน</span>}
          {compareMode && benchmark?.label && (
            <span><span className="dash-chart-legend-line dash-chart-legend-line--dashed" style={{ background: 'var(--chart-benchmark)' }} /> {benchmark.label}</span>
          )}
        </span>
        <span>{dates[dates.length - 1]}</span>
      </div>
    </div>
  )
}
