import { detectMarket } from './ticker.js'
import {
  BRACKET_NOTE,
  FOREIGN_INCOME_CUTOFF,
  RD_FTC_GUIDE_URL,
  RESIDENCE_DAYS,
  RULES_AS_OF,
  TAX_DISCLAIMER,
  THAI_DIVIDEND_WHT,
  dividendWhtRate,
  progressiveTaxBeforeAllowances,
  roundMoney,
} from './taxRules.js'

const SHARES_EPS = 1e-9
const FOREIGN_MARKETS = new Set(['US', 'HK', 'CN', 'SZ'])

function isoDate(value) {
  if (!value) return ''
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(value).trim()
  const iso = s.match(/^(\d{4}-\d{2}-\d{2})/)
  if (iso) return iso[1]
  return s.split('T')[0]
}

function yearOf(value) {
  const iso = isoDate(value)
  const y = Number(iso.slice(0, 4))
  return Number.isInteger(y) ? y : null
}

function readDays(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isInteger(n) ? n : null
}

function readMoney(value) {
  if (value == null || value === '') return null
  const n = Number(value)
  return Number.isFinite(n) ? n : null
}

function factsByYear(rows) {
  const map = new Map()
  for (const row of rows || []) {
    const year = Number(row.tax_year)
    if (!Number.isInteger(year)) continue
    map.set(year, {
      days: readDays(row.days_in_thailand),
      w8ben: Boolean(row.us_w8ben),
      setDividendMode: row.set_dividend_mode === 'include' ? 'include' : 'final',
      dividendBasis: row.dividend_amount_basis === 'net' ? 'net' : 'gross',
      other: readMoney(row.other_assessable_thb),
    })
  }
  return map
}

function remittanceBySource(rows) {
  const map = new Map()
  for (const row of rows || []) {
    map.set(`${row.source_type}:${Number(row.source_id)}`, row)
  }
  return map
}

function walkSells(transactions) {
  const groups = new Map()
  for (const tx of transactions || []) {
    const pid = Number(tx.portfolio_id) || 0
    if (!groups.has(pid)) groups.set(pid, [])
    groups.get(pid).push(tx)
  }

  const sells = []
  for (const [portfolioId, txs] of groups) {
    const sorted = [...txs].sort((a, b) => {
      const d = isoDate(a.date).localeCompare(isoDate(b.date))
      if (d !== 0) return d
      return (Number(a.id) || 0) - (Number(b.id) || 0)
    })
    const state = {}
    for (const tx of sorted) {
      const ticker = tx.ticker
      const shares = Number(tx.shares)
      const price = Number(tx.price)
      const fee = Number(tx.fee || 0)
      const currency = tx.currency || 'USD'
      if (!state[ticker]) state[ticker] = { shares: 0, avgCost: 0 }
      const prev = state[ticker]
      if (tx.type === 'BUY') {
        const prevCost = prev.shares * prev.avgCost
        const nextShares = prev.shares + shares
        prev.shares = nextShares
        prev.avgCost = nextShares > 0 ? (prevCost + shares * price + fee) / nextShares : 0
        continue
      }
      if (tx.type !== 'SELL') continue
      const proceeds = shares * price - fee
      const gain = proceeds - shares * prev.avgCost
      sells.push({
        source_type: 'sell',
        source_id: Number(tx.id),
        portfolio_id: portfolioId || null,
        ticker,
        market: detectMarket(ticker, currency),
        currency,
        income_date: isoDate(tx.date),
        native_amount: roundMoney(gain),
      })
      prev.shares -= shares
      if (prev.shares <= SHARES_EPS) {
        prev.shares = 0
        prev.avgCost = 0
      }
    }
  }
  return sells
}

function splitRecorded(recorded, rate, basis) {
  const amount = Number(recorded) || 0
  if (basis === 'net') {
    const gross = rate > 0 && rate < 1 ? amount / (1 - rate) : amount
    return { gross: roundMoney(gross), withheld: roundMoney(gross - amount) }
  }
  return { gross: roundMoney(amount), withheld: roundMoney(amount * rate) }
}

