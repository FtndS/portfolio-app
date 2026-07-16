import { forwardRef, useState, useEffect, useRef, useImperativeHandle } from 'react'
import { fmtDate, isoDate, parseDateInput, maskDateInput } from '../../lib/format'

const DateInput = forwardRef(function DateInput(
  { value, onChange, style = {}, placeholder = 'DD/MM/YYYY' },
  ref,
) {
  const iso = isoDate(value)
  const [text, setText] = useState(() => (iso ? fmtDate(iso) : ''))
  const [invalid, setInvalid] = useState(false)
  const pickerRef = useRef(null)
  const skipSyncRef = useRef(false)
  const pickerOpeningRef = useRef(false)

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

  const clearDate = () => {
    setInvalid(false)
    setText('')
    skipSyncRef.current = true
    onChange('')
  }

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

  const markPickerOpening = () => {
    pickerOpeningRef.current = true
  }

  const handleTextBlur = () => {
    if (pickerOpeningRef.current) {
      pickerOpeningRef.current = false
      return
    }
    commit(text)
  }

  const openNativePicker = (e) => {
    const el = e.currentTarget
    // Reset native value briefly so choosing "Today" / the same day fires onChange.
    // Keep React `value={iso||''}` in sync on the next render after apply/clear.
    const previous = iso || ''
    try {
      el.value = ''
    } catch {
      /* ignore */
    }
    try {
      if (typeof el.showPicker === 'function') el.showPicker()
    } catch {
      /* overlay click opens picker in most browsers */
    }
    // If the user dismisses without choosing, restore previous DOM value.
    const restoreIfCancelled = () => {
      if (!el.value && previous) {
        try {
          el.value = previous
        } catch {
          /* ignore */
        }
      }
      el.removeEventListener('blur', restoreIfCancelled)
    }
    el.addEventListener('blur', restoreIfCancelled)
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
          onBlur={handleTextBlur}
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
        <label className="dash-date-input-picker">
          <input
            ref={pickerRef}
            type="date"
            className="dash-date-input-native-overlay"
            value={iso || ''}
            onMouseDown={markPickerOpening}
            onClick={openNativePicker}
            onChange={(e) => {
              const next = e.target.value
              if (!next) {
                clearDate()
                return
              }
              applyIso(next)
            }}
            aria-label="เลือกจากปฏิทิน"
          />
          <span className="dash-date-input-picker-icon" aria-hidden>📅</span>
        </label>
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
