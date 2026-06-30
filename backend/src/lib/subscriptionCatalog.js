import { AI_PLANS } from './aiPlan.js'

export const PRO_MONTHLY_THB = Number(process.env.PRO_MONTHLY_PRICE_THB) || 99

const FEATURE_ROWS = [
  { key: 'portfolio', label: 'พอร์ต, Transaction, Journal', free: 'ไม่จำกัด', pro: 'ไม่จำกัด' },
  { key: 'analyze', label: 'AI วิเคราะห์พอร์ต', weekly: true },
  { key: 'copilot', label: 'Copilot', weekly: true },
  { key: 'copilotCustom', label: 'ถาม Copilot เอง', free: '—', pro: '✓' },
  { key: 'newsSummary', label: 'AI สรุปข่าว', weekly: true },
  { key: 'tickerJournal', label: 'AI สรุป journal หุ้น', weekly: true },
]

const WEEKLY_KEYS = {
  analyze: 'analyze',
  copilot: 'copilot',
  newsSummary: 'news-summary',
  tickerJournal: 'ticker-journal',
}

export function buildSubscriptionCatalog() {
  const free = AI_PLANS.free
  const pro = AI_PLANS.pro

  const features = FEATURE_ROWS.map((row) => {
    if (row.weekly) {
      const wk = WEEKLY_KEYS[row.key]
      return {
        id: row.key,
        label: row.label,
        free: `${free.weeklyLimit[wk]} ครั้ง/สัปดาห์`,
        pro: `${pro.weeklyLimit[wk]} ครั้ง/สัปดาห์`,
      }
    }
    return { id: row.key, label: row.label, free: row.free, pro: row.pro }
  })

  return {
    proMonthlyThb: PRO_MONTHLY_THB,
    plans: [
      {
        id: 'free',
        label: free.label,
        priceThb: 0,
        priceLabel: 'ฟรี',
        highlight: false,
        features,
      },
      {
        id: 'pro',
        label: pro.label,
        priceThb: PRO_MONTHLY_THB,
        priceLabel: `฿${PRO_MONTHLY_THB}/เดือน`,
        highlight: true,
        features,
      },
    ],
  }
}
