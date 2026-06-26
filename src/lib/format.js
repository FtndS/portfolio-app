export function fmtPct(pct) {
  const n = Number(pct)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export const MASKED = '••••'

/** Normalize API/DB date to YYYY-MM-DD (storage & comparisons). */
export function isoDate(value) {
  if (!value) return ''
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return ''
    return value.toISOString().split('T')[0]
  }
  const s = String(value).trim()
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  return s.split('T')[0]
}

/** Display date as DD/MM/YYYY (Thai/EU). */
export function fmtDate(value) {
  const iso = isoDate(value)
  const m = iso.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (!m) return iso || String(value ?? '')
  return `${m[3]}/${m[2]}/${m[1]}`
}

export function todayIso() {
  return new Date().toISOString().split('T')[0]
}
