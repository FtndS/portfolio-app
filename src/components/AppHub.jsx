import { useState } from 'react'
import Logo from './Logo'
import ThemeToggle from './ThemeToggle'
import SupportModal from './modals/SupportModal'
import NavMegaMenu, { suiteAppSections } from './nav/NavMegaMenu'
import { TRIP_PLANNER_ENABLED } from '../lib/appRoutes'
import './Landing.css'

export default function AppHub({ user, onOpenStock, onOpenTrip, onOpenSubscription, onLogout, onOpenAdmin }) {
  const planLabel = user?.plan === 'pro' ? 'Pro' : 'Free'
  const [supportOpen, setSupportOpen] = useState(false)

  return (
    <div className={`landing landing--hub${!TRIP_PLANNER_ENABLED ? ' landing--solo' : ''}`}>
      <div className="landing-aurora" aria-hidden="true">
        <span className="landing-orb landing-orb--a" />
        <span className="landing-orb landing-orb--b" />
        <span className="landing-grid" />
      </div>

      <nav className="landing-nav scrolled">
        <Logo size={28} className="landing-logo" />
        <div className="site-nav-links">
          {TRIP_PLANNER_ENABLED ? (
            <NavMegaMenu
              label="แอป"
              sections={suiteAppSections({
                onStock: onOpenStock,
                onTrip: onOpenTrip,
              })}
            />
          ) : null}
          <button type="button" className="site-nav-link site-nav-link--secondary" onClick={onOpenSubscription}>
            แพ็กเกจ
          </button>
        </div>
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
        <div className="landing-hero-text landing-hero-text--center landing-reveal">
          <p className="landing-kicker">บัญชีของคุณ</p>
          <h1>
            สวัสดี, <span>{user?.name || 'นักลงทุน'}</span>
          </h1>
          <p className="landing-hero-lead">
            {TRIP_PLANNER_ENABLED
              ? 'PortDiary รวมสองเครื่องมือในบัญชีเดียว — ติดตามพอร์ตหุ้น และวางแผนท่องเที่ยว เลือกแอปด้านล่างเพื่อเริ่มใช้งานได้ทันที'
              : 'ติดตามพอร์ตหุ้นไทย–ต่างประเทศ ดูรายงาน และใช้ AI ช่วยวิเคราะห์ — กดเปิดพอร์ตด้านล่างเพื่อเริ่มใช้งาน'}
          </p>
          {!TRIP_PLANNER_ENABLED && (
            <div className="landing-hero-cta landing-hero-cta--center">
              <button type="button" className="landing-btn-primary lg" onClick={onOpenStock}>
                เปิดพอร์ตไดอารี่
              </button>
              <button type="button" className="landing-btn-ghost lg" onClick={onOpenSubscription}>
                ดูแพ็กเกจ
              </button>
            </div>
          )}
        </div>
      </section>

      {TRIP_PLANNER_ENABLED ? (
        <section className="landing-apps">
          <button type="button" className="landing-app-card landing-reveal landing-reveal--2" onClick={onOpenStock}>
            <div className="landing-app-card-visual landing-app-card-visual--stock" aria-hidden="true">
              <span className="landing-app-card-icon">📈</span>
            </div>
            <div className="landing-app-card-top">
              <span className="landing-app-card-tag">พร้อมใช้</span>
              <h2>PortDiary Stock</h2>
            </div>
            <p>
              บันทึกธุรกรรม ดูรายงานผลตอบแทน AI journal และติดตามหุ้นไทย–ต่างประเทศในมุมมองเดียว
            </p>
            <span className="landing-app-card-cta">เปิดพอร์ตไดอารี่ →</span>
          </button>

          <button type="button" className="landing-app-card landing-app-card--trip landing-reveal landing-reveal--3" onClick={onOpenTrip}>
            <div className="landing-app-card-visual landing-app-card-visual--trip" aria-hidden="true">
              <span className="landing-app-card-icon">✈️</span>
            </div>
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
      ) : null}

      {supportOpen && (
        <SupportModal
          onClose={() => setSupportOpen(false)}
          onOpenSubscription={onOpenSubscription}
        />
      )}
    </div>
  )
}
