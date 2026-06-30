import { useMemo, useId } from 'react'
import { symFor, CHART_RANGES, BENCHMARK_TOGGLES } from '../../lib/constants'
import { fmtPct, fmtDate, fmtChartAxis } from '../../lib/format'
import { usePrivacy } from '../../lib/privacy'
import { convertAmount } from '../../lib/currency'

function dateKey(d) {
  return d?.split?.('T')?.[0] || d
}

function leadingZeroEnd(values) {
  const idx = values.findIndex((v) => v > 0)
  return idx < 0 ? 0 : idx
}

/** % change from first point in the trimmed series */
function periodReturnSeries(values, baselineIdx = 0) {
  const base = values[baselineIdx] > 0 ? values[baselineIdx] : (values.find((v) => v > 0) || values[0] || 1)
  return values.map((v, i) => {
    if (i < baselineIdx) return 0
    return base > 0 ? ((v / base) - 1) * 100 : 0
  })
}

/** indexed (base 100) → % change from period start */
function benchmarkColor(bm) {
  if (bm?.id) return BENCHMARK_TOGGLES.find((t) => t.id === bm.id)?.color || 'var(--chart-benchmark)'
  const sym = bm?.symbol || ''
  if (sym.includes('SET')) return 'var(--chart-set)'
  return 'var(--chart-benchmark)'
}

