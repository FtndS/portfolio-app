import { useMemo, useId } from 'react'
import { symFor, CHART_RANGES, BENCHMARK_OPTIONS } from '../../lib/constants'
import { fmtPct, fmtDate, fmtChartAxis } from '../../lib/format'
import { usePrivacy } from '../../lib/privacy'

function dateKey(d) {
  return d?.split?.('T')?.[0] || d
}

function indexedSeries(values) {
  const first = values.find((v) => v > 0) || values[0] || 1
  return values.map((v) => (first > 0 ? (v / first) * 100 : 100))
}

function leadingZeroEnd(values) {
  const idx = values.findIndex((v) => v > 0)
  return idx < 0 ? 0 : idx
}

function computeYScale(series, compareMode) {
  const finite = series.filter((v) => Number.isFinite(v) && (compareMode ? true : v > 0))
  if (!finite.length) return { min: 0, max: 1 }

  let dataMin = Math.min(...finite)
  let dataMax = Math.max(...finite)
  const span = dataMax - dataMin || 1

  if (compareMode) {
    const padAmt = Math.max(span * 0.12, 1.2)
    return { min: dataMin - padAmt, max: dataMax + padAmt }
  }

  const padAmt = Math.max(span * 0.06, dataMax * 0.02)
  return { min: Math.max(0, dataMin - padAmt), max: dataMax + padAmt }
}

