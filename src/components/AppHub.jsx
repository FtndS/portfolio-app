import { useState } from 'react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import SupportModal from './modals/SupportModal'
import './Landing.css'

export default function AppHub({ user, onOpenStock, onOpenTrip, onOpenSubscription, onLogout, onOpenAdmin }) {
  const planLabel = user?.plan === 'pro' ? 'Pro' : 'Free'
  const [supportOpen, setSupportOpen] = useState(false)

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
          <button
            type="button"
            className="landing-btn-ghost"
            onClick={() => setSupportOpen(true)}
            title="ช่วยเหลือ / แจ้งปัญหา"
          >
            ช่วยเหลือ
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
            PortDiary รวมสองเครื่องมือในบัญชีเดียว — ติดตามพอร์ตหุ้น และวางแผนท่องเที่ยว
            เลือกแอปด้านล่างเพื่อเริ่มใช้งานได้ทันที
          </p>
        </div>
      </section>

      <section className="landing-apps">
        <button type="button" className="landing-app-card" onClick={onOpenStock}>
          <div className="landing-app-card-top">
            <span className="landing-app-card-tag">พร้อมใช้</span>
            <h2>PortDiary Stock</h2>
          </div>
          <p>
            บันทึกธุรกรรม ดูรายงานผลตอบแทน AI journal และติดตามหุ้นไทย–ต่างประเทศในมุมมองเดียว
          </p>
          <span className="landing-app-card-cta">เปิดพอร์ตไดอารี่ →</span>
        </button>

        <button type="button" className="landing-app-card landing-app-card--trip" onClick={onOpenTrip}>
          <div className="landing-app-card-top">
            <span className="landing-app-card-tag">พร้อมใช้</span>
            <h2>Trip Planner</h2>
          </div>
          <p>
            ให้ AI จัดแผนเที่ยวรายวัน พร้อมที่พัก ร้านอาหาร การเดินทาง และลิงก์จองภายนอก — Export PDF ได้
          </p>
          <span className="landing-app-card-cta">เปิดแอปทริป →</span>
        </button>
      </section>

      {supportOpen && (
        <SupportModal
          onClose={() => setSupportOpen(false)}
          onOpenSubscription={onOpenSubscription}
        />
      )}
    </div>
  )
}