function computeYScale(series, compareMode) {
  const finite = series.filter((v) => Number.isFinite(v) && (compareMode ? true : v > 0))
  if (!finite.length) return { min: 0, max: 1 }

  const dataMin = Math.min(...finite)
  const dataMax = Math.max(...finite)
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

function alignBenchmarkSeries(dates, benchmark) {
  const bmMap = Object.fromEntries(
    (benchmark?.series || []).map((p) => [dateKey(p.date), Number(p.indexed)])
  )
  let lastBm = null
  const vals = dates.map((d) => {
    if (bmMap[d] != null) lastBm = bmMap[d]
    return lastBm
  })

  // Backfill leading nulls so benchmark starts on same first visible date as portfolio.
  const firstFinite = vals.find((v) => Number.isFinite(v))
  if (!Number.isFinite(firstFinite)) return vals
  return vals.map((v) => (Number.isFinite(v) ? v : firstFinite))
}

function rebaseIndexedSeries(indexedVals, baselineIdx = 0) {
  const baseCandidate = indexedVals[baselineIdx]
  const base = Number.isFinite(baseCandidate) && baseCandidate > 0
    ? baseCandidate
    : indexedVals.find((v) => Number.isFinite(v) && v > 0)
  if (!(base > 0)) return indexedVals.map(() => null)
  return indexedVals.map((v, i) => {
    if (i < baselineIdx) return 0
    return Number.isFinite(v) ? ((v / base) - 1) * 100 : null
  })
}

function compareBaselineIndex(vals, costs) {
  if (!vals.length) return 0
  const latestVal = vals[vals.length - 1] || 0
  const latestCost = costs[costs.length - 1] || 0
  const minVal = Math.max(1, latestVal * 0.05)
  const minCost = Math.max(1, latestCost * 0.05)
  const idx = vals.findIndex((v, i) => v >= minVal || (costs[i] || 0) >= minCost)
  if (idx >= 0) return idx
  return vals.findIndex((v) => v > 0)
}

export default function PortfolioChart({
  history,
  portfolioName,
  portfolioCurrency = 'USD',
  benchmark = [],
  benchmarkToggles = {},
  onBenchmarkToggle,
  displayCurrency,
  fxRate = 1,
  chartRange,
  onChartRangeChange,
  loading,
  firstTxDate,
}) {
  const { hideValues } = usePrivacy()
  const gradId = useId().replace(/:/g, '')
  const sym = symFor(displayCurrency === 'THB' ? 'THB' : 'USD')
  const benchmarks = Array.isArray(benchmark) ? benchmark : benchmark ? [benchmark] : []
  const anyToggleOn = Object.values(benchmarkToggles).some(Boolean)

  const chartData = useMemo(() => {
    if (!history?.length) return null

    const convert = (n) => convertAmount(n, portfolioCurrency, displayCurrency, fxRate)
    const allVals = history.map((d) => convert(d.total_value))
    const allCosts = history.map((d) => convert(d.total_cost || 0))
    const allDates = history.map((d) => dateKey(d.date))
    const allPerf = history.map((d) => (d.performance_pct != null ? Number(d.performance_pct) : null))
    const hasPerf = allPerf.some((v) => v != null)

    const trimFrom = leadingZeroEnd(allVals)
    const vals = allVals.slice(trimFrom)
    const costs = allCosts.slice(trimFrom)
    const dates = allDates.slice(trimFrom)
    const perf = hasPerf ? allPerf.slice(trimFrom) : null

    const baselineIdx = Math.max(0, compareBaselineIndex(vals, costs))
    const naiveReturn = periodReturnSeries(vals, baselineIdx)
    const perfSlice = hasPerf ? allPerf.slice(trimFrom) : null
    const portReturn = perfSlice
      ? (() => {
          const base = perfSlice[0] ?? 0
          return perfSlice.map((v) => (v != null ? v - base : 0))
        })()
      : naiveReturn
    const latest = vals[vals.length - 1] ?? 0
    const firstPositive = vals[baselineIdx] > 0 ? vals[baselineIdx] : (vals.find((v) => v > 0) ?? vals[0] ?? 0)
    const naiveChg = firstPositive > 0 ? ((latest - firstPositive) / firstPositive) * 100 : 0
    const portChg = perfSlice
      ? (portReturn[portReturn.length - 1] ?? 0)
      : naiveChg

    const benchmarkLines = benchmarks.map((bm) => {
      const indexedVals = alignBenchmarkSeries(dates, bm)
      const bmVals = rebaseIndexedSeries(indexedVals, baselineIdx)
      const last = [...bmVals].reverse().find((v) => Number.isFinite(v)) ?? 0
      return {
        ...bm,
        vals: bmVals,
        color: benchmarkColor(bm),
        changePct: last,
      }
    })
    const comparePortChg = portReturn[portReturn.length - 1] ?? 0

    return {
      vals,
      costs,
      dates,
      portReturn,
      benchmarkLines,
      latest,
      portChg,
      comparePortChg,
      trimFrom,
      fullRangeStart: allDates[0],
      fullRangeEnd: allDates[allDates.length - 1],
      firstValueDate: dates[0] ?? null,
      skippedEnd: trimFrom > 0 ? allDates[trimFrom - 1] : null,
      usesTwr: !!perfSlice,
    }
  }, [history, benchmarks, displayCurrency, fxRate, portfolioCurrency])

  if (!history?.length) {
    return (
      <div className="dash-chart-card dash-chart-card--empty">
        📈 บันทึก Transaction เพื่อดูกราฟมูลค่าพอร์ต
      </div>
    )
  }

  if (!chartData) return null

  const W = 980
  const H = 300
  const {
    vals,
    costs,
    dates,
    portReturn,
    benchmarkLines,
    latest,
    portChg,
    comparePortChg,
    trimFrom,
    fullRangeStart,
    fullRangeEnd,
    firstValueDate,
    skippedEnd,
    usesTwr,
  } = chartData

  const compareMode = anyToggleOn
  const rangeLabel = CHART_RANGES.find((r) => r.id === chartRange)?.label ?? chartRange
  const pointCount = dates.length
  const currencyLabel = displayCurrency === 'THB' ? 'THB (฿)' : 'USD ($)'

  const ySeries = compareMode
    ? [
        ...portReturn,
        ...benchmarkLines.flatMap((bm) => bm.vals.filter((v) => v != null)),
      ]
    : [...vals, ...costs].filter((v) => v > 0)

  const { min, max } = computeYScale(ySeries, compareMode)
  const range = max - min || 1

  const pad = {
    t: 22,
    r: 16,
    b: 32,
    l: compareMode ? 52 : 58,
  }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const xAt = (i) => pad.l + (i / Math.max(vals.length - 1, 1)) * innerW
  const yAt = (v) => pad.t + innerH - ((Number(v) - min) / range) * innerH

  const fmtY = (v) => {
    if (hideValues) return '••'
    if (compareMode) {
      const n = Number(v)
      return `${n.toFixed(Math.abs(n) >= 100 ? 0 : 1)}%`
    }
    return fmtChartAxis(v, sym, { hideValues })
  }

  const yTicks = (() => {
    const tickCount = compareMode ? 4 : 3
    const ticks = Array.from({ length: tickCount }, (_, i) => min + (range * i) / (tickCount - 1))
    const uniq = [...new Set(ticks.map((t) => Number(t.toFixed(4))))]
    return uniq.sort((a, b) => a - b)
  })()

  const dateTicks = pickDateTicks(dates, 4)
  const baseline0 = compareMode && min <= 0 && max >= 0 ? 0 : null

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

  const portLine = compareMode ? portReturn : vals
  const portPts = toPts(portLine)
  const costPts = compareMode ? '' : toPts(costs)

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
              ? usesTwr
                ? 'กราฟ % ผลตอบแทนจากราคาหุ้น (ไม่นับเงินซื้อเพิ่ม) — เทียบกับดัชนี'
                : 'กราฟ % การเปลี่ยนแปลงจากต้นช่วงที่เลือก (0% = จุดเริ่ม) — ไม่ใช่กำไรรวมจากทุน'
              : `กราฟมูลค่าพอร์ต (${currencyLabel}) = ราคา × จำนวนหุ้น${portfolioName ? ` · ${portfolioName}` : ''}`}
          </p>
        </div>
        <div className="dash-chart-stats">
          <div className="dash-chart-stat-value">
            {hideValues
              ? fmtPct(portChg)
              : compareMode
                ? `${comparePortChg >= 0 ? '+' : ''}${comparePortChg.toFixed(2)}%`
                : `${sym}${latest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
          </div>
          <div className="dash-chart-stat-chg" style={{ color: portChg >= 0 ? 'var(--gain)' : 'var(--loss)' }}>
            {compareMode
              ? (hideValues
                  ? 'ในช่วงที่เลือก'
                  : `มูลค่าล่าสุด ${sym}${latest.toLocaleString('en-US', { minimumFractionDigits: 2 })}`)
              : `${portChg >= 0 ? '+' : ''}${portChg.toFixed(2)}%`}
            {!compareMode && usesTwr && (
              <span className="dash-text-muted" style={{ marginLeft: '6px', fontSize: '11px' }}>
                ผลตอบแทนจากราคา
              </span>
            )}
            {compareMode && benchmarkLines.length > 0 && (
              <span className="dash-text-muted" style={{ marginLeft: '8px' }}>
                {benchmarkLines.map((bm, i) => (
                  <span key={bm.symbol || i}>
                    {i > 0 ? ' · ' : 'vs '}
                    {bm.label} {bm.changePct >= 0 ? '+' : ''}{bm.changePct.toFixed(2)}%
                  </span>
                ))}
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
          <span className="dash-chart-toolbar-label">เทียบกับ</span>
          {BENCHMARK_TOGGLES.map((b) => (
            <label key={b.id} className="dash-chart-check" style={{ color: benchmarkToggles[b.id] ? b.color : undefined }}>
              <input
                type="checkbox"
                checked={!!benchmarkToggles[b.id]}
                onChange={() => onBenchmarkToggle?.(b.id)}
                disabled={loading}
              />
              <span className="dash-chart-check-mark" style={{ borderColor: b.color }} />
              <span>{b.label}</span>
            </label>
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
          {compareMode && ' — ลองปิด benchmark หรือเลือกช่วง All เพื่อดูมูลค่าเต็ม'}
        </p>
      )}

      <svg viewBox={`0 0 ${W} ${H}`} className="dash-chart-svg" preserveAspectRatio="xMinYMid meet" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-port)" stopOpacity="0.28" />
            <stop offset="100%" stopColor="var(--chart-port)" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        <text
          x={12}
          y={pad.t + innerH / 2}
          transform={`rotate(-90 12 ${pad.t + innerH / 2})`}
          textAnchor="middle"
          className="dash-chart-axis-label"
        >
          {compareMode ? '% เปลี่ยนแปลง' : `มูลค่า (${currencyLabel})`}
        </text>

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

        {baseline0 != null && (
          <line
            x1={pad.l}
            y1={yAt(baseline0)}
            x2={W - pad.r}
            y2={yAt(baseline0)}
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
        {compareMode &&
          benchmarkLines.map((bm) => {
            const pts = toPts(bm.vals)
            if (!pts) return null
            return (
              <polyline
                key={bm.symbol}
                points={pts}
                fill="none"
                stroke={bm.color}
                strokeWidth="2"
                strokeDasharray="6,4"
                strokeLinejoin="round"
              />
            )
          })}

        <text x={pad.l + innerW / 2} y={H - 2} textAnchor="middle" className="dash-chart-axis-label">
          วันที่
        </text>

        {dateTicks.map(({ d, i }) => (
          <text
            key={`${d}-${i}`}
            x={xAt(i)}
            y={H - 14}
            textAnchor={i === 0 ? 'start' : i === dates.length - 1 ? 'end' : 'middle'}
            className="dash-chart-tick"
          >
            {fmtDate(d)}
          </text>
        ))}
      </svg>

      <div className="dash-chart-foot">
        <span className="dash-chart-foot-note">
          {compareMode
            ? 'แกน Y = % เปลี่ยนแปลงจากจุดเริ่มช่วง (0% = ไม่เปลี่ยน) · แกน X = วันที่'
            : `แกน Y = มูลค่าพอร์ต (${currencyLabel}) · แกน X = วันที่`}
        </span>
        <span className="dash-chart-legend">
          <span>
            <span className="dash-chart-legend-line" style={{ background: 'var(--chart-port)' }} />
            {compareMode ? 'พอร์ต' : 'มูลค่า'}
          </span>
          {!compareMode && (
            <span>
              <span className="dash-chart-legend-line dash-chart-legend-line--dashed" style={{ background: 'var(--chart-cost)' }} />
              ทุน
            </span>
          )}
          {compareMode &&
            benchmarkLines.map((bm) => (
              <span key={bm.symbol}>
                <span
                  className="dash-chart-legend-line dash-chart-legend-line--dashed"
                  style={{ background: bm.color }}
                />
                {bm.label}
              </span>
            ))}
        </span>
      </div>
    </div>
  )
}
