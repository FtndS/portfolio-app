import { useEffect, useState } from 'react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import './Landing.css'

export default function Landing({ onLogin, onRegister, onChooseStock, onChooseTrip }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing">
      <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
        <Logo size={28} className="landing-logo" />
        <div className="landing-nav-actions">
          <ThemeToggle />
          <button type="button" className="landing-btn-ghost" onClick={() => onLogin()}>
            เข้าสู่ระบบ
          </button>
          <button type="button" className="landing-btn-primary" onClick={() => onRegister()}>
            สมัครครั้งเดียว
          </button>
        </div>
      </nav>

      <section className="landing-hero landing-hero--suite">
        <div className="landing-hero-text landing-hero-text--center">
          <p className="landing-kicker">PortDiary</p>
          <h1>
            หนึ่งบัญชี<br />
            <span>สองแอปสำหรับชีวิตคุณ</span>
          </h1>
          <p>
            จัดการพอร์ตลงทุน และวางแผนท่องเที่ยวได้ในที่เดียว —
            สมัครครั้งเดียว ใช้ได้ทั้ง PortDiary Stock และ Trip Planner
          </p>
        </div>
      </section>

      <section className="landing-apps">
        <button type="button" className="landing-app-card" onClick={onChooseStock}>
          <div className="landing-app-card-top">
            <span className="landing-app-card-tag">พร้อมใช้</span>
            <h2>PortDiary Stock</h2>
          </div>
          <p>
            บันทึกพอร์ตหลายกอง รายงาน journal AI และติดตามหุ้นไทย–ต่างประเทศอย่างเป็นระบบ
          </p>
          <span className="landing-app-card-cta">เลือกแอปนี้ →</span>
        </button>

        <button type="button" className="landing-app-card landing-app-card--trip" onClick={onChooseTrip}>
          <div className="landing-app-card-top">
            <span className="landing-app-card-tag">พร้อมใช้</span>
            <h2>Trip Planner</h2>
          </div>
          <p>
            วางแผนวันเดินทาง จุดแวะพัก ที่พัก ร้านอาหาร สนามบิน — และจองผ่านพาร์ทเนอร์ได้ในอนาคต
          </p>
          <span className="landing-app-card-cta">เลือกแอปนี้ →</span>
        </button>
      </section>

      <section className="landing-cta-section">
        <div className="landing-cta-box landing-cta-box--suite">
          <h2>เริ่มด้วยบัญชีเดียว</h2>
          <p>สมัครฟรี แล้วเลือกแอปที่ต้องการได้ทันทีหลังเข้าสู่ระบบ</p>
          <button type="button" className="landing-btn-primary lg" onClick={() => onRegister()}>
            สมัครสมาชิกฟรี
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        <div style={{ marginBottom: '8px' }}>
          <a href="/terms.html" style={{ color: 'var(--text-faint)', marginRight: '16px', fontSize: '13px', textDecoration: 'none' }}>ข้อกำหนดการใช้งาน</a>
          <a href="/privacy.html" style={{ color: 'var(--text-faint)', fontSize: '13px', textDecoration: 'none' }}>นโยบายความเป็นส่วนตัว</a>
        </div>
        © {new Date().getFullYear()} PortDiary — Stock & Trip
      </footer>
    </div>
  )
}