function pickDateTicks(dates, count = 4) {
  if (!dates.length) return []
  if (dates.length <= count) return dates.map((d, i) => ({ d, i }))
  const picks = []
  for (let t = 0; t < count; t += 1) {
    const i = Math.round((t / (count - 1)) * (dates.length - 1))
    picks.push({ d: dates[i], i })
  }
  return picks
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
  firstTxDate,
}) {
  const { hideValues } = usePrivacy()
  const gradId = useId().replace(/:/g, '')
  const sym = symFor(displayCurrency === 'THB' ? 'THB' : 'USD')

  const chartData = useMemo(() => {
    if (!history?.length) return null

    const allVals = history.map((d) => Number(d.total_value))
    const allCosts = history.map((d) => Number(d.total_cost || 0))
    const allDates = history.map((d) => dateKey(d.date))

    const trimFrom = leadingZeroEnd(allVals)
    const vals = allVals.slice(trimFrom)
    const costs = allCosts.slice(trimFrom)
    const dates = allDates.slice(trimFrom)

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
    const latest = vals[vals.length - 1] ?? 0
    const firstPositive = vals.find((v) => v > 0) ?? vals[0] ?? 0
    const portChg = firstPositive > 0 ? ((latest - firstPositive) / firstPositive) * 100 : 0

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
      trimFrom,
      fullRangeStart: allDates[0],
      fullRangeEnd: allDates[allDates.length - 1],
      firstValueDate: dates[0] ?? null,
      skippedEnd: trimFrom > 0 ? allDates[trimFrom - 1] : null,
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

  const W = 680
  const H = 260
  const { vals, costs, dates, bmVals, hasBenchmark, portIndexed, latest, portChg, bmChg, trimFrom, fullRangeStart, fullRangeEnd, firstValueDate, skippedEnd } = chartData
  const compareMode = hasBenchmark
  const rangeLabel = CHART_RANGES.find((r) => r.id === chartRange)?.label ?? chartRange
  const pointCount = dates.length

  const ySeries = compareMode
    ? [...portIndexed, ...bmVals.filter((v) => v != null)]
    : [...vals, ...costs].filter((v) => v > 0)

  const { min, max } = computeYScale(ySeries, compareMode)
  const range = max - min || 1

  const pad = {
    t: 18,
    r: 16,
    b: 32,
    l: compareMode ? 46 : 54,
  }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const xAt = (i) => pad.l + (i / Math.max(vals.length - 1, 1)) * innerW
  const yAt = (v) => pad.t + innerH - ((Number(v) - min) / range) * innerH

  const fmtY = (v) => {
    if (hideValues) return '••'
    if (compareMode) return Number(v).toFixed(1)
    return fmtChartAxis(v, sym, { hideValues })
  }

  const yTicks = (() => {
    const mid = min + range / 2
    const ticks = compareMode
      ? [min, min + range * 0.25, min + range * 0.5, min + range * 0.75, max]
      : [min, mid, max]
    const uniq = [...new Set(ticks.map((t) => Number(t.toFixed(4))))]
    return uniq.sort((a, b) => a - b)
  })()

  const dateTicks = pickDateTicks(dates, 4)
  const baseline100 = compareMode && min <= 100 && max >= 100 ? 100 : null

  const daySpan =
    dates.length >= 2
      ? Math.round((new Date(dates[dates.length - 1]) - new Date(dates[0])) / 86400000)
      : 0
  const shortHistory = daySpan < 7

  const toPts = (arr) =>
    arr
      .map((v, i) => {
        if (v == null || (compareMode ? false : v <= 0 && i > 0)) return null
        const x = vals.length < 2 ? pad.l + innerW / 2 : xAt(i)
        const y = yAt(v)
        if (!Number.isFinite(y)) return null
        return `${x},${y}`
      })
      .filter(Boolean)
      .join(' ')

  const portLine = compareMode ? portIndexed : vals
  const portPts = toPts(portLine)
  const costPts = compareMode ? '' : toPts(costs)
  const bmPts = compareMode ? toPts(bmVals) : ''

  const portAreaPath = (() => {
    if (!portPts || compareMode) return ''
    const pts = portPts.split(' ').map((p) => p.split(',').map(Number))
    if (pts.length < 2) return ''
    const last = pts[pts.length - 1]
    const first = pts[0]
    const baseY = pad.t + innerH
    return `M${first[0]},${baseY} ${portPts} L${last[0]},${baseY} Z`
  })()

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
              : compareMode
                ? `${portChg >= 0 ? '+' : ''}${portChg.toFixed(2)}%`
                : `${sym}${latest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="dash-chart-stat-chg" style={{ color: portChg >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
            {compareMode
              ? (hideValues ? 'ในช่วงที่เลือก' : `มูลค่าล่าสุด ${sym}${latest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
              : `${portChg >= 0 ? '+' : ''}${portChg.toFixed(2)}%`}
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

      {!loading && (
        <p className="dash-chart-period">
          <span>ช่วงที่เลือก: <strong>{rangeLabel}</strong></span>
          <span> · กราฟ {fmtDate(dates[0])} → {fmtDate(dates[dates.length - 1])} ({pointCount} จุด)</span>
          {firstTxDate && (
            <span> · Transaction แรก: {fmtDate(firstTxDate)}</span>
          )}
          {trimFrom > 0 && firstValueDate && skippedEnd && (
            <span> · ข้ามช่วงไม่มีมูลค่า {fmtDate(fullRangeStart)}–{fmtDate(skippedEnd)}</span>
          )}
        </p>
      )}

      {shortHistory && !loading && (
        <p className="dash-chart-hint">
          พอร์ตมีข้อมูล {dates.length} วันในช่วงนี้ (เริ่ม {fmtDate(dates[0])})
          {compareMode && ' — ลองปิด Benchmark หรือเลือกช่วง All เพื่อดูมูลค่าเต็ม'}
        </p>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart-svg" preserveAspectRatio="xMinYMid meet" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-port)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-port)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((v) => (
          <g key={v}>
            <line
              x1={pad.l}
              y1={yAt(v)}
              x2={W - pad.r}
              y2={yAt(v)}
              className="dash-chart-grid-line"
            />
            <text x={pad.l - 6} y={yAt(v) + 4} textAnchor="end" className="dash-chart-tick">
              {fmtY(v)}
            </text>
          </g>
        ))}

        {baseline100 != null && (
          <line
            x1={pad.l}
            y1={yAt(baseline100)}
            x2={W - pad.r}
            y2={yAt(baseline100)}
            className="dash-chart-baseline"
          />
        )}

        {portAreaPath && <path d={portAreaPath} fill={`url(#${gradId})`} />}

        {!compareMode && costPts && (
          <polyline points={costPts} fill="none" stroke="var(--chart-cost)" strokeWidth="1.5" strokeDasharray="4,4" strokeLinejoin="round" />
        )}
        {portPts && (
          <polyline points={portPts} fill="none" stroke="var(--chart-port)" strokeWidth="2.5" strokeLinejoin="round" />
        )}
        {compareMode && bmPts && (
          <polyline points={bmPts} fill="none" stroke="var(--chart-benchmark)" strokeWidth="2" strokeDasharray="6,4" strokeLinejoin="round" />
        )}

        {dateTicks.map(({ d, i }) => (
          <text
            key={`${d}-${i}`}
            x={xAt(i)}
            y={H - 8}
            textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
            className="dash-chart-tick"
          >
            {fmtDate(d)}
          </text>
        ))}
      </svg>

      <div className="dash-chart-foot">
        <span className="dash-chart-foot-note">
          {compareMode ? 'แกน Y = ดัชนี (ฐาน 100 ที่จุดเริ่มช่วง)' : 'แกน Y = มูลค่า'}
        </span>
        <span className="dash-chart-legend">
          <span><span className="dash-chart-legend-line" style={{ background: 'var(--chart-port)' }} /> {compareMode ? 'พอร์ต (indexed)' : 'มูลค่า'}</span>
          {!compareMode && <span><span className="dash-chart-legend-line dash-chart-legend-line--dashed" style={{ background: 'var(--chart-cost)' }} /> ทุน</span>}
          {compareMode && benchmark?.label && (
            <span><span className="dash-chart-legend-line dash-chart-legend-line--dashed" style={{ background: 'var(--chart-benchmark)' }} /> {benchmark.label}</span>
          )}
        </span>
      </div>
    </div>
  )
}
