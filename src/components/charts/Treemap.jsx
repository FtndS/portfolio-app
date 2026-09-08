import { convertAmount } from '../../lib/currency'

function cellStyle(chg) {
  if (chg <= -3) {
    return { fill: 'var(--loss)', ink: '#fff', muted: 'rgba(255,255,255,0.78)' }
  }
  if (chg <= -1) {
    return {
      fill: 'color-mix(in srgb, var(--loss) 68%, var(--surface))',
      ink: '#fff',
      muted: 'rgba(255,255,255,0.78)',
    }
  }
  if (chg < 0) {
    return {
      fill: 'color-mix(in srgb, var(--loss) 20%, var(--surface))',
      ink: 'var(--text)',
      muted: 'var(--text-muted)',
    }
  }
  if (chg === 0) {
    return { fill: 'var(--surface-2)', ink: 'var(--text)', muted: 'var(--text-muted)' }
  }
  if (chg < 1) {
    return {
      fill: 'color-mix(in srgb, var(--gain) 20%, var(--surface))',
      ink: 'var(--text)',
      muted: 'var(--text-muted)',
    }
  }
  if (chg < 3) {
    return {
      fill: 'color-mix(in srgb, var(--gain) 62%, var(--surface))',
      ink: '#fff',
      muted: 'rgba(255,255,255,0.78)',
    }
  }
  return { fill: 'var(--gain)', ink: '#fff', muted: 'rgba(255,255,255,0.78)' }
}

export default function Treemap({ holdings, prices, displayCurrency, fxRate, heatmapMode = 'today' }) {
  const getVal = (h) => {
    const p = prices[h.ticker] || Number(h.avg_cost)
    const v = Number(h.shares) * p
    return convertAmount(v, h.currency || 'USD', displayCurrency, fxRate)
  }
  const getChg = (h) => {
    if (heatmapMode === 'invested') {
      const cur = prices[h.ticker] || Number(h.avg_cost)
      const cost = Number(h.avg_cost)
      return cost > 0 ? ((cur - cost) / cost) * 100 : 0
    }
    return prices[`${h.ticker}_chg`] || 0
  }
  const rawTotal = holdings.reduce((s, h) => s + getVal(h), 0)
  if (!holdings.length || rawTotal === 0) return null
  const W = 660
  const H = 260
  const MIN_PCT = 0.03
  const sorted = [...holdings].sort((a, b) => getVal(b) - getVal(a))
  const rawPcts = sorted.map((h) => getVal(h) / rawTotal)
  const needsBoost = rawPcts.map((p) => p < MIN_PCT)
  const boostTotal = needsBoost.reduce((s, b, i) => (b ? s + (MIN_PCT - rawPcts[i]) : s), 0)
  const bigCount = needsBoost.filter((b) => !b).length
  const adjPcts = rawPcts.map((p, i) => (needsBoost[i] ? MIN_PCT : p - boostTotal / bigCount))
  const items = sorted.map((h, i) => ({ ...h, adjPct: adjPcts[i], chg: getChg(h) }))

  const rects = []
  let remaining = [...items]
  let rx = 0
  let ry = 0
  let rw = W
  let rh = H
  while (remaining.length > 0) {
    const isH = rw >= rh
    const areaTotal = remaining.reduce((s, i) => s + i.adjPct, 0)
    const rowSize = isH ? rh : rw
    let best = Infinity
    let cut = 0
    let run = 0
    for (let i = 0; i < remaining.length; i++) {
      run += remaining[i].adjPct
      const len = (run / areaTotal) * (isH ? rw : rh)
      let maxR = 0
      let rt = 0
      for (let j = 0; j <= i; j++) {
        rt += remaining[j].adjPct
        const l = (remaining[j].adjPct / run) * rowSize
        const ratio = Math.max(l / len, len / l)
        if (ratio > maxR) maxR = ratio
      }
      if (maxR < best) {
        best = maxR
        cut = i + 1
      } else break
    }
    const row = remaining.slice(0, cut)
    remaining = remaining.slice(cut)
    const rowSum = row.reduce((s, i) => s + i.adjPct, 0)
    const rowLen = (rowSum / areaTotal) * (isH ? rw : rh)
    let pos = isH ? ry : rx
    row.forEach((item) => {
      const len = (item.adjPct / rowSum) * rowSize
      if (isH) {
        rects.push({ ...item, x: rx, y: pos, w: rowLen, h: len })
        pos += len
      } else {
        rects.push({ ...item, x: pos, y: ry, w: len, h: rowLen })
        pos += len
      }
    })
    if (isH) {
      rx += rowLen
      rw -= rowLen
    } else {
      ry += rowLen
      rh -= rowLen
    }
  }

  return (
    <div className="dash-heatmap">
      <p className="dash-card-sub dash-heatmap-sub">
        ขนาด = มูลค่า · สี = {heatmapMode === 'today' ? '% เปลี่ยนแปลงวันนี้' : '% จากราคาทุนเฉลี่ย'}
      </p>
      <svg className="dash-heatmap-svg" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Heatmap หุ้นในพอร์ต">
        {rects.map((r, i) => {
          const style = cellStyle(r.chg)
          return (
            <g key={i}>
              <rect
                x={r.x + 1}
                y={r.y + 1}
                width={Math.max(0, r.w - 2)}
                height={Math.max(0, r.h - 2)}
                rx={6}
                fill={style.fill}
              />
              {r.w > 35 && r.h > 22 && (
                <>
                  <text
                    x={r.x + r.w / 2}
                    y={r.y + r.h / 2 - (r.h > 50 ? 8 : 0)}
                    textAnchor="middle"
                    fontSize={Math.min(r.w / 6, r.h / 3, 15)}
                    fontWeight="600"
                    fill={style.ink}
                    fontFamily="var(--font)"
                    dominantBaseline="middle"
                  >
                    {r.ticker}
                  </text>
                  {r.h > 50 && (
                    <text
                      x={r.x + r.w / 2}
                      y={r.y + r.h / 2 + 14}
                      textAnchor="middle"
                      fontSize={11}
                      fill={style.muted}
                      fontFamily="var(--font)"
                    >
                      {r.chg >= 0 ? '+' : ''}
                      {r.chg.toFixed(2)}%
                    </text>
                  )}
                </>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
