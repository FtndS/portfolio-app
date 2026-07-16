import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import './Landing.css'

export default function AppHub({ user, onOpenStock, onOpenTrip, onOpenSubscription, onLogout, onOpenAdmin }) {
  const planLabel = user?.plan === 'pro' ? 'Pro' : 'Free'

  return (
    <div className="landing landing--hub">
      <nav className="landing-nav">
        <Logo size={28} className="landing-logo" />
        <div className="landing-nav-actions">
          <ThemeToggle />
          {onOpenAdmin && (
            <button type="button" className="landing-btn-ghost" onClick={onOpenAdmin}>
              Admin
            </button>
          )}
          <button type="button" className="landing-btn-ghost" onClick={onOpenSubscription}>
            แผน {planLabel}
          </button>
          <button type="button" className="landing-btn-ghost" onClick={onLogout}>
            ออกจากระบบ
          </button>
        </div>
      </nav>

      <section className="landing-hero landing-hero--suite">
        <div className="landing-hero-text landing-hero-text--center">
          <p className="landing-kicker">บัญชีของคุณ</p>
          <h1>
            สวัสดี, <span>{user?.name || 'นักลงทุน'}</span>
          </h1>
          <p>
            เลือกแอปที่ต้องการใช้งาน — สมัครครั้งเดียว ใช้ได้ทั้ง Stock และ Trip
          </p>
        </div>
      </section>

      <section className="landing-apps">
        <button type="button" className="landing-app-card" onClick={onOpenStock}>
          <div className="landing-app-card-top">
            <span className="landing-app-card-tag">พร้อมใช้</span>
            <h2>Stock Asset Tracker</h2>
          </div>
          <p>บันทึกพอร์ต รายงาน AI journal และติดตามหุ้นไทย–ต่างประเทศ</p>
          <span className="landing-app-card-cta">เปิดแอปหุ้น →</span>
        </button>

        <button type="button" className="landing-app-card landing-app-card--trip" onClick={onOpenTrip}>
          <div className="landing-app-card-top">
            <span className="landing-app-card-tag landing-app-card-tag--soon">เร็วๆ นี้</span>
            <h2>Trip Planner</h2>
          </div>
          <p>วางแผนท่องเที่ยว จุดแวะพัก ที่พัก ร้านอาหาร และสนามบินในที่เดียว</p>
          <span className="landing-app-card-cta">ดูสถานะ →</span>
        </button>
      </section>
    </div>
  )
}
