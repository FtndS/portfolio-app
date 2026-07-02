/** Build journal prefill after a new BUY/SELL transaction. */
export function journalDraftFromTransaction(tx) {
  if (!tx?.ticker) return null
  const isBuy = tx.type === 'BUY'
  const tag = isBuy ? 'ซื้อ' : 'ขาย'
  const verb = isBuy ? 'ซื้อ' : 'ขาย'
  const date = tx.date?.split('T')[0] || tx.date || new Date().toISOString().split('T')[0]
  return {
    title: `${verb} ${tx.ticker}`,
    tickers: tx.ticker,
    tag,
    date,
    content: '',
    transactionId: tx.id,
  }
}

export function journalPromptKey(userId) {
  return `journal_prompt_after_tx_${userId}`
}

/** Whether to show journal modal after a new transaction (default: yes). */
export function isJournalPromptEnabled(userId) {
  if (!userId) return true
  return !localStorage.getItem(journalPromptKey(userId))
}

export function dismissJournalPrompt(userId) {
  if (userId) localStorage.setItem(journalPromptKey(userId), '1')
}

/** Main user journey — tab names match the nav bar exactly. */
export const WORKFLOW_STEPS = [
  {
    key: 'transactions',
    icon: '✏️',
    tabLabel: 'ซื้อ/ขาย',
    action: 'บันทึกซื้อ / ขายหุ้น',
    primary: true,
    optional: false,
    desc: 'กรอกแค่รหัสหุ้น จำนวน ราคา — หรือ Import CSV',
  },
  {
    key: 'journal',
    icon: '📓',
    tabLabel: 'บันทึกเหตุผล',
    action: 'เขียนเหตุผลทีหลัง',
    primary: false,
    optional: true,
    desc: 'ทำไมถึงซื้อ/ขาย — ไม่บังคับ',
  },
  {
    key: 'dividends',
    icon: '💰',
    tabLabel: 'ปันผล',
    action: 'รับเงินปันผล',
    primary: false,
    optional: false,
    desc: 'เมื่อเงินปันผลเข้าบัญชี',
  },
]

export const WORKFLOW_EXTRA = {
  key: 'holdings',
  icon: '⚙️',
  tabLabel: 'หุ้นที่ถือ',
  action: 'แก้ยอดตรงๆ',
  desc: 'ใช้เฉพาะกรณีพิเศษ — ส่วนใหญ่ไม่ต้อง',
}

export const WORKFLOW_VIEWS = [
  { key: 'overview', icon: '📊', title: 'ภาพรวม', desc: 'ดูกราฟและมูลค่าพอร์ต' },
  { key: 'report', icon: '📄', title: 'รายงาน', desc: 'สรุปพอร์ต / พิมพ์ PDF' },
]
