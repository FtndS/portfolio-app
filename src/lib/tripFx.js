import { convertWithRates } from './currency.js'

const FX_KEY = 'portdiary-trip-fx'

export const HOME_CURRENCY = 'THB'

export const TRIP_CURRENCIES = [
  { code: 'THB', label: 'บาทไทย', symbol: '฿', yahoo: 'USDTHB=X', invert: false, zeroDecimals: false },
  { code: 'USD', label: 'ดอลลาร์สหรัฐ', symbol: '$', yahoo: null, invert: false, zeroDecimals: false },
  { code: 'JPY', label: 'เยน', symbol: '¥', yahoo: 'USDJPY=X', invert: false, zeroDecimals: true },
  { code: 'EUR', label: 'ยูโร', symbol: '€', yahoo: 'EURUSD=X', invert: true, zeroDecimals: false },
  { code: 'GBP', label: 'ปอนด์', symbol: '£', yahoo: 'GBPUSD=X', invert: true, zeroDecimals: false },
  { code: 'KRW', label: 'วอน', symbol: '₩', yahoo: 'USDKRW=X', invert: false, zeroDecimals: true },
  { code: 'SGD', label: 'ดอลลาร์สิงคโปร์', symbol: 'S$', yahoo: 'USDSGD=X', invert: false, zeroDecimals: false },
  { code: 'MYR', label: 'ริงกิต', symbol: 'RM', yahoo: 'USDMYR=X', invert: false, zeroDecimals: false },
  { code: 'AUD', label: 'ดอลลาร์ออสเตรเลีย', symbol: 'A$', yahoo: 'AUDUSD=X', invert: true, zeroDecimals: false },
  { code: 'CNY', label: 'หยวน', symbol: '¥', yahoo: 'USDCNY=X', invert: false, zeroDecimals: false },
  { code: 'HKD', label: 'ดอลลาร์ฮ่องกง', symbol: 'HK$', yahoo: 'USDHKD=X', invert: false, zeroDecimals: false },
  { code: 'TWD', label: 'ดอลลาร์ไต้หวัน', symbol: 'NT$', yahoo: 'USDTWD=X', invert: false, zeroDecimals: false },
  { code: 'VND', label: 'ดอง', symbol: '₫', yahoo: 'USDVND=X', invert: false, zeroDecimals: true },
  { code: 'IDR', label: 'รูเปียะ', symbol: 'Rp', yahoo: 'USDIDR=X', invert: false, zeroDecimals: true },
  { code: 'PHP', label: 'เปโซ', symbol: '₱', yahoo: 'USDPHP=X', invert: false, zeroDecimals: false },
]

export const FALLBACK_PER_USD = {
  USD: 1,
  THB: 35,
  JPY: 150,
  EUR: 0.92,
  GBP: 0.79,
  KRW: 1350,
  SGD: 1.35,
  MYR: 4.7,
  AUD: 1.55,
  CNY: 7.25,
  HKD: 7.8,
  TWD: 32,
  VND: 25000,
  IDR: 16000,
  PHP: 58,
}

const DEST_HINTS = [
  ['JPY', /japan|osaka|kyoto|tokyo|nagoya|fukuoka|hokkaido|okinawa|ญี่ปุ่น|โอซาก้า|โอซากะ|เกียวโต|โตเกียว|ฮอกไกโด/i],
  ['KRW', /korea|seoul|busan|เกาหลี|โซล|ปูซาน/i],
  ['EUR', /france|paris|italy|rome|germany|berlin|spain|madrid|netherlands|amsterdam|ยุโรป|ฝรั่งเศส|อิตาลี|เยอรมน|สเปน/i],
  ['GBP', /london|england|uk\b|united kingdom|britain|อังกฤษ|ลอนดอน/i],
  ['SGD', /singapore|สิงคโปร์/i],
  ['MYR', /malaysia|kuala|kl\b|มาเลเซีย|กัวลา/i],
  ['AUD', /australia|sydney|melbourne|ออสเตรเลีย|ซิดนีย์/i],
  ['CNY', /china|beijing|shanghai|จีน|ปักกิ่ง|เซี่ยงไฮ้/i],
  ['HKD', /hong kong|ฮ่องกง/i],
  ['TWD', /taiwan|taipei|ไต้หวัน|ไทเป/i],
  ['VND', /vietnam|hanoi|saigon|โฮจิมินห์|เวียดนาม|ฮานอย/i],
  ['IDR', /indonesia|bali|jakarta|อินโดนีเซีย|บาหลี/i],
  ['PHP', /philippines|manila|ฟิลิปปินส์|มะนิลา/i],
  ['USD', /usa|united states|new york|los angeles|อเมริกา|นิวยอร์ก/i],
]

export function currencyMeta(code) {
  return TRIP_CURRENCIES.find((c) => c.code === code) || TRIP_CURRENCIES[0]
}

export function foreignCurrencyOptions() {
  return TRIP_CURRENCIES.filter((c) => c.code !== HOME_CURRENCY)
}

export function yahooFxTickers() {
  return [...new Set(TRIP_CURRENCIES.map((c) => c.yahoo).filter(Boolean))]
}

export function unitsPerUsdFromQuotes(quotes = {}) {
  const out = { ...FALLBACK_PER_USD }
  for (const c of TRIP_CURRENCIES) {
    if (!c.yahoo) continue
    const price = Number(quotes[c.yahoo])
    if (!price) continue
    out[c.code] = c.invert ? 1 / price : price
  }
  out.USD = 1
  return out
}

export function inferForeignCurrency(text) {
  const s = String(text || '')
  if (!s.trim()) return 'USD'
  for (const [code, re] of DEST_HINTS) {
    if (re.test(s)) return code
  }
  return 'USD'
}

export function loadTripFxPrefs() {
  try {
    const raw = JSON.parse(localStorage.getItem(FX_KEY) || '{}')
    const foreign = TRIP_CURRENCIES.some((c) => c.code === raw.foreign && c.code !== HOME_CURRENCY)
      ? raw.foreign
      : null
    return {
      foreign,
      inverted: !!raw.inverted,
      bufferPct: [0, 10, 15, 20].includes(Number(raw.bufferPct)) ? Number(raw.bufferPct) : 10,
    }
  } catch {
    return { foreign: null, inverted: false, bufferPct: 10 }
  }
}

export function saveTripFxPrefs(prefs) {
  localStorage.setItem(FX_KEY, JSON.stringify({
    foreign: prefs.foreign,
    inverted: !!prefs.inverted,
    bufferPct: prefs.bufferPct,
  }))
}

export function formatTripMoney(amount, code) {
  const meta = currencyMeta(code)
  const n = Number(amount) || 0
  const digits = meta.zeroDecimals ? 0 : 2
  const formatted = n.toLocaleString('th-TH', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })
  return `${meta.symbol}${formatted}`
}

export function convertTripAmount(amount, from, to, unitsPerUsd) {
  return convertWithRates(amount, from, to, unitsPerUsd)
}

export function sumPlaceBudgets(places) {
  return (places || []).reduce((s, p) => {
    const n = Number(p?.budget)
    return s + (Number.isFinite(n) ? n : 0)
  }, 0)
}
