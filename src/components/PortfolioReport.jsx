const SECTOR_COLORS = ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e', '#e84393', '#55efc4', '#a29bfe']

function pnlColor(n) {
  return n >= 0 ? '#27ae60' : '#e74c3c'
}

export default function PortfolioReport({
  user,
  activePort,
  portfolios,
  holdings,
  transactions,
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
  totPnL,
  totPct,
}) {
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

  const topGainers = [...allocation].filter((h) => h.pnl > 0).sort((a, b) => b.pnlPct - a.pnlPct).slice(0, 3)
  const topLosers = [...allocation].filter((h) => h.pnl < 0).sort((a, b) => a.pnlPct - b.pnlPct).slice(0, 3)

  const recentTx = [...transactions].slice(0, 10)

  const allPortfolios = portfolios.map((p) => ({
    id: p.id,
    name: p.name,
    holdings: Number(p.holding_count || 0),
    invested: convertToDisplay(Number(p.total_invested || 0), p.currency || 'USD'),
    isActive: Number(p.id) === Number(activePort?.id),
  }))

  if (!holdings.length) {
    return (
      <div className="dash-report-empty">
        <p style={{ fontSize: '36px', marginBottom: '12px' }}>📋</p>
        <p style={{ fontSize: '14px', color: '#666' }}>ยังไม่มีข้อมูลพอร์ต — บันทึก transaction เพื่อสร้างรายงาน</p>
      </div>
    )
  }

  return (
    <div className="dash-report">
      <div className="dash-report-toolbar report-no-print">
        <p style={{ color: '#666', fontSize: '13px', flex: 1 }}>
          สรุปภาพรวมการลงทุน · อัปเดต {reportDate}
        </p>
        <button
          type="button"
          onClick={() => window.print()}
          style={{
            padding: '8px 18px',
            background: '#6c5ce7',
            border: 'none',
            borderRadius: '8px',
            color: '#fff',
            fontSize: '13px',
            cursor: 'pointer',
            fontWeight: 500,
          }}
        >
          🖨️ พิมพ์ / บันทึก PDF
        </button>
      </div>

      <div className="dash-report-header">
        <div>
          <p className="dash-report-eyebrow">Port Diary — Portfolio Report</p>
          <h2 className="dash-report-title">{activePort?.name || 'พอร์ต'}</h2>
          <p className="dash-report-meta">
            {user?.name} · สกุลเงินแสดงผล: {displayCurrency}
            {!loadingP && ` · FX $1 = ฿${Number(fxRate).toFixed(2)}`}
          </p>
        </div>
        <div className="dash-report-asof">{reportDate}</div>
      </div>

      <div className="dash-report-kpis">
        {[
          ['มูลค่าพอร์ตปัจจุบัน', fmt(totVal), null],
          ['เงินลงทุน (ทุน)', fmt(totCost), '#a29bfe'],
          ['กำไร/ขาดทุน', `${fmt(totPnL)} (${totPct >= 0 ? '+' : ''}${totPct.toFixed(2)}%)`, pnlColor(totPnL)],
          ['% เปลี่ยนแปลงวันนี้', `${weightedDayChg >= 0 ? '+' : ''}${weightedDayChg.toFixed(2)}%`, pnlColor(weightedDayChg)],
        ].map(([label, val, color]) => (
          <div key={label} className="dash-report-kpi">
            <div className="dash-report-kpi-label">{label}</div>
            <div className="dash-report-kpi-value" style={{ color: color || '#fff' }}>{val}</div>
          </div>
        ))}
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
                    <td>{fmt(h.val)}</td>
                    <td className="dash-report-muted">{fmt(h.cost)}</td>
                    <td style={{ color: pnlColor(h.pnl) }}>{fmt(h.pnl)}</td>
                    <td style={{ color: pnlColor(h.pnl) }}>{h.pnlPct >= 0 ? '+' : ''}{h.pnlPct.toFixed(2)}%</td>
                    <td style={{ color: pnlColor(h.dayChg) }}>{h.dayChg >= 0 ? '+' : ''}{h.dayChg.toFixed(2)}%</td>
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
                  <span>{s.pct.toFixed(1)}% · {fmt(s.value)}</span>
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
                  <span>{c.pct.toFixed(1)}% · {fmt(c.value)}</span>
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
                    <span style={{ color: '#27ae60' }}>+{h.pnlPct.toFixed(2)}%</span>
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
                    <span style={{ color: '#e74c3c' }}>{h.pnlPct.toFixed(2)}%</span>
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
                  <span className="dash-report-muted">{p.holdings} หลัก · {fmt(p.invested)}</span>
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
                    {['วันที่', 'Ticker', 'ประเภท', 'Shares', 'ราคา', 'มูลค่า', 'หมายเหตุ'].map((h) => (
                      <th key={h}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recentTx.map((t) => (
                    <tr key={t.id}>
                      <td className="dash-report-muted">{t.date?.split('T')[0] || t.date}</td>
                      <td className="dash-report-ticker">{t.ticker}</td>
                      <td style={{ color: t.type === 'BUY' ? '#55efc4' : '#ff7675' }}>{t.type}</td>
                      <td>{Number(t.shares).toLocaleString('en-US', { maximumFractionDigits: 4 })}</td>
                      <td>{Number(t.price).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
                      <td>{Number(t.total).toLocaleString('en-US', { minimumFractionDigits: 2 })}</td>
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
