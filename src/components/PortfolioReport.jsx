import { MASKED, fmtPct, fmtDate } from '../lib/format'
import { symFor } from '../lib/constants'
import { usePrivacy } from '../lib/privacy'
import { computePortfolioPnL, sumDividends, computeTotalReturn } from '../lib/pnl'

const SECTOR_COLORS = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#55efc4', '#a29bfe']

function CcyChip({ ccy = 'USD' }) {
  const c = ccy || 'USD'
  const tone = c === 'USD' ? 'usd' : c === 'THB' ? 'thb' : 'other'
  return <span className={`dash-currency-chip dash-currency-chip--${tone}`}>{symFor(c)} {c}</span>
}

function pnlTone(n) {
  return n >= 0 ? 'gain' : 'loss'
}

function kpiToneClass(tone) {
  if (tone === 'accent') return 'dash-report-kpi-value--accent'
  if (tone === 'gain') return 'dash-report-kpi-value--gain'
  if (tone === 'loss') return 'dash-report-kpi-value--loss'
  return ''
}

export default function PortfolioReport({
  user,
  activePort,
  portfolios,
  holdings,
  transactions,
  dividends = [],
  prices,
  displayCurrency,
  fxRate,
  loadingP,
  fmt,
  getVal,
  getCost,
  convertToDisplay,
  totVal,
  totCost,
}) {
  const { hideValues } = usePrivacy()
  const fmtMoney = (n) => (hideValues ? MASKED : fmt(n))

  const reportDate = new Date().toLocaleString('th-TH', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const allocation = [...holdings]
    .map((h) => {
      const val = getVal(h)
      const cost = getCost(h)
      const pnl = val - cost
      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0
      const weight = totVal > 0 ? (val / totVal) * 100 : 0
      const dayChg = prices[`${h.ticker}_chg`] ?? 0
      return { ...h, val, cost, pnl, pnlPct, weight, dayChg }
    })
    .sort((a, b) => b.val - a.val)

  const sectors = {}
  holdings.forEach((h) => {
    const s = h.sector || 'Other'
    sectors[s] = (sectors[s] || 0) + getVal(h)
  })
  const sectorRows = Object.entries(sectors)
    .map(([name, value]) => ({
      name,
      value,
      pct: totVal > 0 ? (value / totVal) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)

  const currencies = {}
  holdings.forEach((h) => {
    const c = h.currency || 'USD'
    currencies[c] = (currencies[c] || 0) + getVal(h)
  })
  const currencyRows = Object.entries(currencies)
    .map(([ccy, value]) => ({
      ccy,
      value,
      pct: totVal > 0 ? (value / totVal) * 100 : 0,
    }))
    .sort((a, b) => b.value - a.value)

  const weightedDayChg = totVal > 0
    ? allocation.reduce((s, h) => s + h.dayChg * (h.val / totVal), 0)
    : 0

  const { total: totalPnL } = computePortfolioPnL({
    transactions,
    holdings,
    prices,
    convert: convertToDisplay,
  })
  const dividendAll = sumDividends(dividends, convertToDisplay)
  const { totalReturn, hasDividends } = computeTotalReturn(totalPnL, dividendAll)
  const displayPnL = hasDividends ? totalReturn : totalPnL
  const totalPct = totCost > 0 ? (displayPnL / totCost) * 100 : 0

  const topGainers = [...allocation].filter((h) => h.pnl > 0).sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 3)
  const topLosers = [...allocation].filter((h) => h.pnl < 0).sort((a, b) => a.pnlPct - b.pnlPct).slice(0, 3)

  const recentTx = [...transactions].slice(0, 10)

  const allPortfolios = portfolios.map((p) => ({
    id: p.id,
    name: p.name,
    holdings: Number(p.holding_count || 0),
    invested: p.invested_thb != null || p.invested_usd != null
      ? convertToDisplay(Number(p.invested_usd || 0), 'USD') + convertToDisplay(Number(p.invested_thb || 0), 'THB')
      : convertToDisplay(Number(p.total_invested || 0), p.currency || 'USD'),
    isActive: Number(p.id) === Number(activePort?.id),
  }))

  if (!holdings.length) {
    return (
      <div className="dash-report-empty">
        <p style={{ fontSize: '36px', marginBottom: '12px' }}>📋</p>
        <p className="dash-text-muted" style={{ fontSize: '14px' }}>ยังไม่มีข้อมูลพอร์ต — บันทึก transaction เพื่อสร้างรายงาน</p>
      </div>
    )
  }

  const kpis = [
    ['มูลค่าพอร์ตปัจจุบัน', hideValues ? MASKED : fmt(totVal), ''],
    ['เงินลงทุน (ทุน)', hideValues ? MASKED : fmt(totCost), 'accent'],
    [
      hasDividends ? 'ผลตอบแทนรวม' : 'กำไร/ขาดทุน',
      hideValues ? fmtPct(totalPct) : `${fmt(displayPnL)} (${fmtPct(totalPct)})`,
      pnlTone(displayPnL),
    ],
    ['% เปลี่ยนแปลงวันนี้', fmtPct(weightedDayChg), pnlTone(weightedDayChg)],
  ]

  return (
    <div className="dash-report">
      <div className="dash-report-toolbar report-no-print">
        <p className="dash-text-muted" style={{ fontSize: '13px', flex: 1 }}>
          สรุปภาพรวมการลงทุน · อัปเดต {reportDate}
        </p>
        <button type="button" className="dash-report-print-btn" onClick={() => window.print()}>
          🖨️ พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="dash-report-header">
        <div>
          <p className="dash-report-eyebrow">Port Diary — Portfolio Report</p>
          <h2 className="dash-report-title">{activePort?.name || 'พอร์ต'}</h2>
          <p className="dash-report-meta">
            {user?.name} · สกุลเงินแสดงผล: {displayCurrency}
            {!loadingP && !hideValues && ` · FX $1 = ฿${Number(fxRate).toFixed(2)}`}
          </p>
        </div>
        <div className="dash-report-asof">{reportDate}</div>
      </div>

      <div className="dash-report-kpis">
        {kpis.map(([label, val, tone]) => (
          <div key={label} className="dash-report-kpi">
            <div className="dash-report-kpi-label">{label}</div>
            <div className={`dash-report-kpi-value ${kpiToneClass(tone)}`}>{val}</div>
          </div>
        ))}
      </div>

      <div className="dash-report-allocation-strip">
        {allocation.map((h, i) => (
          <div
            key={h.id}
            className="dash-report-allocation-seg"
            style={{
              width: `${Math.max(h.weight, 0.5)}%`,
              background: SECTOR_COLORS[i % SECTOR_COLORS.length],
            }}
            title={`${h.ticker} ${h.weight.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="dash-report-allocation-legend report-no-print">
        {allocation.slice(0, 8).map((h, i) => (
          <span key={h.id} className="dash-report-legend-item">
            <span className="dash-report-legend-dot" style={{ background: SECTOR_COLORS[i % SECTOR_COLORS.length] }} />
            {h.ticker} {h.weight.toFixed(1)}%
          </span>
        ))}
        {allocation.length > 8 && <span className="dash-report-muted">+{allocation.length - 8} อื่นๆ</span>}
      </div>

      <div className="dash-report-grid">
        <section className="dash-report-card dash-report-card--wide">
          <h3>สัดส่วนการลงทุน (Holdings)</h3>
          <div className="dash-report-table-wrap">
            <table className="dash-report-table">
              <thead>
                <tr>
                  {['Ticker', 'ชื่อ', 'น้ำหนัก', 'มูลค่า', 'ทุน', 'กำไร/ขาดทุน', '%', 'วันนี้', 'Sector'].map((h) => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {allocation.map((h) => (
                  <tr key={h.id}>
                    <td className="dash-report-ticker">{h.ticker}</td>
                    <td className="dash-report-muted">{h.name || '—'}</td>
                    <td>{h.weight.toFixed(1)}%</td>
                    <td>{fmtMoney(h.val)}</td>
                    <td className="dash-report-muted">{fmtMoney(h.cost)}</td>
                    <td className={`dash-text-${pnlTone(h.pnl)}`}>
                      {hideValues ? fmtPct(h.pnlPct) : fmtMoney(h.pnl)}
                    </td>
                    <td className={`dash-text-${pnlTone(h.pnl)}`}>{fmtPct(h.pnlPct)}</td>
                    <td className={`dash-text-${pnlTone(h.dayChg)}`}>{fmtPct(h.dayChg)}</td>
                    <td className="dash-report-muted">{h.sector || 'Other'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="dash-report-card">
          <h3>สัดส่วน Sector</h3>
          <ul className="dash-report-bars">
            {sectorRows.map((s, i) => (
              <li key={s.name}>
                <div className="dash-report-bar-head">
                  <span>{s.name}</span>
                  <span>
                    {s.pct.toFixed(1)}%
                    {!hideValues && ` · ${fmtMoney(s.value)}`}
                  </span>
                </div>
                <div className="dash-report-bar-track">
                  <div
                    className="dash-report-bar-fill"
                    style={{ width: `${s.pct}%`, background: SECTOR_COLORS[i % SECTOR_COLORS.length] }}
                  />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-report-card">
          <h3>สกุลเงินในพอร์ต</h3>
          <ul className="dash-report-bars">
            {currencyRows.map((c) => (
              <li key={c.ccy}>
                <div className="dash-report-bar-head">
                  <span>{c.ccy}</span>
                  <span>
                    {c.pct.toFixed(1)}%
                    {!hideValues && ` · ${fmtMoney(c.value)}`}
                  </span>
                </div>
                <div className="dash-report-bar-track">
                  <div className="dash-report-bar-fill" style={{ width: `${c.pct}%`, background: c.ccy === 'THB' ? '#55efc4' : '#74b9ff' }} />
                </div>
              </li>
            ))}
          </ul>
        </section>

        <section className="dash-report-card">
          <h3>Top กำไร / ขาดทุน</h3>
          {topGainers.length > 0 && (
            <>
              <p className="dash-report-subhead">กำไรสูงสุด</p>
              <ul className="dash-report-mini-list">
                {topGainers.map((h) => (
                  <li key={h.id}>
                    <span>{h.ticker}</span>
                    <span className="dash-text-gain">{fmtPct(h.pnlPct)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {topLosers.length > 0 && (
            <>
              <p className="dash-report-subhead">ขาดทุนมากสุด</p>
              <ul className="dash-report-mini-list">
                {topLosers.map((h) => (
                  <li key={h.id}>
                    <span>{h.ticker}</span>
                    <span className="dash-text-loss">{fmtPct(h.pnlPct)}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          {!topGainers.length && !topLosers.length && (
            <p className="dash-report-muted">ยังไม่มีกำไร/ขาดทุนที่ชัดเจน</p>
          )}
        </section>

        {portfolios.length > 1 && (
          <section className="dash-report-card">
            <h3>ทุกพอร์ต (ภาพรวม)</h3>
            <ul className="dash-report-mini-list">
              {allPortfolios.map((p) => (
                <li key={p.id}>
                  <span>{p.name}{p.isActive ? ' ★' : ''}</span>
                  <span className="dash-report-muted">
                    {p.holdings} หลัก
                    {!hideValues && ` · ${fmtMoney(p.invested)}`}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        )}

        {recentTx.length > 0 && (
          <section className="dash-report-card dash-report-card--wide">
            <h3>กิจกรรมล่าสุด (Transactions)</h3>
            <div className="dash-report-table-wrap">
              <table className="dash-report-table">
                <thead>
                  <tr>
                    {['วันที่', 'Ticker', 'ประเภท', 'สกุลเงิน', 'Shares', 'ราคา', 'มูลค่า', 'ค่าธรรมเนียม', 'หมายเหตุ'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map((t) => (
                    <tr key={t.id}>
                      <td className="dash-report-muted">{fmtDate(t.date)}</td>
                      <td className="dash-report-ticker">{t.ticker}</td>
                      <td className={t.type === 'BUY' ? 'dash-text-gain' : 'dash-text-loss'}>{t.type}</td>
                      <td><CcyChip ccy={t.currency} /></td>
                      <td>{Number(t.shares).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                      <td>
                        {hideValues
                          ? MASKED
                          : `${symFor(t.currency || 'USD')}${Number(t.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td>
                        {hideValues
                          ? MASKED
                          : `${symFor(t.currency || 'USD')}${Number(t.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}`}
                      </td>
                      <td className="dash-report-muted">
                        {hideValues
                          ? MASKED
                          : Number(t.fee) > 0
                            ? `${symFor(t.currency || 'USD')}${Number(t.fee).toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                            : '—'}
                      </td>
                      <td className="dash-report-muted">{t.note || '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <p className="dash-report-disclaimer">
        ⚠️ รายงานนี้เพื่อการบันทึกและศึกษาส่วนตัว ไม่ใช่คำแนะนำการลงทุน · ราคาและมูลค่าอ้างอิงจาก Yahoo Finance
      </p>
    </div>
  )
}