function toThb(native, currency, fx) {
  if (currency === 'THB') return roundMoney(native)
  const rate = Number(fx)
  if (!(rate > 0)) return null
  return roundMoney(native * rate)
}

function classifyForeign({ nativeAmount, incomeDate, currency, remittance, earningFact, selectedYear }) {
  if (incomeDate && incomeDate < FOREIGN_INCOME_CUTOFF) {
    return { status: 'pre_2024', amount_thb: null }
  }
  if (nativeAmount < -0.004) {
    return { status: 'loss', amount_thb: null }
  }
  if (!remittance?.remitted_on) {
    return { status: 'not_remitted', amount_thb: null }
  }
  const days = earningFact?.days
  if (days == null) return { status: 'needs_residence', amount_thb: null }
  if (days < RESIDENCE_DAYS) return { status: 'not_resident', amount_thb: null }
  const amountThb = toThb(nativeAmount, currency, remittance.fx_thb_per_unit)
  if (amountThb == null) return { status: 'needs_fx', amount_thb: null }
  if (yearOf(remittance.remitted_on) !== selectedYear) {
    return { status: 'remitted_other_year', amount_thb: amountThb }
  }
  return { status: 'in_base', amount_thb: amountThb }
}

/**
 * Estimate assessable income for one filing year from recorded trades and dividends.
 * Remittance and residence facts come from the caller; missing FX is left unconverted.
 */
