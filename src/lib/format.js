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

/** Auto-insert slashes while typing DD/MM/YYYY (digits only, max 8). */
export function maskDateInput(value) {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8)
  if (digits.length <= 2) return digits
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
}

function isValidYmd(year, month, day) {
  if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) return false
  const dt = new Date(year, month - 1, day)
  return dt.getFullYear() === year && dt.getMonth() === month - 1 && dt.getDate() === day
}

export function todayIso() {
  return new Date().toISOString().split('T')[0]
}

const REPORT_MONTH_ABBR = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Default PDF filename when printing a report (browser uses document.title). */
export function reportPdfBasename({ scope, portName }) {
  const d = new Date()
  const dateStr = `${String(d.getDate()).padStart(2, '0')}-${REPORT_MONTH_ABBR[d.getMonth()]}-${d.getFullYear()}`
  const safe = String(portName || '')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, ' ')
    .slice(0, 80)
  const label = scope === 'all' ? 'ทุกพอร์ตรวม' : (safe || 'พอร์ต')
  return `PortDiary - ${label} ${dateStr}`
}

/** Max decimal places stored for share quantities. */
export const SHARES_DECIMALS = 10

/** Treat share balances below this as zero (dust). */
export const SHARES_EPS = 1e-9

export function fmtShares(n) {
  const x = Number(n)
  if (!Number.isFinite(x)) return '—'
  return x.toLocaleString('en-US', { maximumFractionDigits: SHARES_DECIMALS })
}

/** Compact axis labels for charts (avoids clipping long values like ฿1,087,542). */
export function fmtChartAxis(n, sym = '', { hideValues = false } = {}) {
  if (hideValues) return MASKED
  const v = Number(n)
  if (!Number.isFinite(v)) return '—'
  const abs = Math.abs(v)
  if (abs >= 1_000_000) {
    const m = v / 1_000_000
    const maxFrac = abs >= 10_000_000 ? 1 : 2
    return `${sym}${m.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: maxFrac })}M`
  }
  if (abs >= 10_000) {
    return `${sym}${(v / 1_000).toLocaleString('en-US', { maximumFractionDigits: 0 })}K`
  }
  return `${sym}${v.toLocaleString('en-US', { maximumFractionDigits: 0 })}`
}
