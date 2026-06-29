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

/** Parse DD/MM/YYYY, DD-MM-YYYY, or YYYY-MM-DD → YYYY-MM-DD (empty if invalid). */
export function parseDateInput(value) {
  if (!value) return ''
  const s = String(value).trim()

  const iso = s.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (iso) {
    const y = parseInt(iso[1], 10)
    const mo = parseInt(iso[2], 10)
    const d = parseInt(iso[3], 10)
    if (isValidYmd(y, mo, d)) return iso[0]
    return ''
  }

  const dmy = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (dmy) {
    const d = parseInt(dmy[1], 10)
    const mo = parseInt(dmy[2], 10)
    const y = parseInt(dmy[3], 10)
    if (!isValidYmd(y, mo, d)) return ''
    return `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
  }

  return ''
}

function isValidYmd(year, month, day) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

export function todayIso() {
  return new Date().toISOString().split('T')[0]
}
