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

export const WORKFLOW_STEPS = [
  {
    key: 'transactions',
    icon: '✏️',
    title: 'ซื้อ / ขายหุ้น',
    tab: 'Transactions',
    primary: true,
    desc: 'จุดเริ่มหลัก — บันทึก BUY/SELL หรือ Import CSV แล้วพอร์ตจะอัปเดตเอง',
  },
  {
    key: 'journal',
    icon: '📓',
    title: 'Journal',
    tab: 'Journal',
    primary: false,
    desc: 'หลังเทรด — บันทึกเหตุผลว่าทำไมซื้อ/ขาย (แนะนำ ไม่บังคับ)',
  },
  {
    key: 'dividends',
    icon: '💰',
    title: 'ปันผล',
    tab: 'ปันผล',
    primary: false,
    desc: 'เมื่อได้รับเงินปันผลเข้าบัญชี — ไม่ใช่การซื้อขายหุ้น',
  },
  {
    key: 'holdings',
    icon: '⚙️',
    title: 'Holdings',
    tab: 'Holdings',
    primary: false,
    desc: 'แก้ไขยอดตรงๆ — ใช้เฉพาะกรณีพิเศษ (ส่วนใหญ่ไม่ต้อง)',
  },
]

export const WORKFLOW_VIEWS = [
  { key: 'overview', icon: '📊', title: 'Overview / Report', desc: 'ดูภาพรวม กราฟ และสรุปพอร์ต' },
]
