import { useState, useEffect, useRef } from 'react'
import { fmtDate, isoDate, parseDateInput, todayIso } from '../../lib/format'

export default function DateInput({ value, onChange, style = {}, placeholder = 'DD/MM/YYYY' }) {
  const iso = isoDate(value)
  const [text, setText] = useState(() => (iso ? fmtDate(iso) : ''))
  const [invalid, setInvalid] = useState(false)
  const pickerRef = useRef(null)

  const { marginBottom, width, ...inputStyle } = style

  useEffect(() => {
    const next = isoDate(value)
    setText(next ? fmtDate(next) : '')
    setInvalid(false)
  }, [value])

  const applyIso = (parsed) => {
    const normalized = isoDate(parsed)
    if (!normalized) return
    setInvalid(false)
    setText(fmtDate(normalized))
    if (normalized !== iso) onChange(normalized)
  }

  const commit = (raw) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setInvalid(true)
      return
    }
    const parsed = parseDateInput(trimmed)
    if (!parsed) {
      setInvalid(true)
      return
    }
    applyIso(parsed)
  }

  const openPicker = () => {
    const el = pickerRef.current
    if (!el) return
    el.value = iso || todayIso()
    try {
      if (typeof el.showPicker === 'function') el.showPicker()
      else el.click()
    } catch {
      el.click()
    }
  }

  return (
    <div
      className="dash-date-input"
      style={{
        width: width ?? '100%',
        marginBottom,
      }}
    >
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder={placeholder}
        value={text}
        onChange={(e) => {
          setText(e.target.value)
          setInvalid(false)
        }}
        onBlur={() => commit(text)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') commit(text)
        }}
        className="dash-date-input-text"
        style={{
          ...inputStyle,
          width: undefined,
          marginBottom: 0,
          borderColor: invalid ? 'var(--loss)' : inputStyle.borderColor,
        }}
        aria-invalid={invalid || undefined}
      />
      <button
        type="button"
        className="dash-date-input-picker"
        onMouseDown={(e) => e.preventDefault()}
        onClick={openPicker}
        title="เลือกจากปฏิทิน"
        aria-label="เลือกจากปฏิทิน"
      >
        <span className="dash-date-input-picker-icon" aria-hidden>📅</span>
      </button>
      <input
        ref={pickerRef}
        type="date"
        className="dash-date-input-native-hidden"
        value={iso || ''}
        onChange={(e) => {
          if (e.target.value) applyIso(e.target.value)
        }}
        tabIndex={-1}
        aria-hidden
      />
    </div>
  )
}
