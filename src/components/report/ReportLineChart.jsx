import { useMemo, useId } from 'react'
import { symFor } from '../../lib/constants'
import { fmtPct, fmtDate, fmtChartAxis } from '../../lib/format'
import { usePrivacy } from '../../lib/privacy'

function dateKey(d) {
  return d?.split?.('T')?.[0] || d
}

function leadingZeroEnd(values) {
  const idx = values.findIndex((v) => v > 0)
  return idx < 0 ? 0 : idx
}

function periodReturnSeries(values, baselineIdx = 0) {
  const base = values[baselineIdx] > 0 ? values[baselineIdx] : (values.find((v) => v > 0) || values[0] || 1)
  return values.map((v, i) => {
    if (i < baselineIdx) return 0
    return base > 0 ? ((v / base) - 1) * 100 : 0
  })
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

function compareBaselineIndex(vals) {
  if (!vals.length) return 0
  const latest = vals[vals.length - 1] || 0
  const minVal = Math.max(1, latest * 0.05)
  const idx = vals.findIndex((v) => v >= minVal)
  return idx >= 0 ? idx : vals.findIndex((v) => v > 0)
}

export default function ReportLineChart({
  history,
  benchmark = null,
  compareSp500 = false,
  onCompareSp500Change,
  displayCurrency = 'USD',
  hideValues: hideValuesProp,
}) {
  const { hideValues: hidePrivacy } = usePrivacy()
  const hideValues = hideValuesProp ?? hidePrivacy
  const gradId = useId().replace(/:/g, '')
  const sym = symFor(displayCurrency === 'THB' ? 'THB' : 'USD')
  const currencyLabel = displayCurrency === 'THB' ? 'THB (฿)' : 'USD ($)'

  const chartData = useMemo(() => {
    if (!history?.length) return null

    const allVals = history.map((d) => Number(d.total_value))
    const allCosts = history.map((d) => Number(d.total_cost || 0))
    const allDates = history.map((d) => dateKey(d.date))

    const allPerf = history.map((d) => (d.performance_pct != null ? Number(d.performance_pct) : null))
    const hasPerf = allPerf.some((v) => v != null)

    const trimFrom = leadingZeroEnd(allVals)
    const vals = allVals.slice(trimFrom)
    const costs = allCosts.slice(trimFrom)
    const dates = allDates.slice(trimFrom)
    if (!vals.length) return null

    const baselineIdx = Math.max(0, compareBaselineIndex(vals))
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
    const portChg = perfSlice ? (portReturn[portReturn.length - 1] ?? 0) : naiveChg

    let bmReturn = null
    let bmChg = 0
    if (compareSp500 && benchmark?.series?.length) {
      const indexed = alignBenchmarkSeries(dates, benchmark)
      bmReturn = rebaseIndexedSeries(indexed, compareSp500 ? 0 : baselineIdx)
      const last = [...bmReturn].reverse().find((v) => Number.isFinite(v)) ?? 0
      bmChg = last
    }

    return { vals, costs, dates, portReturn, bmReturn, latest, portChg, bmChg, baselineIdx, usesTwr: !!perfSlice }
  }, [history, benchmark, compareSp500])

  if (!history?.length) {
    return <p className="dash-report-muted" style={{ fontSize: '13px' }}>ไม่มีประวัติมูลค่าพอร์ต</p>
  }

  if (!chartData) return null

  const { vals, costs, dates, portReturn, bmReturn, latest, portChg, bmChg, usesTwr } = chartData
  const compareMode = compareSp500 && bmReturn != null

  const W = 720
  const H = 260
  const pad = { t: 24, r: 20, b: 40, l: compareMode ? 52 : 62 }
  const innerW = W - pad.l - pad.r
  const innerH = H - pad.t - pad.b

  const ySeries = compareMode
    ? [...portReturn, ...bmReturn.filter((v) => v != null)]
    : [...vals, ...costs].filter((v) => v > 0)
  const { min, max } = computeYScale(ySeries, compareMode)
  const range = max - min || 1

  const xAt = (i) => pad.l + (i / Math.max(vals.length - 1, 1)) * innerW
  const yAt = (v) => pad.t + innerH - ((Number(v) - min) / range) * innerH

  const fmtY = (v) => {
    if (hideValues) return '••'
    if (compareMode) return `${Number(v).toFixed(1)}%`
    return fmtChartAxis(v, sym, { hideValues })
  }

  const yTicks = (() => {
    const tickCount = compareMode ? 4 : 3
    const ticks = Array.from({ length: tickCount }, (_, i) => min + (range * i) / (tickCount - 1))
    return [...new Set(ticks.map((t) => Number(t.toFixed(4))))].sort((a, b) => a - b)
  })()

  const toPts = (arr) =>
    arr
      .map((v, i) => {
        if (v == null || (compareMode ? false : v <= 0)) return null
        const y = yAt(v)
        if (!Number.isFinite(y)) return null
        return `${xAt(i)},${y}`
      })
      .filter(Boolean)
      .join(' ')

  const portLine = compareMode ? portReturn : vals
  const portPts = toPts(portLine)
  const costPts = compareMode ? '' : toPts(costs)
  const bmPts = compareMode && bmReturn ? toPts(bmReturn) : ''

  const portAreaPath = (() => {
    if (!portPts || compareMode) return ''
    const pts = portPts.split(' ').map((p) => p.split(',').map(Number))
    if (pts.length < 2) return ''
    const last = pts[pts.length - 1]
    const first = pts[0]
    const baseY = pad.t + innerH
    return `M${first[0]},${baseY} ${portPts} L${last[0]},${baseY} Z`
  })()

  const dateTicks = pickDateTicks(dates, 4)

  return (
    <div className="dash-report-line-wrap">
      <div className="dash-report-line-head">
        <div>
          <p className="dash-report-chart-caption">
            {compareMode
              ? usesTwr
                ? 'กราฟ % ผลตอบแทนจากราคาหุ้น (ไม่นับเงินซื้อเพิ่ม) — เทียบกับ S&P 500'
                : 'กราฟ % การเปลี่ยนแปลงจากต้นช่วง — เทียบกับ S&P 500'
              : `มูลค่าพอร์ต (${currencyLabel}) = ราคา × จำนวนหุ้น`}
          </p>
        </div>
        <div className="dash-report-line-stats">
          <div className="dash-report-line-stat-value">
            {hideValues ? fmtPct(portChg) : compareMode ? `${portChg >= 0 ? '+' : ''}${portChg.toFixed(2)}%` : `${sym}${latest.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
          </div>
          <div className={`dash-report-line-stat-chg ${portChg >= 0 ? 'dash-text-gain' : 'dash-text-loss'}`}>
            {compareMode
              ? (hideValues ? 'ในช่วงที่เลือก' : `vs S&P 500 ${bmChg >= 0 ? '+' : ''}${bmChg.toFixed(2)}%`)
              : `${portChg >= 0 ? '+' : ''}${portChg.toFixed(2)}% ตั้งแต่ต้นช่วง`}
          </div>
        </div>
      </div>

      <div className="dash-report-line-toolbar">
        <label className="dash-report-benchmark-toggle">
          <input
            type="checkbox"
            checked={compareSp500}
            onChange={(e) => onCompareSp500Change?.(e.target.checked)}
          />
          <span>เทียบ S&P 500</span>
        </label>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="dash-report-line-svg" aria-hidden>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#6c5ce7" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#6c5ce7" stopOpacity="0.02" />
          </linearGradient>
        </defs>

        {yTicks.map((v, i) => (
          <g key={i}>
            <line x1={pad.l} y1={yAt(v)} x2={W - pad.r} y2={yAt(v)} className="dash-report-line-grid" />
            <text x={pad.l - 8} y={yAt(v) + 4} textAnchor="end" className="dash-report-line-tick">
              {fmtY(v)}
            </text>
          </g>
        ))}

        {!compareMode && portAreaPath && <path d={portAreaPath} fill={`url(#${gradId})`} />}
        {!compareMode && costPts && (
          <polyline points={costPts} fill="none" className="dash-report-line-cost" />
        )}
        {portPts && <polyline points={portPts} fill="none" className="dash-report-line-port" />}
        {bmPts && <polyline points={bmPts} fill="none" className="dash-report-line-benchmark" />}

        {dateTicks.map(({ d, i }) => (
          <text key={d} x={xAt(i)} y={H - 12} textAnchor="middle" className="dash-report-line-tick">
            {fmtDate(d)}
          </text>
        ))}

        <text x={pad.l - 8} y={pad.t - 6} textAnchor="end" className="dash-report-line-axis-label">
          {compareMode ? '%' : currencyLabel}
        </text>
      </svg>

      <div className="dash-report-line-legend">
        <span><i className="dash-report-line-swatch dash-report-line-swatch--port" /> {compareMode ? '% พอร์ต' : 'มูลค่า'}</span>
        {!compareMode && <span><i className="dash-report-line-swatch dash-report-line-swatch--cost" /> ทุน</span>}
        {compareMode && <span><i className="dash-report-line-swatch dash-report-line-swatch--benchmark" /> S&P 500</span>}
      </div>
    </div>
  )
}
