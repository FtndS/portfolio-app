import { useState } from 'react'
import { WORKFLOW_STEPS, WORKFLOW_EXTRA, WORKFLOW_VIEWS } from '../../lib/workflow'

const DISMISS_KEY = 'portdiary-workflow-guide-collapsed'

function viewHint(activeTab) {
  return WORKFLOW_VIEWS.find((v) => v.key === activeTab)
}

export default function WorkflowGuide({
  activeTab,
  compact = false,
  onGoTab,
  onAddTransaction,
}) {
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

  const here = viewHint(activeTab)
  const onTransactions = activeTab === 'transactions'

  if (collapsed) {
    return (
      <button type="button" className="dash-workflow-bar" onClick={toggleCollapsed}>
        <span className="dash-workflow-bar-lead">
          <strong>ซื้อ/ขาย</strong>
          <span className="dash-workflow-bar-arrow" aria-hidden>→</span>
          <span className="dash-workflow-bar-tab">Transactions</span>
        </span>
        <span className="dash-workflow-bar-more">ดูขั้นตอนทั้งหมด</span>
      </button>
    )
  }

  return (
    <div className={`dash-workflow${compact ? ' dash-workflow--compact' : ''}${onTransactions ? ' dash-workflow--here-tx' : ''}`}>
      <div className="dash-workflow-head">
        <div>
          <p className="dash-workflow-eyebrow">ใช้งานยังไง</p>
          <h3 className="dash-workflow-title">
            {onTransactions
              ? 'บันทึกซื้อ/ขายที่แท็บนี้'
              : 'ซื้อ/ขายหุ้น → เริ่มที่ Transactions'}
          </h3>
        </div>
        <button type="button" className="dash-workflow-collapse" onClick={toggleCollapsed}>
          ย่อ
        </button>
      </div>

      <div className="dash-workflow-flow" role="list">
        {WORKFLOW_STEPS.map((step, i) => {
          const isActive = step.key === activeTab
          const isPrimary = step.primary
          return (
            <div key={step.key} className="dash-workflow-flow-item" role="listitem">
              {i > 0 && <span className="dash-workflow-connector" aria-hidden>→</span>}
              <button
                type="button"
                className={`dash-workflow-card${isPrimary ? ' dash-workflow-card--primary' : ''}${isActive ? ' dash-workflow-card--active' : ''}${step.optional ? ' dash-workflow-card--optional' : ''}`}
                onClick={() => onGoTab?.(step.key)}
              >
                <span className="dash-workflow-card-top">
                  <span className="dash-workflow-card-num">{i + 1}</span>
                  {isActive && <span className="dash-workflow-pill">อยู่ที่นี่</span>}
                  {step.optional && !isActive && (
                    <span className="dash-workflow-pill dash-workflow-pill--muted">ทางเลือก</span>
                  )}
                  {isPrimary && !isActive && (
                    <span className="dash-workflow-pill dash-workflow-pill--main">เริ่มที่นี่</span>
                  )}
                </span>
                <span className="dash-workflow-card-icon" aria-hidden>{step.icon}</span>
                <span className="dash-workflow-card-tab">{step.tabLabel}</span>
                <span className="dash-workflow-card-action">{step.action}</span>
                <span className="dash-workflow-card-desc">{step.desc}</span>
                {isPrimary && onAddTransaction && (
                  <span
                    className="dash-workflow-card-cta"
                    onClick={(e) => {
                      e.stopPropagation()
                      onAddTransaction()
                    }}
                    onKeyDown={(e) => e.stopPropagation()}
                    role="presentation"
                  >
                    + บันทึก Transaction
                  </span>
                )}
              </button>
            </div>
          )
        })}
      </div>

      <div className="dash-workflow-meta">
        <button
          type="button"
          className="dash-workflow-extra"
          onClick={() => onGoTab?.(WORKFLOW_EXTRA.key)}
        >
          <span aria-hidden>{WORKFLOW_EXTRA.icon}</span>
          <span>
            <strong>{WORKFLOW_EXTRA.tabLabel}</strong>
            <span className="dash-workflow-extra-desc"> — {WORKFLOW_EXTRA.desc}</span>
          </span>
        </button>
        {here && (
          <p className="dash-workflow-view">
            <span aria-hidden>{here.icon}</span>
            <strong>{here.title}</strong> — {here.desc}
            <span className="dash-workflow-pill dash-workflow-pill--here">คุณอยู่ที่นี่</span>
          </p>
        )}
        {!here && compact && (
          <p className="dash-workflow-view dash-workflow-view--muted">
            <span aria-hidden>📊</span>
            <strong>Overview / Report</strong> — ดูภาพรวมและสรุปพอร์ต
          </p>
        )}
      </div>
    </div>
  )
}
