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
    if (pickerRef.current) {
      pickerRef.current.value = next || ''
    }
  }, [value])

  const clearDate = () => {
    setInvalid(false)
    setText('')
    skipSyncRef.current = true
    if (pickerRef.current) pickerRef.current.value = ''
    onChange('')
  }

  const applyIso = (parsed) => {
    const normalized = isoDate(parsed)
    if (!normalized) return null
    setInvalid(false)
    setText(fmtDate(normalized))
    if (pickerRef.current) pickerRef.current.value = normalized
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

  const handleNativePickerChange = (e) => {
    const next = e.target.value
    if (!next) {
      clearDate()
      return
    }
    applyIso(next)
  }

  const openNativePicker = (e) => {
    markPickerOpening()
    const el = e.currentTarget
    // Keep the current value in the native input so the picker's "Clear" can
    // transition from a real date → empty and fire change/input events.
    try {
      el.value = iso || ''
    } catch {
      /* ignore */
    }
    try {
      if (typeof el.showPicker === 'function') el.showPicker()
    } catch {
      /* overlay click opens picker in most browsers */
    }
  }

  const handleNativePickerBlur = () => {
    pickerOpeningRef.current = false
  }

  const hasValue = !!(text.trim() || iso)

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
        {hasValue && (
          <button
            type="button"
            className="dash-date-input-clear"
            onClick={clearDate}
            aria-label="ล้างวันที่"
            title="ล้างวันที่"
          >
            ×
          </button>
        )}
        <label className="dash-date-input-picker">
          <input
            ref={pickerRef}
            type="date"
            className="dash-date-input-native-overlay"
            defaultValue={iso || ''}
            onMouseDown={markPickerOpening}
            onClick={openNativePicker}
            onChange={handleNativePickerChange}
            onInput={(e) => {
              if (!e.currentTarget.value) clearDate()
            }}
            onBlur={handleNativePickerBlur}
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