export function estimateTax({
  year,
  transactions = [],
  dividends = [],
  yearFacts = [],
  remittances = [],
} = {}) {
  const selectedYear = Number(year)
  const facts = factsByYear(yearFacts)
  const remits = remittanceBySource(remittances)
  const selected = facts.get(selectedYear) || {
    days: null,
    w8ben: false,
    setDividendMode: 'final',
    dividendBasis: 'gross',
    other: null,
  }

  const thaiSells = []
  const foreign = []
  let cryptoSkipped = 0

  for (const sell of walkSells(transactions)) {
    if (sell.market === 'CRYPTO') {
      cryptoSkipped += 1
      continue
    }
    const earningYear = yearOf(sell.income_date)
    if (sell.market === 'SET') {
      if (earningYear !== selectedYear) continue
      thaiSells.push({
        ...sell,
        kind_label: 'กำไรขาย',
        withheld_native: 0,
        wht_rate: 0,
        status: 'set_exempt',
        remitted_on: null,
        fx_thb_per_unit: null,
        amount_thb: sell.currency === 'THB' ? sell.native_amount : null,
        earning_year: earningYear,
      })
      continue
    }
    if (!FOREIGN_MARKETS.has(sell.market)) continue
    const remittance = remits.get(`sell:${sell.source_id}`)
    const classified = classifyForeign({
      nativeAmount: sell.native_amount,
      incomeDate: sell.income_date,
      currency: sell.currency,
      remittance,
      earningFact: facts.get(earningYear),
      selectedYear,
    })
    foreign.push({
      ...sell,
      kind_label: 'กำไรขาย',
      withheld_native: 0,
      wht_rate: 0,
      status: classified.status,
      remitted_on: remittance ? isoDate(remittance.remitted_on) : null,
      fx_thb_per_unit: remittance?.fx_thb_per_unit == null ? null : Number(remittance.fx_thb_per_unit),
      amount_thb: classified.amount_thb,
      earning_year: earningYear,
    })
  }

  const thaiDividends = []
  let dividendWithheldThb = 0
  let dividendIncludedThb = 0

  for (const div of dividends || []) {
    const currency = div.currency || 'THB'
    const market = detectMarket(div.ticker, currency)
    const incomeDate = isoDate(div.pay_date)
    const earningYear = yearOf(incomeDate)
    if (market === 'CRYPTO') {
      cryptoSkipped += 1
      continue
    }
    if (market === 'SET') {
      if (earningYear !== selectedYear) continue
      const rate = THAI_DIVIDEND_WHT
      const split = splitRecorded(div.amount, rate, selected.dividendBasis)
      const included = selected.setDividendMode === 'include' && currency === 'THB'
      const withheldThb = currency === 'THB' ? split.withheld : null
      if (withheldThb != null) dividendWithheldThb = roundMoney(dividendWithheldThb + withheldThb)
      if (included) dividendIncludedThb = roundMoney(dividendIncludedThb + split.gross)
      thaiDividends.push({
        source_type: 'dividend',
        source_id: Number(div.id),
        portfolio_id: Number(div.portfolio_id) || null,
        ticker: div.ticker,
        market,
        currency,
        income_date: incomeDate,
        native_amount: split.gross,
        withheld_native: split.withheld,
        wht_rate: rate,
        status: included ? 'set_dividend_included' : 'set_dividend_final',
        remitted_on: null,
        fx_thb_per_unit: null,
        amount_thb: currency === 'THB' ? split.gross : null,
        earning_year: earningYear,
        kind_label: 'ปันผล',
      })
      continue
    }
    if (!FOREIGN_MARKETS.has(market)) continue
    const earningFact = facts.get(earningYear)
    const rate = dividendWhtRate(market, Boolean(earningFact?.w8ben))
    const split = splitRecorded(div.amount, rate, earningFact?.dividendBasis || 'gross')
    const remittance = remits.get(`dividend:${Number(div.id)}`)
    const classified = classifyForeign({
      nativeAmount: split.gross,
      incomeDate,
      currency,
      remittance,
      earningFact,
      selectedYear,
    })
    foreign.push({
      source_type: 'dividend',
      source_id: Number(div.id),
      portfolio_id: Number(div.portfolio_id) || null,
      ticker: div.ticker,
      market,
      currency,
      income_date: incomeDate,
      native_amount: split.gross,
      withheld_native: split.withheld,
      wht_rate: rate,
      status: classified.status,
      remitted_on: remittance ? isoDate(remittance.remitted_on) : null,
      fx_thb_per_unit: remittance?.fx_thb_per_unit == null ? null : Number(remittance.fx_thb_per_unit),
      amount_thb: classified.amount_thb,
      earning_year: earningYear,
      kind_label: 'ปันผล',
    })
  }

  foreign.sort((a, b) => String(b.income_date).localeCompare(String(a.income_date)) || b.source_id - a.source_id)

  const foreignRemittedThb = roundMoney(
    foreign
      .filter((row) => row.status === 'in_base' && row.amount_thb != null)
      .reduce((sum, row) => sum + row.amount_thb, 0),
  )
  const otherThb = selected.other != null && selected.other > 0 ? roundMoney(selected.other) : 0
  const totalThb = roundMoney(foreignRemittedThb + dividendIncludedThb + otherThb)
  const incomplete = foreign.filter((row) => row.status === 'needs_residence' || row.status === 'needs_fx')

  return {
    year: selectedYear,
    rulesAsOf: RULES_AS_OF,
    disclaimer: TAX_DISCLAIMER,
    ftcGuideUrl: RD_FTC_GUIDE_URL,
    facts: {
      tax_year: selectedYear,
      days_in_thailand: selected.days,
      us_w8ben: selected.w8ben,
      set_dividend_mode: selected.setDividendMode,
      dividend_amount_basis: selected.dividendBasis,
      other_assessable_thb: selected.other,
    },
    thai: {
      sells: thaiSells,
      dividends: thaiDividends,
      dividendWithheldThb: roundMoney(dividendWithheldThb),
      dividendIncludedThb: roundMoney(dividendIncludedThb),
    },
    foreign,
    incomplete,
    cryptoSkipped,
    base: {
      foreignRemittedThb,
      thaiDividendsThb: roundMoney(dividendIncludedThb),
      otherThb,
      totalThb,
    },
    bracket: {
      taxBeforeAllowancesThb: progressiveTaxBeforeAllowances(totalThb),
      note: BRACKET_NOTE,
    },
  }
}
