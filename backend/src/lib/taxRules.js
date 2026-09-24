/** Thai personal-tax assumptions for the estimate tab. Reviewed September 2026 (2569). */

export const RULES_AS_OF = '2026-09'

/** Por. 161/2566 applies to foreign income arising on or after this date. Por. 162/2566 leaves earlier income out. */
export const FOREIGN_INCOME_CUTOFF = '2024-01-01'

export const RESIDENCE_DAYS = 180

export const THAI_DIVIDEND_WHT = 0.1

/** Illustrative withholding rates, not a treaty-credit calculation. */
export const DIVIDEND_WHT = {
  US: { withW8ben: 0.15, withoutW8ben: 0.3 },
  HK: { withW8ben: 0, withoutW8ben: 0 },
  CN: { withW8ben: 0.1, withoutW8ben: 0.1 },
  SZ: { withW8ben: 0.1, withoutW8ben: 0.1 },
}

/** Progressive bands applied to the estimate before expenses and allowances. */
export const PIT_BANDS = [
  { upTo: 150000, rate: 0 },
  { upTo: 300000, rate: 0.05 },
  { upTo: 500000, rate: 0.1 },
  { upTo: 750000, rate: 0.15 },
  { upTo: 1000000, rate: 0.2 },
  { upTo: 2000000, rate: 0.25 },
  { upTo: 5000000, rate: 0.3 },
  { upTo: Infinity, rate: 0.35 },
]

export const RD_FTC_GUIDE_URL = 'https://www.rd.go.th/fileadmin/user_upload/porphor/GuideTaxFromAbroad.pdf'

export const TAX_DISCLAIMER =
  'ตัวเลขนี้เป็นฐานโดยประมาณจากธุรกรรมที่บันทึกไว้ เพื่อใช้ทบทวนก่อนคุยกับผู้เชี่ยวชาญภาษี ไม่ใช่ภาษีที่ต้องจ่ายตามแบบ ภ.ง.ด.90 และไม่ใช่คำแนะนำภาษี'

export const BRACKET_NOTE =
  'ภาษีขั้นบันไดก่อนหักค่าใช้จ่ายและค่าลดหย่อน จึงไม่ใช่ยอดที่ต้องจ่าย'

export function dividendWhtRate(market, w8ben) {
  const row = DIVIDEND_WHT[market]
  if (!row) return 0
  return w8ben ? row.withW8ben : row.withoutW8ben
}

export function roundMoney(value) {
  const n = Number(value)
  if (!Number.isFinite(n)) return 0
  return Math.round((n + Number.EPSILON) * 100) / 100
}

export function progressiveTaxBeforeAllowances(assessable) {
  const income = Math.max(0, Number(assessable) || 0)
  let tax = 0
  let prev = 0
  for (const band of PIT_BANDS) {
    const top = band.upTo
    const slice = Math.min(income, top) - prev
    if (slice > 0) tax += slice * band.rate
    if (income <= top) break
    prev = top
  }
  return roundMoney(tax)
}
