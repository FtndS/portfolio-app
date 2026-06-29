import { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react'
import { fmtDate, isoDate, parseDateInput, maskDateInput, todayIso } from '../../lib/format'

const DateInput = forwardRef(function DateInput(
  { value, onChange, style = {}, placeholder = 'DD/MM/YYYY' },
  ref,
) {
  const iso = isoDate(value)
  const [text, setText] = useState(() => (iso ? fmtDate(iso) : ''))
  const [invalid, setInvalid] = useState(false)
  const pickerRef = useRef(null)
  const skipSyncRef = useRef(false)

  const { marginBottom, width, ...inputStyle } = style

  useEffect(() => {
    if (skipSyncRef.current) {
      skipSyncRef.current = false
      return
    }
    const next = isoDate(value)
    setText(next ? fmtDate(next) : '')
    setInvalid(false)
  }, [value])

  const applyIso = (parsed) => {
    const normalized = isoDate(parsed)
    if (!normalized) return null
    setInvalid(false)
    setText(fmtDate(normalized))
    onChange(normalized)
    return normalized
  }

  const commit = (raw = text) => {
    const trimmed = raw.trim()
    if (!trimmed) {
      setInvalid(true)
      skipSyncRef.current = true
      onChange('')
      return null
    }
    const parsed = parseDateInput(trimmed)
    if (!parsed) {
      setInvalid(true)
      skipSyncRef.current = true
      onChange('')
      return null
    }
    return applyIso(parsed)
  }

  useImperativeHandle(ref, () => ({
    commit: () => commit(text),
  }))

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
      className="dash-date-input-wrap"
      style={{
        width: width ?? '100%',
        marginBottom,
      }}
    >
      <div className="dash-date-input">
        <input
          type="text"
          inputMode="numeric"
          autoComplete="off"
          placeholder={placeholder}
          value={text}
          onChange={(e) => {
            setText(maskDateInput(e.target.value))
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
          aria-describedby={invalid ? 'dash-date-input-error' : undefined}
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
      {invalid && (
        <p id="dash-date-input-error" className="dash-date-input-error" role="alert">
          รูปแบบวันที่ผิด กรุณากรอกใหม่ (วัน/เดือน/ปี เช่น 30/04/2025)
        </p>
      )}
    </div>
  )
})

export default DateInput
