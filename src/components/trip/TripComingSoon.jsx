import Logo from '../Logo'
import ThemeToggle from '../ThemeToggle'
import '../Landing.css'

export default function TripComingSoon({ onBackHub, onOpenStock }) {
  return (
    <div className="landing landing--hub">
      <nav className="landing-nav">
        <Logo size={28} className="landing-logo" />
        <div className="landing-nav-actions">
          <ThemeToggle />
          <button type="button" className="landing-btn-ghost" onClick={onBackHub}>
            กลับ Hub
          </button>
        </div>
      </nav>

      <section className="landing-hero landing-hero--suite">
        <div className="landing-hero-text landing-hero-text--center" style={{ maxWidth: 560, margin: '0 auto' }}>
          <p className="landing-kicker">PortDiary Trips</p>
          <h1>
            Trip Planner<br />
            <span>กำลังเตรียมเปิดใช้งาน</span>
          </h1>
          <p>
            เร็วๆ นี้คุณจะวางแผนวันทริป จุดแวะ ที่พัก และกิจกรรมได้จากบัญชี PortDiary เดิม
            — สมัครครั้งเดียว ไม่ต้องสร้างบัญชีใหม่
          </p>
          <div className="landing-hero-cta" style={{ justifyContent: 'center' }}>
            <button type="button" className="landing-btn-primary lg" onClick={onBackHub}>
              กลับไปเลือกแอป
            </button>
            <button type="button" className="landing-btn-ghost" onClick={onOpenStock} style={{ padding: '12px 28px', fontSize: '15px' }}>
              ใช้ Stock ก่อน
            </button>
          </div>
        </div>
      </section>
    </div>
  )
}
