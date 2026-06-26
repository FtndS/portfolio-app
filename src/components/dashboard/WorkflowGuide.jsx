import { useState } from 'react'
import { WORKFLOW_STEPS, WORKFLOW_VIEWS } from '../../lib/workflow'

const DISMISS_KEY = 'portdiary-workflow-guide-collapsed'

export default function WorkflowGuide({ activeTab, compact = false }) {
  const [collapsed, setCollapsed] = useState(
    () => localStorage.getItem(DISMISS_KEY) === '1',
  )

  const toggleCollapsed = () => {
    setCollapsed((prev) => {
      const next = !prev
      localStorage.setItem(DISMISS_KEY, next ? '1' : '0')
      return next
    })
  }

  if (collapsed && compact) {
    return (
      <button type="button" className="dash-workflow-toggle" onClick={toggleCollapsed}>
        📋 ดูขั้นตอนการใช้งาน (ซื้อ/ขายไปที่ไหน?)
      </button>
    )
  }

  return (
    <div className={`dash-workflow${compact ? ' dash-workflow--compact' : ''}`}>
      <div className="dash-workflow-head">
        <div>
          <p className="dash-workflow-eyebrow">ขั้นตอนแนะนำ</p>
          <h3 className="dash-workflow-title">
            {activeTab === 'transactions'
              ? 'ซื้อ / ขายหุ้น → เริ่มที่แท็บนี้'
              : 'ไม่แน่ใจว่าต้องทำที่ไหน?'}
          </h3>
        </div>
        <button type="button" className="dash-workflow-collapse" onClick={toggleCollapsed}>
          {collapsed ? 'แสดง' : 'ย่อ'}
        </button>
      </div>

      {!collapsed && (
        <>
          <div className="dash-workflow-steps">
            {WORKFLOW_STEPS.map((step, i) => {
              const isActive = step.key === activeTab
              return (
                <div
                  key={step.key}
                  className={`dash-workflow-step${step.primary ? ' dash-workflow-step--primary' : ''}${isActive ? ' dash-workflow-step--active' : ''}`}
                >
                  <div className="dash-workflow-step-num">{i + 1}</div>
                  <div>
                    <p className="dash-workflow-step-title">
                      <span aria-hidden>{step.icon}</span> {step.title}
                      {step.primary && <span className="dash-workflow-badge">หลัก</span>}
                      {isActive && <span className="dash-workflow-badge dash-workflow-badge--here">คุณอยู่ที่นี่</span>}
                    </p>
                    <p className="dash-workflow-step-desc">{step.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
          <p className="dash-workflow-foot">
            {WORKFLOW_VIEWS[0].icon} <strong>{WORKFLOW_VIEWS[0].title}</strong> — {WORKFLOW_VIEWS[0].desc}
          </p>
        </>
      )}
    </div>
  )
}
