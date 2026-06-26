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

/** Main user journey — tab names match the nav bar exactly. */
export const WORKFLOW_STEPS = [
  {
    key: 'transactions',
    icon: '✏️',
    tabLabel: 'Transactions',
    action: 'ซื้อ / ขายหุ้น',
    primary: true,
    optional: false,
    desc: 'บันทึก BUY/SELL หรือ Import CSV',
  },
  {
    key: 'journal',
    icon: '📓',
    tabLabel: 'Journal',
    action: 'บันทึกเหตุผล',
    primary: false,
    optional: true,
    desc: 'ทำไมถึงซื้อ/ขาย — แนะนำหลังเทรด',
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
  tabLabel: 'Holdings',
  action: 'แก้ยอดตรงๆ',
  desc: 'ใช้เฉพาะกรณีพิเศษ — ส่วนใหญ่ไม่ต้อง',
}

export const WORKFLOW_VIEWS = [
  { key: 'overview', icon: '📊', title: 'Overview', desc: 'ดูกราฟและภาพรวมพอร์ต' },
  { key: 'report', icon: '📄', title: 'Report', desc: 'สรุปพอร์ต / พิมพ์ PDF' },
]
