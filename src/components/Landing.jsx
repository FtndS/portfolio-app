import { useEffect, useState } from 'react'
import './Landing.css'

const FEATURES = [
  {
    icon: '📊',
    title: 'บันทึกพอร์ตหลายกอง',
    desc: 'แยกพอร์ต US, หุ้นไทย SET, ฮ่องกง จีน ได้ในบัญชีเดียว สลับดู USD/THB ได้ทันที',
  },
  {
    icon: '📈',
    title: 'กราฟและ Heatmap',
    desc: 'ดูมูลค่าพอร์ตย้อนหลัง sector allocation donut chart และ heatmap แสดง % เปลี่ยนแปลงแบบ real-time',
  },
  {
    icon: '📝',
    title: 'Investment Journal',
    desc: 'บันทึกความคิด การ rebalance และเหตุผลซื้อ-ขาย พร้อม tag และเชื่อมโยง ticker ที่เกี่ยวข้อง',
  },
  {
    icon: '🤖',
    title: 'AI วิเคราะห์พอร์ต',
    desc: 'ให้ AI ช่วยประเมินความเสี่ยง concentration และแนะนำ rebalancing จากข้อมูลพอร์ตจริงของคุณ',
  },
  {
    icon: '📰',
    title: 'ข่าวที่เกี่ยวข้อง',
    desc: 'ดึงข่าวจาก sector ที่ถืออยู่และข่าวรายหุ้น แยกสิ่งที่กระทบพอร์ตออกจากข่าวทั่วไป',
  },
  {
    icon: '💱',
    title: 'รองรับหลายตลาด',
    desc: 'US, SET, Hong Kong, Shanghai, Shenzhen — ราคาอัปเดตจาก Yahoo Finance อัตโนมัติทุก 5 นาที',
  },
]

export default function Landing({ onLogin, onRegister }) {
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <div className="landing">
      <nav className={`landing-nav${scrolled ? ' scrolled' : ''}`}>
        <div className="landing-logo">
          <span>📓</span>
          <span>Port Diary</span>
        </div>
        <div className="landing-nav-actions">
          <button type="button" className="landing-btn-ghost" onClick={onLogin}>
            เข้าสู่ระบบ
          </button>
          <button type="button" className="landing-btn-primary" onClick={onRegister}>
            สมัครฟรี
          </button>
        </div>
      </nav>

      <section className="landing-hero">
        <div className="landing-hero-text">
          <h1>
            บันทึกพอร์ต<br />
            <span>อย่างมีระบบ</span>
          </h1>
          <p>
            Port Diary คือเครื่องมือบันทึกและวิเคราะห์พอร์ตการลงทุนส่วนตัว
            รวม transaction, journal, กราฟ และ AI ไว้ในที่เดียว
          </p>
          <div className="landing-hero-cta">
            <button type="button" className="landing-btn-primary lg" onClick={onRegister}>
              เริ่มใช้งานฟรี
            </button>
            <button type="button" className="landing-btn-ghost" onClick={onLogin} style={{ padding: '12px 28px', fontSize: '15px' }}>
              เข้าสู่ระบบ
            </button>
          </div>
          <div className="landing-hero-badges">
            <span className="landing-badge">✓ ฟรี ไม่มีค่าใช้จ่าย</span>
            <span className="landing-badge">✓ รองรับหุ้นไทยและต่างประเทศ</span>
            <span className="landing-badge">✓ ข้อมูลเป็นส่วนตัว</span>
          </div>
        </div>

        <div className="landing-preview">
          <div className="landing-preview-header">
            <div>
              <div className="landing-preview-title">📓 US Growth</div>
              <div className="landing-preview-sub">Overview · 5 holdings</div>
            </div>
            <span style={{ fontSize: '11px', color: '#555' }}>$ USD</span>
          </div>

          <div className="landing-preview-stats">
            <div className="landing-stat-card">
              <div className="landing-stat-label">มูลค่าพอร์ต</div>
              <div className="landing-stat-value">$124,580</div>
            </div>
            <div className="landing-stat-card">
              <div className="landing-stat-label">กำไร/ขาดทุน</div>
              <div className="landing-stat-value green">+$18,420 (+17.3%)</div>
            </div>
          </div>

          <div className="landing-preview-chart">
            <svg className="landing-chart-line" viewBox="0 0 300 60" preserveAspectRatio="none">
              <polyline
                points="0,50 30,45 60,48 90,38 120,35 150,28 180,32 210,20 240,18 270,12 300,8"
                fill="none"
                stroke="#6c5ce7"
                strokeWidth="2.5"
                strokeLinejoin="round"
              />
              <polyline
                points="0,52 30,50 60,51 90,46 120,44 150,40 180,42 210,36 240,34 270,30 300,28"
                fill="none"
                stroke="#444"
                strokeWidth="1.5"
                strokeDasharray="4,4"
                strokeLinejoin="round"
              />
            </svg>
          </div>

          <div className="landing-preview-holdings">
            {[
              { ticker: 'VOO', pct: 42 },
              { ticker: 'NVDA', pct: 28 },
              { ticker: 'QQQM', pct: 18 },
              { ticker: 'SMH', pct: 12 },
            ].map((h) => (
              <div key={h.ticker} className="landing-holding-row">
                <span className="landing-holding-ticker">{h.ticker}</span>
                <div className="landing-holding-bar">
                  <div className="landing-holding-bar-fill" style={{ width: `${h.pct}%` }} />
                </div>
                <span className="landing-holding-pct">{h.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="landing-features">
        <div className="landing-section-title">
          <h2>ทุกอย่างที่นักลงทุนต้องการ</h2>
          <p>ออกแบบมาเพื่อบันทึกและทบทวนพอร์ตของคุณอย่างเป็นระบบ</p>
        </div>
        <div className="landing-feature-grid">
          {FEATURES.map((f) => (
            <div key={f.title} className="landing-feature-card">
              <div className="landing-feature-icon">{f.icon}</div>
              <h3>{f.title}</h3>
              <p>{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="landing-cta-section">
        <div className="landing-cta-box">
          <h2>พร้อมเริ่มบันทึกพอร์ตแล้วหรือยัง?</h2>
          <p>สมัครฟรี แล้วเริ่มบันทึก transaction แรกของคุณได้ทันที</p>
          <button type="button" className="landing-btn-primary lg" onClick={onRegister}>
            สมัครสมาชิกฟรี
          </button>
        </div>
      </section>

      <footer className="landing-footer">
        © {new Date().getFullYear()} Port Diary — บันทึกพอร์ตการลงทุน
      </footer>
    </div>
  )
}
