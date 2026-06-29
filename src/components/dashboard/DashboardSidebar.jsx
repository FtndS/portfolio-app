export const DASH_TABS = [
  ['overview', 'Overview'],
  ['report', 'Report'],
  ['holdings', 'Holdings'],
  ['transactions', 'Transactions'],
  ['dividends', 'ปันผล'],
  ['journal', 'Journal'],
  ['news', 'News'],
]

export function tabLabel(key) {
  return DASH_TABS.find(([k]) => k === key)?.[1] || key
}

export default function DashboardSidebar({
  user,
  portfolios,
  activePortfolioId,
  onPortfolioChange,
  tab,
  onTabChange,
  onManagePort,
  onNewPort,
  onAddTransaction,
  open,
  onClose,
}) {
  return (
    <aside className={`dash-sidebar${open ? ' dash-sidebar--open' : ''}`} aria-label="เมนูหลัก">
      <div className="dash-sidebar-brand">
        <h1 className="dash-sidebar-title">📓 Port Diary</h1>
        <p className="dash-sidebar-sub">สวัสดี, {user.name}</p>
      </div>

      <div className="dash-sidebar-section">
        <div className="dash-sidebar-label">พอร์ต</div>
        <div className="dash-portfolio-select dash-portfolio-select--sidebar">
          <select
            className="dash-select"
            value={activePortfolioId || ''}
            onChange={(e) => onPortfolioChange(Number(e.target.value))}
          >
            {portfolios.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.is_default ? ' ★' : ''}
              </option>
            ))}
          </select>
          <button type="button" className="dash-icon-btn" onClick={onManagePort} title="จัดการพอร์ต">
            ⚙️
          </button>
          <button type="button" className="dash-icon-btn dash-icon-btn--accent" onClick={onNewPort} title="สร้างพอร์ตใหม่">
            +
          </button>
        </div>
      </div>

      <nav className="dash-sidebar-nav">
        {DASH_TABS.map(([k, label]) => (
          <button
            key={k}
            type="button"
            className={`dash-sidebar-nav-btn${tab === k ? ' dash-sidebar-nav-btn--active' : ''}`}
            onClick={() => onTabChange(k)}
          >
            {label}
          </button>
        ))}
      </nav>

      <div className="dash-sidebar-footer">
        <button type="button" className="dash-sidebar-cta" onClick={onAddTransaction}>
          + บันทึก Transaction
        </button>
      </div>

      <button
        type="button"
        className="dash-sidebar-close"
        onClick={onClose}
        aria-label="ปิดเมนู"
      >
        ✕
      </button>
    </aside>
  )
}
