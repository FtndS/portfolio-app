import { inp } from '../../lib/styles'

export default function OtpInput({ value, onChange, onKeyDown }) {
  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="one-time-code"
      maxLength={6}
      style={{ ...inp(), letterSpacing: '0.35em', textAlign: 'center', fontSize: '22px', fontWeight: 600 }}
      placeholder="000000"
      value={value}
      onChange={(e) => onChange(e.target.value.replace(/\D/g, '').slice(0, 6))}
      onKeyDown={onKeyDown}
    />
  )
}