import { useState, useEffect } from 'react'
import { api } from '../lib/api'
import { MASKED, fmtPct, fmtDate, fmtShares } from '../lib/format'
import { symFor } from '../lib/constants'
import { usePrivacy } from '../lib/privacy'
import { computePortfolioPnL, sumDividends, computeTotalReturn } from '../lib/pnl'
import {
  aggregateHoldingsByTicker,
  mergePortfolioHistoriesWithPerformance,
  normalizeHistoryResponse,
  convertHistoryToDisplay,
  portfolioNameById,
  inferPortfolioCurrency,
  extractBenchmark,
} from '../lib/reportScope'
import ReportDonut from './report/ReportDonut'
import ReportBarChart, { shouldUseBarChart } from './report/ReportBarChart'
import ReportLineChart from './report/ReportLineChart'

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
  activePortfolioId,
  portfolios,
  holdings,
  allHoldings = [],
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
  portfolioHistory = [],
}) {
  const { hideValues } = usePrivacy()
  const fmtMoney = (n) => (hideValues ? MASKED : fmt(n))
  const [scope, setScope] = useState('active')
  const [scoped, setScoped] = useState(null)
  const [loadingScope, setLoadingScope] = useState(false)
  const [compareSp500, setCompareSp500] = useState(false)

  useEffect(() => {
    let cancelled = false
    const benchmarkParam = compareSp500 ? 'sp500' : 'none'

    setLoadingScope(true)
    ;(async () => {
      try {
        if (scope === 'active') {
          const portId = Number(activePortfolioId)
          const hist = await api.get(`/portfolios/${portId}/history`, { days: 3650, benchmarks: benchmarkParam })
          if (cancelled) return
          const portCcy = inferPortfolioCurrency(activePort, holdings)
          setScoped({
            holdings,
            transactions,
            dividends,
            portfolioHistory: convertHistoryToDisplay(
              normalizeHistoryResponse(hist),
              portCcy,
              displayCurrency,
              fxRate
            ),
            benchmark: compareSp500 ? extractBenchmark(hist) : null,
            title: activePort?.name || 'พอร์ต',
            subtitle: null,
            showAllPortsSummary: portfolios.length > 1,
            portfolioCurrency: portCcy,
          })
          return
        }

        if (scope === 'all') {
          const [txRes, divRes, histRes] = await Promise.all([
            Promise.all(portfolios.map((p) => api.get('/transactions', { portfolio_id: p.id }))),
            Promise.all(portfolios.map((p) => api.get('/dividends', { portfolio_id: p.id }))),
            Promise.all(
              portfolios.map((p) =>
                api.get(`/portfolios/${p.id}/history`, { days: 3650, benchmarks: benchmarkParam })
              )
            ),
          ])
          if (cancelled) return
          const aggHoldings = aggregateHoldingsByTicker(allHoldings)
          const allTx = txRes
            .flatMap((r) => (Array.isArray(r) ? r : []))
            .sort((a, b) => String(b.date).localeCompare(String(a.date)))
          const allDiv = divRes.flatMap((r) => (Array.isArray(r) ? r : []))
          setScoped({
            holdings: aggHoldings,
            transactions: allTx,
            dividends: allDiv,
            portfolioHistory: mergePortfolioHistoriesWithPerformance(
              portfolios.map((p, i) => ({
                batch: normalizeHistoryResponse(histRes[i]),
                portfolioCurrency: inferPortfolioCurrency(p, allHoldings),
              })),
              { displayCurrency, usdThb: fxRate, transactions: allTx }
            ),
            benchmark: compareSp500 ? histRes.map(extractBenchmark).find(Boolean) || null : null,
            title: 'ทุกพอร์ตรวม',
            subtitle: `${portfolios.length} พอร์ต · ${aggHoldings.length} หลักทรัพย์`,
            showAllPortsSummary: false,
            portfolioCurrency: displayCurrency,
          })
          return
        }

        const portId = Number(scope)
        const [h, t, d, hist] = await Promise.all([
          api.get('/holdings', { portfolio_id: portId }),
          api.get('/transactions', { portfolio_id: portId }),
          api.get('/dividends', { portfolio_id: portId }),
          api.get(`/portfolios/${portId}/history`, { days: 3650, benchmarks: benchmarkParam }),
        ])
        if (cancelled) return
        const hl = Array.isArray(h) ? h : []
        const port = portfolios.find((p) => Number(p.id) === portId)
        const portCcy = inferPortfolioCurrency(port, hl)
        setScoped({
          holdings: hl,
          transactions: Array.isArray(t) ? t : [],
          dividends: Array.isArray(d) ? d : [],
          portfolioHistory: convertHistoryToDisplay(
            normalizeHistoryResponse(hist),
            portCcy,
            displayCurrency,
            fxRate
          ),
          benchmark: compareSp500 ? extractBenchmark(hist) : null,
          title: portfolioNameById(portfolios, portId),
          subtitle: null,
          showAllPortsSummary: portfolios.length > 1,
          portfolioCurrency: portCcy,
        })
      } catch (err) {
        console.error('Report scope load error:', err)
        if (!cancelled) {
          setScoped({
            holdings: [],
            transactions: [],
            dividends: [],
            portfolioHistory: [],
            benchmark: null,
            title: scope === 'all' ? 'ทุกพอร์ตรวม' : portfolioNameById(portfolios, scope),
            subtitle: null,
            showAllPortsSummary: false,
          })
        }
      } finally {
        if (!cancelled) setLoadingScope(false)
      }
    })()

    return () => { cancelled = true }
  }, [
    scope,
    compareSp500,
    holdings,
    transactions,
    dividends,
    activePort,
    activePortfolioId,
    portfolios,
    allHoldings,
    displayCurrency,
    fxRate,
  ])

  const reportHoldings = scoped?.holdings ?? holdings
  const reportTransactions = scoped?.transactions ?? transactions
  const reportDividends = scoped?.dividends ?? dividends
  const reportHistory = scoped?.portfolioHistory ?? []
  const reportBenchmark = scoped?.benchmark ?? null
  const reportTitle = scoped?.title ?? activePort?.name ?? 'พอร์ต'
  const reportSubtitle = scoped?.subtitle
  const showAllPortsSummary = scoped?.showAllPortsSummary ?? portfolios.length > 1

  const reportDate = new Date().toLocaleString('th-TH', {
    dateStyle: 'long',
    timeStyle: 'short',
  })

  const totVal = reportHoldings.reduce((s, h) => s + getVal(h), 0)
  const totCost = reportHoldings.reduce((s, h) => s + getCost(h), 0)

  const allocation = [...reportHoldings]
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
  reportHoldings.forEach((h) => {
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
  reportHoldings.forEach((h) => {
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
    transactions: reportTransactions,
    holdings: reportHoldings,
    prices,
    convert: convertToDisplay,
  })
  const dividendAll = sumDividends(reportDividends, convertToDisplay)
  const { totalReturn, hasDividends } = computeTotalReturn(totalPnL, dividendAll)
  const displayPnL = hasDividends ? totalReturn : totalPnL
  const totalPct = totCost > 0 ? (displayPnL / totCost) * 100 : 0

  const topGainers = [...allocation].filter((h) => h.pnl > 0).sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 3)
  const topLosers = [...allocation].filter((h) => h.pnl < 0).sort((a, b) => a.pnlPct - b.pnlPct).slice(0, 3)

  const recentTx = [...reportTransactions].slice(0, 10)

  const allPortfolios = portfolios.map((p) => ({
    id: p.id,
    name: p.name,
    holdings: Number(p.holding_count || 0),
    invested: p.invested_thb != null || p.invested_usd != null || p.invested_hkd != null || p.invested_cny != null
      ? convertToDisplay(Number(p.invested_usd || 0), 'USD')
        + convertToDisplay(Number(p.invested_thb || 0), 'THB')
        + convertToDisplay(Number(p.invested_hkd || 0), 'HKD')
        + convertToDisplay(Number(p.invested_cny || 0), 'CNY')
      : convertToDisplay(Number(p.total_invested || 0), p.currency || 'USD'),
    isActive: Number(p.id) === Number(activePort?.id),
  }))

  if (scope === 'active' && !holdings.length && portfolios.length <= 1) {
    return (
      <div className="dash-report-empty">
        <p style={{ fontSize: '36px', marginBottom: '12px' }}>📋</p>
        <p className="dash-text-muted" style={{ fontSize: '14px' }}>ยังไม่มีข้อมูลพอร์ต — บันทึก transaction เพื่อสร้างรายงาน</p>
      </div>
    )
  }

  if (loadingScope) {
    return (
      <div className="dash-report-empty">
        <p className="dash-text-muted" style={{ fontSize: '14px' }}>กำลังโหลดรายงาน...</p>
      </div>
    )
  }

  if (!reportHoldings.length) {
    return (
      <div className="dash-report">
        <div className="dash-report-toolbar report-no-print">
          {portfolios.length > 0 && (
            <label className="dash-report-scope">
              <span className="dash-report-scope-label">รายงาน</span>
              <select
                className="dash-select dash-report-scope-select"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
              >
                <option value="active">{activePort?.name || 'พอร์ตปัจจุบัน'} (กำลังดู)</option>
                {portfolios
                  .filter((p) => Number(p.id) !== Number(activePortfolioId))
                  .map((p) => (
                    <option key={p.id} value={String(p.id)}>{p.name}</option>
                  ))}
                {portfolios.length > 1 && <option value="all">ทุกพอร์ตรวม</option>}
              </select>
            </label>
          )}
        </div>
        <div className="dash-report-empty">
          <p style={{ fontSize: '36px', marginBottom: '12px' }}>📋</p>
          <p className="dash-text-muted" style={{ fontSize: '14px' }}>ไม่มี holdings ในขอบเขตรายงานนี้</p>
        </div>
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

  const holdingSlices = allocation.map((h, i) => ({
    label: h.ticker,
    value: h.val,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }))

  const sectorSlices = sectorRows.map((s, i) => ({
    label: s.name,
    value: s.value,
    color: SECTOR_COLORS[i % SECTOR_COLORS.length],
  }))

  const currencySlices = currencyRows.map((c) => ({
    label: c.ccy,
    value: c.value,
    color: c.ccy === 'THB' ? '#00b894' : c.ccy === 'USD' ? '#0984e3' : '#a29bfe',
  }))

  const useHoldingBars = shouldUseBarChart(holdingSlices.length)
  const useSectorBars = shouldUseBarChart(sectorSlices.length)

  return (
    <div className="dash-report">
      <div className="dash-report-toolbar report-no-print">
        <p className="dash-text-muted" style={{ fontSize: '13px', flex: 1, minWidth: '140px' }}>
          สรุปภาพรวมการลงทุน · อัปเดต {reportDate}
        </p>
        {portfolios.length > 0 && (
          <label className="dash-report-scope">
            <span className="dash-report-scope-label">รายงาน</span>
            <select
              className="dash-select dash-report-scope-select"
              value={scope}
              onChange={(e) => setScope(e.target.value)}
              disabled={loadingScope}
            >
              <option value="active">{activePort?.name || 'พอร์ตปัจจุบัน'} (กำลังดู)</option>
              {portfolios
                .filter((p) => Number(p.id) !== Number(activePortfolioId))
                .map((p) => (
                  <option key={p.id} value={String(p.id)}>{p.name}</option>
                ))}
              {portfolios.length > 1 && <option value="all">ทุกพอร์ตรวม</option>}
            </select>
          </label>
        )}
        <button
          type="button"
          className="dash-report-print-btn"
          onClick={() => window.print()}
          disabled={loadingScope}
        >
          🖨️ พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="dash-report-header">
        <div>
          <p className="dash-report-eyebrow">PortDiary — Portfolio Report</p>
          <h2 className="dash-report-title">{reportTitle}</h2>
          <p className="dash-report-meta">
            {user?.name} · สกุลเงินแสดงผล: {displayCurrency}
            {!loadingP && !hideValues && ` · FX $1 = ฿${Number(fxRate).toFixed(2)}`}
            {reportSubtitle && ` · ${reportSubtitle}`}
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

      <div className={`dash-report-charts${useHoldingBars ? ' dash-report-charts--holdings-bars' : ''}`}>
        <section className={`dash-report-chart-card${useHoldingBars ? ' dash-report-chart-card--wide' : ''}`}>
          <h3>สัดส่วนหุ้น</h3>
          {useHoldingBars ? (
            <ReportBarChart items={holdingSlices} hideValues={hideValues} fmtValue={fmtMoney} />
          ) : (
            <ReportDonut
              slices={holdingSlices}
              centerLabel="หุ้น"
              centerValue={`${allocation.length}`}
              hideValues={hideValues}
              fmtValue={fmtMoney}
            />
          )}
        </section>
        <section className={`dash-report-chart-card${useSectorBars ? ' dash-report-chart-card--wide' : ''}`}>
          <h3>สัดส่วน Sector</h3>
          {useSectorBars ? (
            <ReportBarChart items={sectorSlices} hideValues={hideValues} fmtValue={fmtMoney} />
          ) : (
            <ReportDonut
              slices={sectorSlices}
              centerLabel="Sector"
              centerValue={`${sectorRows.length}`}
              hideValues={hideValues}
              fmtValue={fmtMoney}
            />
          )}
        </section>
        <section className="dash-report-chart-card">
          <h3>สกุลเงินในพอร์ต</h3>
          <ReportDonut
            slices={currencySlices}
            centerLabel="สกุลเงิน"
            centerValue={currencyRows.length === 1 ? currencyRows[0].ccy : `${currencyRows.length}`}
            hideValues={hideValues}
            fmtValue={fmtMoney}
          />
        </section>
        {reportHistory.length > 1 && (
          <section className="dash-report-chart-card dash-report-chart-card--wide">
            <h3>แนวโน้มมูลค่าพอร์ต (Time series)</h3>
            <ReportLineChart
              history={reportHistory}
              benchmark={reportBenchmark}
              compareSp500={compareSp500}
              onCompareSp500Change={setCompareSp500}
              displayCurrency={displayCurrency}
              hideValues={hideValues}
            />
          </section>
        )}
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

        {showAllPortsSummary && (
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
                      <td>{fmtShares(t.shares)}</td>
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
