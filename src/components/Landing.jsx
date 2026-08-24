import { useEffect, useState } from 'react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import NavMegaMenu, { suiteAppSections } from './nav/NavMegaMenu'
import './Landing.css'

export default function Landing({ onLogin, onRegister, onChooseStock, onChooseTrip }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing">
      <div className="landing-aurora" aria-hidden="true">
        <span className="landing-orb landing-orb--a" />
        <span className="landing-orb landing-orb--b" />
        <span className="landing-grid" />
      </div>

      <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
        <Logo size={28} className="landing-logo" />
        <div className="site-nav-links">
          <NavMegaMenu
            label="แอป"
            sections={suiteAppSections({
              onStock: onChooseStock,
              onTrip: onChooseTrip,
            })}
          />
          <a className="site-nav-link site-nav-link--secondary" href="#pricing">แพ็กเกจ</a>
          <a className="site-nav-link site-nav-link--secondary" href="/contact.html">ติดต่อ</a>
        </div>
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
        <div className="landing-hero-text landing-hero-text--center landing-reveal">
          <p className="landing-kicker">PortDiary</p>
          <h1>
            หนึ่งบัญชี<br />
            <span>สองแอปสำหรับชีวิตคุณ</span>
          </h1>
          <p>
            จัดการพอร์ตลงทุน และวางแผนท่องเที่ยวได้ในที่เดียว —
            สมัครครั้งเดียว ใช้ได้ทั้ง PortDiary Stock และ Trip Planner
          </p>
          <div className="landing-hero-pills" aria-hidden="true">
            <span>พอร์ตหุ้นไทย–เทศ</span>
            <span>แผนทริป AI</span>
            <span>บัญชีเดียว</span>
          </div>
        </div>
      </section>

      <section className="landing-apps">
        <button type="button" className="landing-app-card landing-reveal landing-reveal--2" onClick={onChooseStock}>
          <div className="landing-app-card-visual landing-app-card-visual--stock" aria-hidden="true">
            <span className="landing-app-card-icon">📈</span>
          </div>
          <div className="landing-app-card-top">
            <span className="landing-app-card-tag">พร้อมใช้</span>
            <h2>PortDiary Stock</h2>
          </div>
          <p>
            บันทึกพอร์ตหลายกอง รายงาน journal AI และติดตามหุ้นไทย–ต่างประเทศอย่างเป็นระบบ
          </p>
          <span className="landing-app-card-cta">เลือกแอปนี้ →</span>
        </button>

        <button type="button" className="landing-app-card landing-app-card--trip landing-reveal landing-reveal--3" onClick={onChooseTrip}>
          <div className="landing-app-card-visual landing-app-card-visual--trip" aria-hidden="true">
            <span className="landing-app-card-icon">✈️</span>
          </div>
          <div className="landing-app-card-top">
            <span className="landing-app-card-tag">พร้อมใช้</span>
            <h2>Trip Planner</h2>
          </div>
          <p>
            วางแผนวันเดินทาง จุดแวะพัก ที่พัก ร้านอาหาร สนามบิน — และจองผ่านพาร์ทเนอร์ภายนอก
          </p>
          <span className="landing-app-card-cta">เลือกแอปนี้ →</span>
        </button>
      </section>

      <section className="landing-pricing" id="pricing" aria-labelledby="landing-pricing-title">
        <h2 id="landing-pricing-title" className="landing-reveal">แพ็กเกจและราคา</h2>
        <p className="landing-pricing-lead landing-reveal landing-reveal--2">
          เริ่มฟรีได้ทันที — อัปเกรด Pro ได้จากหน้าชำระเงินในแอป (Omise)
        </p>
        <div className="landing-pricing-grid">
          <div className="landing-price-card landing-reveal landing-reveal--2">
            <h3>Free</h3>
            <p className="landing-price-amount">฿0</p>
            <ul>
              <li>พอร์ตและทริปพื้นฐาน</li>
              <li>โควตา AI จำกัดต่อสัปดาห์</li>
            </ul>
            <button type="button" className="landing-btn-ghost landing-price-cta" onClick={() => onRegister()}>
              เริ่มฟรี
            </button>
          </div>
          <div className="landing-price-card landing-price-card--pro landing-reveal landing-reveal--3">
            <span className="landing-price-badge">ยอดนิยม</span>
            <h3>Pro</h3>
            <p className="landing-price-amount">฿99<span>/เดือน</span></p>
            <ul>
              <li>โควตา AI สูงขึ้น + Copilot ถามเองได้</li>
              <li>ชำระบัตรหรือ PromptPay</li>
            </ul>
            <button type="button" className="landing-btn-primary landing-price-cta" onClick={() => onRegister()}>
              อัปเกรด Pro
            </button>
          </div>
        </div>
        <p className="landing-pricing-more">
          <a href="/pricing.html">ดูรายละเอียดแพ็กเกจ</a>
          {' · '}
          <a href="/terms.html">ยกเลิก / คืนเงิน</a>
          {' · '}
          <a href="/contact.html">ติดต่อเรา</a>
        </p>
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
        <div className="landing-footer-links">
          <a href="/pricing.html">แพ็กเกจและราคา</a>
          <a href="/contact.html">ติดต่อเรา</a>
          <a href="/terms.html">ข้อกำหนดการใช้งาน</a>
          <a href="/privacy.html">นโยบายความเป็นส่วนตัว</a>
        </div>
        <p className="landing-footer-contact">
          ติดต่อ: <a href="mailto:support@portdiary.com">support@portdiary.com</a>
        </p>
        © {new Date().getFullYear()} PortDiary — Stock & Trip
      </footer>
    </div>
  )
}
