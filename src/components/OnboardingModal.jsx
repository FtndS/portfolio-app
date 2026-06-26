import { useState } from 'react'
import { api } from '../lib/api'

const STEPS = [
  {
    title: 'ยินดีต้อนรับสู่ Port Diary',
    body: 'เครื่องมือบันทึกและวิเคราะห์พอร์ตส่วนตัว — รวม transaction, กราฟ, รายงานสรุป และ journal ไว้ในที่เดียว',
    icon: '📓',
  },
  {
    title: 'ตั้งชื่อพอร์ตแรก',
    body: 'ตั้งชื่อให้จำง่าย เช่น US Growth, หุ้นไทย, Dividend — เปลี่ยนได้ภายหลัง',
    icon: '📁',
  },
  {
    title: 'บันทึกการลงทุนครั้งแรก',
    body: 'เพิ่ม transaction ซื้อ/ขาย หรือ import จาก CSV — ระบบจะคำนวณ holdings และกราฟให้อัตโนมัติ',
    icon: '✏️',
  },
  {
    title: 'รู้จักแดชบอร์ด',
    body: null,
    icon: '🗺️',
  },
]

const TABS_TOUR = [
  { key: 'overview', label: 'Overview', desc: 'กราฟมูลค่า, sector, heatmap และ AI' },
  { key: 'report', label: 'Report', desc: 'สรุปพอร์ตแบบรายงาน — พิมพ์หรือบันทึก PDF' },
  { key: 'holdings', label: 'Holdings', desc: 'รายการหุ้นที่ถือ พร้อม P&L แต่ละตัว' },
  { key: 'transactions', label: 'Transactions', desc: 'ประวัติซื้อ-ขายทั้งหมด' },
  { key: 'journal', label: 'Journal', desc: 'บันทึกความคิดและเหตุผลการลงทุน' },
]

export function onboardingKey(userId) {
  return `onboarding_done_${userId}`
}

export function markOnboardingDone(userId) {
  if (userId) localStorage.setItem(onboardingKey(userId), '1')
}

export function isOnboardingDone(userId) {
  return userId ? !!localStorage.getItem(onboardingKey(userId)) : true
}

export default function OnboardingModal({
  user,
  activePort,
  onClose,
  onRename,
  onAddTransaction,
  onImportCsv,
  onSetTab,
}) {
  const [step, setStep] = useState(0)
  const [portName, setPortName] = useState(activePort?.name || '')
  const [saving, setSaving] = useState(false)

  const finish = () => {
    markOnboardingDone(user?.id)
    onClose()
  }

  const savePortfolioName = async () => {
    const name = portName.trim()
    if (!name || !activePort?.id) {
      setStep(2)
      return
    }
    setSaving(true)
    try {
      const r = await api.put(`/portfolios/${activePort.id}`, { name })
      if (r.id) onRename?.(r)
    } catch {
      /* continue anyway */
    }
    setSaving(false)
    setStep(2)
  }

  const current = STEPS[step]

  return (
    <div className="modal-overlay onboarding-overlay">
      <div className="modal-panel onboarding-panel">
        <div className="onboarding-progress">
          {STEPS.map((_, i) => (
            <span key={i} className={`onboarding-dot${i <= step ? ' active' : ''}`} />
          ))}
        </div>

        <div className="onboarding-icon">{current.icon}</div>
        <h2 className="onboarding-title">{current.title}</h2>

        {step === 0 && (
          <>
            <p className="onboarding-body">{current.body}</p>
            <ul className="onboarding-checklist">
              <li>บันทึก transaction ซื้อ/ขาย</li>
              <li>ดูกราฟและสัดส่วน sector</li>
              <li>สรุปรายงานพอร์ต (Report)</li>
              <li>เขียน investment journal</li>
            </ul>
          </>
        )}

        {step === 1 && (
          <>
            <p className="onboarding-body">{current.body}</p>
            <input
              className="onboarding-input"
              value={portName}
              onChange={(e) => setPortName(e.target.value)}
              placeholder="เช่น US Growth, หุ้นไทย"
              onKeyDown={(e) => e.key === 'Enter' && savePortfolioName()}
            />
          </>
        )}

        {step === 2 && (
          <>
            <p className="onboarding-body">{current.body}</p>
            <div className="onboarding-actions">
              <button type="button" className="onboarding-btn-primary" onClick={() => { finish(); onAddTransaction() }}>
                + บันทึก Transaction
              </button>
              <button type="button" className="onboarding-btn-ghost" onClick={() => { finish(); onImportCsv() }}>
                📥 Import CSV
              </button>
            </div>
            <button type="button" className="onboarding-skip" onClick={() => setStep(3)}>
              ข้ามไปก่อน →
            </button>
          </>
        )}

        {step === 3 && (
          <>
            <p className="onboarding-body">แท็บหลักที่ใช้บ่อย:</p>
            <ul className="onboarding-tour">
              {TABS_TOUR.map((t) => (
                <li key={t.key}>
                  <button
                    type="button"
                    className="onboarding-tour-btn"
                    onClick={() => { finish(); onSetTab(t.key) }}
                  >
                    <span className="onboarding-tour-label">{t.label}</span>
                    <span className="onboarding-tour-desc">{t.desc}</span>
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        <div className="onboarding-footer">
          {step < 2 && (
            <>
              <button type="button" className="onboarding-btn-ghost" onClick={finish}>
                ข้ามทั้งหมด
              </button>
              {step === 0 ? (
                <button type="button" className="onboarding-btn-primary" onClick={() => setStep(1)}>
                  เริ่มต้น →
                </button>
              ) : (
                <button
                  type="button"
                  className="onboarding-btn-primary"
                  onClick={savePortfolioName}
                  disabled={saving}
                >
                  {saving ? 'กำลังบันทึก...' : 'ถัดไป →'}
                </button>
              )}
            </>
          )}
          {step === 3 && (
            <button type="button" className="onboarding-btn-primary onboarding-btn-full" onClick={finish}>
              เริ่มใช้งาน Port Diary
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
