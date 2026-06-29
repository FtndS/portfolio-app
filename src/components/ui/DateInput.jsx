import { useState, useEffect } from 'react'
import { fmtDate, isoDate, parseDateInput } from '../../lib/format'

export default function DateInput({ value, onChange, style, placeholder = 'DD/MM/YYYY' }) {
  const iso = isoDate(value)
  const [text, setText] = useState(() => (iso ? fmtDate(iso) : ''))
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    const next = isoDate(value)
    setText(next ? fmtDate(next) : '')
    setInvalid(false)
  }, [value])

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
    setInvalid(false)
    setText(fmtDate(parsed))
    if (parsed !== iso) onChange(parsed)
  }

  return (
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
      style={{
        ...style,
        borderColor: invalid ? 'var(--loss)' : style?.borderColor,
      }}
      aria-invalid={invalid || undefined}
    />
  )
}
