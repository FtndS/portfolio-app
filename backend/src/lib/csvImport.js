import { storageTicker } from './ticker.js'

const MAX_ROWS = 500

const COLUMN_ALIASES = {
  date: ['date', 'วันที่', 'transaction date', 'trade date'],
  ticker: ['ticker', 'symbol', 'stock', 'ชื่อย่อ', 'หุ้น'],
  type: ['type', 'side', 'action', 'ประเภท', 'buy/sell'],
  shares: ['shares', 'share', 'quantity', 'qty', 'amount', 'จำนวน', 'จำนวนหุ้น'],
  price: ['price', 'ราคา', 'price per share', 'unit price', 'ราคาต่อหุ้น'],
  currency: ['currency', 'ccy', 'สกุลเงิน', 'curr'],
  note: ['note', 'notes', 'memo', 'หมายเหตุ', 'description', 'remark'],
}

function normalizeHeader(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

function detectDelimiter(line) {
  const commas = (line.match(/,/g) || []).length
  const semis = (line.match(/;/g) || []).length
  return semis > commas ? ';' : ','
}

function parseCsvLine(line, delimiter) {
  const cells = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
      continue
    }
    if (!inQuotes && ch === delimiter) {
      cells.push(current.trim())
      current = ''
      continue
    }
    current += ch
  }
  cells.push(current.trim())
  return cells
}

function looksLikeHeader(cells) {
  const joined = cells.map(normalizeHeader).join(' ')
  return COLUMN_ALIASES.date.some((k) => joined.includes(k))
    || COLUMN_ALIASES.ticker.some((k) => joined.includes(k))
}

function mapHeaders(headerCells) {
  const map = {}
  headerCells.forEach((raw, index) => {
    const h = normalizeHeader(raw)
    for (const [field, aliases] of Object.entries(COLUMN_ALIASES)) {
      if (aliases.includes(h)) map[field] = index
    }
  })
  return map
}

function parseDate(value) {
  const raw = String(value || '').trim()
  if (!raw) return null

  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw

  const dmy = raw.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/)
  if (dmy) {
    const a = parseInt(dmy[1], 10)
    const b = parseInt(dmy[2], 10)
    const year = dmy[3]
    // Prefer DD/MM/YYYY (Thai/EU); if first part > 12 treat as day
    const day = a > 12 ? a : b > 12 ? b : a
    const month = a > 12 ? b : b > 12 ? a : b
    return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  }

  const dt = new Date(raw)
  if (!Number.isNaN(dt.getTime())) {
    return dt.toISOString().split('T')[0]
  }
  return null
}

function parseType(value) {
  const raw = String(value || '').trim().toUpperCase()
  if (['BUY', 'B', 'ซื้อ'].includes(raw)) return 'BUY'
  if (['SELL', 'S', 'ขาย'].includes(raw)) return 'SELL'
  return null
}

function parseNumber(value) {
  const raw = String(value ?? '').trim().replace(/,/g, '')
  if (!raw) return null
  const n = parseFloat(raw)
  return Number.isFinite(n) ? n : null
}

function rowFromCells(cells, colMap, lineNo, defaultCurrency) {
  const get = (field) => {
    const idx = colMap[field]
    return idx == null ? '' : (cells[idx] ?? '')
  }

  const errors = []
  const date = parseDate(get('date'))
  const ticker = String(get('ticker') || '').trim().toUpperCase()
  const type = parseType(get('type'))
  const shares = parseNumber(get('shares'))
  const price = parseNumber(get('price'))
  const currencyRaw = String(get('currency') || defaultCurrency || 'USD').trim().toUpperCase()
  const currency = ['USD', 'THB', 'HKD', 'CNY'].includes(currencyRaw) ? currencyRaw : null
  const note = String(get('note') || '').trim() || null

  if (!date) errors.push('วันที่ไม่ถูกต้อง')
  if (!ticker) errors.push('ต้องระบุ Ticker')
  if (!type) errors.push('ประเภทต้องเป็น BUY หรือ SELL')
  if (!(shares > 0)) errors.push('จำนวนหุ้นต้องมากกว่า 0')
  if (!(price > 0)) errors.push('ราคาต้องมากกว่า 0')
  if (!currency) errors.push('สกุลเงินต้องเป็น USD, THB, HKD หรือ CNY')

  const row = {
    line: lineNo,
    date,
    ticker,
    type,
    shares,
    price,
    currency,
    note,
    total: shares && price ? shares * price : null,
    errors,
    valid: errors.length === 0,
  }

  if (row.valid) {
    row.ticker = storageTicker(ticker, null, currency)
  }

  return row
}

export function parseTransactionCsv(text, { defaultCurrency = 'USD' } = {}) {
  const cleaned = String(text || '').replace(/^\uFEFF/, '').trim()
  if (!cleaned) {
    return { rows: [], validRows: [], errors: [{ line: 0, message: 'ไฟล์ว่างเปล่า' }] }
  }

  const lines = cleaned.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  if (!lines.length) {
    return { rows: [], validRows: [], errors: [{ line: 0, message: 'ไม่พบข้อมูล' }] }
  }

  const delimiter = detectDelimiter(lines[0])
  const firstCells = parseCsvLine(lines[0], delimiter)
  const hasHeader = looksLikeHeader(firstCells)
  const colMap = hasHeader
    ? mapHeaders(firstCells)
    : { date: 0, ticker: 1, type: 2, shares: 3, price: 4, currency: 5, note: 6 }

  const required = ['date', 'ticker', 'type', 'shares', 'price']
  const missingCols = required.filter((f) => colMap[f] == null)
  if (missingCols.length) {
    return {
      rows: [],
      validRows: [],
      errors: [{
        line: 1,
        message: `ไม่พบคอลัมน์: ${missingCols.join(', ')} (ต้องมี date, ticker, type, shares, price)`,
      }],
    }
  }

  const dataLines = hasHeader ? lines.slice(1) : lines
  if (dataLines.length > MAX_ROWS) {
    return {
      rows: [],
      validRows: [],
      errors: [{ line: 0, message: `นำเข้าได้สูงสุด ${MAX_ROWS} รายการต่อครั้ง` }],
    }
  }

  const rows = dataLines.map((line, i) => {
    const lineNo = hasHeader ? i + 2 : i + 1
    const cells = parseCsvLine(line, delimiter)
    return rowFromCells(cells, colMap, lineNo, defaultCurrency)
  })

  const validRows = rows.filter((r) => r.valid)
  const errors = rows
    .filter((r) => !r.valid)
    .map((r) => ({ line: r.line, message: r.errors.join('; ') }))

  return { rows, validRows, errors, total: rows.length, validCount: validRows.length }
}
