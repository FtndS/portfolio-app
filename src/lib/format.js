export function fmtPct(pct) {
  const n = Number(pct)
  if (!Number.isFinite(n)) return '—'
  return `${n >= 0 ? '+' : ''}${n.toFixed(2)}%`
}

export const MASKED = '••••'
