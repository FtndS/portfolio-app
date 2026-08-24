import { useEffect, useId, useRef, useState } from 'react'
import './NavMegaMenu.css'

export function suiteAppSections({ onHub, onStock, onTrip } = {}) {
  return [
    {
      heading: 'ลงทุน',
      items: [
        onHub && {
          id: 'hub',
          icon: '🏠',
          title: 'Hub',
          hint: 'เลือกแอปจากบัญชีเดียว',
          onSelect: onHub,
        },
        {
          id: 'stock',
          icon: '📈',
          title: 'PortDiary Stock',
          hint: 'พอร์ต รายงาน journal และ AI',
          onSelect: onStock,
        },
      ].filter(Boolean),
    },
    {
      heading: 'ท่องเที่ยว',
      items: [
        {
          id: 'trip',
          icon: '✈️',
          title: 'Trip Planner',
          hint: 'แผนเที่ยว ที่พัก ร้านอาหาร และการเดินทาง',
          onSelect: onTrip,
        },
      ],
    },
  ]
}

export default function NavMegaMenu({
  label = 'แอป',
  sections = [],
  align = 'center',
}) {
  const [open, setOpen] = useState(false)
  const wrapRef = useRef(null)
  const closeTimer = useRef(null)
  const menuId = useId()

  const clearClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current)
      closeTimer.current = null
    }
  }

  const scheduleClose = () => {
    clearClose()
    closeTimer.current = setTimeout(() => setOpen(false), 120)
  }

  const canHover = () =>
    typeof window !== 'undefined' && window.matchMedia('(hover: hover) and (pointer: fine)').matches

  useEffect(() => () => clearClose(), [])

  useEffect(() => {
    if (!open) return undefined
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDoc = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDoc)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDoc)
    }
  }, [open])

  return (
    <div
      className={`nav-mega${open ? ' is-open' : ''} nav-mega--${align}`}
      ref={wrapRef}
      onMouseEnter={() => {
        if (!canHover()) return
        clearClose()
        setOpen(true)
      }}
      onFocusCapture={() => setOpen(true)}
      onBlurCapture={(e) => {
        if (!wrapRef.current?.contains(e.relatedTarget)) setOpen(false)
      }}
      onMouseLeave={() => {
        if (!canHover()) return
        scheduleClose()
      }}
    >
      <button
        type="button"
        className="nav-mega-trigger"
        aria-expanded={open}
        aria-controls={menuId}
        aria-haspopup="true"
        onClick={() => {
          clearClose()
          setOpen((v) => !v)
        }}
      >
        {label}
        <span className="nav-mega-chevron" aria-hidden>▾</span>
      </button>
      <div className="nav-mega-panel" id={menuId} role="menu">
        {sections.map((section) => (
          <div key={section.heading} className="nav-mega-col">
            <p className="nav-mega-heading">{section.heading}</p>
            {section.href && (
              <a className="nav-mega-all" href={section.href}>
                {section.allLabel || 'ดูทั้งหมด →'}
              </a>
            )}
            {section.items.map((item) => (
              <button
                key={item.id}
                type="button"
                className="nav-mega-item"
                role="menuitem"
                onClick={() => {
                  setOpen(false)
                  item.onSelect?.()
                }}
              >
                <span className="nav-mega-item-icon" aria-hidden>{item.icon}</span>
                <span>
                  <strong>{item.title}</strong>
                  {item.hint && <span className="nav-mega-item-hint">{item.hint}</span>}
                </span>
              </button>
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
