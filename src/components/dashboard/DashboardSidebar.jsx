import Logo from '../Logo'

export const DASH_TABS = [
  ['overview', 'ภาพรวม'],
  ['report', 'รายงาน'],
  ['holdings', 'หุ้นที่ถือ'],
  ['transactions', 'ซื้อ/ขาย'],
  ['dividends', 'ปันผล'],
  ['journal', 'บันทึกเหตุผล'],
  ['news', 'ข่าว'],
]

export const SUBSCRIPTION_TAB = 'subscription'

export function tabLabel(key) {
  if (key === SUBSCRIPTION_TAB) return 'แผน Pro'
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
        <button
          type="button"
          className="dash-sidebar-brand-btn"
          onClick={() => onTabChange('overview')}
          title="กลับหน้า Overview"
          aria-label="PortDiary — กลับหน้า Overview"
        >
          <Logo size={24} className="dash-sidebar-logo" />
        </button>
        <p className="dash-sidebar-sub">
          สวัสดี, {user.name}
          {user.plan === 'pro' && (
            <span className="dash-plan-badge dash-plan-badge--pro">Pro</span>
          )}
        </p>
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

      <div className="dash-sidebar-pro">
        <button
          type="button"
          className={`dash-sidebar-pro-btn${tab === SUBSCRIPTION_TAB ? ' dash-sidebar-pro-btn--active' : ''}${user.plan === 'pro' ? ' dash-sidebar-pro-btn--owned' : ''}`}
          onClick={() => onTabChange(SUBSCRIPTION_TAB)}
        >
          <span className="dash-sidebar-pro-icon" aria-hidden>✦</span>
          <span>แผน Pro</span>
          {user.plan === 'pro' ? (
            <span className="dash-sidebar-pro-tag dash-sidebar-pro-tag--owned">ใช้งานอยู่</span>
          ) : (
            <span className="dash-sidebar-pro-tag">฿99/เดือน</span>
          )}
        </button>
      </div>

      <div className="dash-sidebar-footer">
        <button type="button" className="dash-sidebar-cta" onClick={onAddTransaction}>
          + บันทึกซื้อ/ขาย
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
