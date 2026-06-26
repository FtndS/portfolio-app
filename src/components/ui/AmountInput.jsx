import { inp } from '../../lib/styles'

export default function AmountInput({
  prefix,
  suffix,
  placeholder,
  value,
  onChange,
  type = 'number',
  min,
  nonNegative = false,
}) {
  const handleChange = (e) => {
    let v = e.target.value
    if (nonNegative) v = v.replace(/-/g, '')
    onChange({ ...e, target: { ...e.target, value: v } })
  }

  const blockMinus = (e) => {
    if (nonNegative && (e.key === '-' || e.key === 'e' || e.key === 'E')) e.preventDefault()
  }

  return (
    <div className="amount-input">
      {prefix && <span className="amount-input-affix">{prefix}</span>}
      <input
        type={type}
        placeholder={placeholder || '0.00'}
        value={value}
        onChange={handleChange}
        onKeyDown={blockMinus}
        min={nonNegative ? 0 : min}
        step="any"
        className="amount-input-field"
      />
      {suffix && <span className="amount-input-affix amount-input-affix--suffix">{suffix}</span>}
    </div>
  )
}
