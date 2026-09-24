import { describe, expect, it } from 'vitest'
import { estimateTax } from '../src/lib/taxEstimate.js'
import { progressiveTaxBeforeAllowances } from '../src/lib/taxRules.js'

function usRoundTrip() {
  return [
    { id: 1, portfolio_id: 1, ticker: 'AAPL', type: 'BUY', shares: 10, price: 100, fee: 0, date: '2025-01-01', currency: 'USD' },
    { id: 2, portfolio_id: 1, ticker: 'AAPL', type: 'SELL', shares: 10, price: 150, fee: 0, date: '2025-06-01', currency: 'USD' },
  ]
}

describe('estimateTax', () => {
  it('keeps a SET sale out of the assessable base', () => {
    const result = estimateTax({
      year: 2025,
      transactions: [
        { id: 1, portfolio_id: 1, ticker: 'SCB-BK', type: 'BUY', shares: 10, price: 100, fee: 0, date: '2025-01-01', currency: 'THB' },
        { id: 2, portfolio_id: 1, ticker: 'SCB-BK', type: 'SELL', shares: 10, price: 150, fee: 0, date: '2025-06-01', currency: 'THB' },
      ],
    })
    expect(result.thai.sells).toHaveLength(1)
    expect(result.thai.sells[0].status).toBe('set_exempt')
    expect(result.thai.sells[0].native_amount).toBe(500)
    expect(result.foreign).toHaveLength(0)
    expect(result.base.totalThb).toBe(0)
  })

  it('includes a 2025 US gain remitted in 2026 when resident 200 days in 2025', () => {
    const result = estimateTax({
      year: 2026,
      transactions: usRoundTrip(),
      yearFacts: [{ tax_year: 2025, days_in_thailand: 200, us_w8ben: false }],
      remittances: [{ source_type: 'sell', source_id: 2, remitted_on: '2026-03-01', fx_thb_per_unit: 35 }],
    })
    expect(result.foreign[0].status).toBe('in_base')
    expect(result.foreign[0].amount_thb).toBe(17500)
    expect(result.base.foreignRemittedThb).toBe(17500)
    expect(result.base.totalThb).toBe(17500)
  })

  it('excludes the gain when days in the earning year are under 180', () => {
    const result = estimateTax({
      year: 2026,
      transactions: usRoundTrip(),
      yearFacts: [{ tax_year: 2025, days_in_thailand: 100, us_w8ben: false }],
      remittances: [{ source_type: 'sell', source_id: 2, remitted_on: '2026-03-01', fx_thb_per_unit: 35 }],
    })
    expect(result.foreign[0].status).toBe('not_resident')
    expect(result.base.totalThb).toBe(0)
  })

  it('leaves income from before 2024 out of the base even when remitted later', () => {
    const result = estimateTax({
      year: 2026,
      transactions: [
        { id: 1, portfolio_id: 1, ticker: 'AAPL', type: 'BUY', shares: 10, price: 100, fee: 0, date: '2023-01-01', currency: 'USD' },
        { id: 2, portfolio_id: 1, ticker: 'AAPL', type: 'SELL', shares: 10, price: 150, fee: 0, date: '2023-06-01', currency: 'USD' },
      ],
      yearFacts: [{ tax_year: 2023, days_in_thailand: 200, us_w8ben: false }],
      remittances: [{ source_type: 'sell', source_id: 2, remitted_on: '2026-01-15', fx_thb_per_unit: 35 }],
    })
    expect(result.foreign[0].status).toBe('pre_2024')
    expect(result.foreign[0].amount_thb).toBeNull()
    expect(result.base.totalThb).toBe(0)
  })

  it('uses 15% US dividend withholding with W-8BEN and 30% without', () => {
    const dividends = [{ id: 5, portfolio_id: 1, ticker: 'AAPL', amount: 100, currency: 'USD', pay_date: '2025-06-01' }]
    const remittances = [{ source_type: 'dividend', source_id: 5, remitted_on: '2025-12-01', fx_thb_per_unit: 35 }]
    const withForm = estimateTax({
      year: 2025,
      dividends,
      yearFacts: [{ tax_year: 2025, days_in_thailand: 200, us_w8ben: true }],
      remittances,
    })
    const withoutForm = estimateTax({
      year: 2025,
      dividends,
      yearFacts: [{ tax_year: 2025, days_in_thailand: 200, us_w8ben: false }],
      remittances,
    })
    expect(withForm.foreign[0].wht_rate).toBe(0.15)
    expect(withForm.foreign[0].withheld_native).toBe(15)
    expect(withForm.base.foreignRemittedThb).toBe(3500)
    expect(withoutForm.foreign[0].wht_rate).toBe(0.3)
    expect(withoutForm.foreign[0].withheld_native).toBe(30)
  })

  it('does not convert a remitted gain to THB when the FX rate is missing', () => {
    const result = estimateTax({
      year: 2026,
      transactions: usRoundTrip(),
      yearFacts: [{ tax_year: 2025, days_in_thailand: 200, us_w8ben: false }],
      remittances: [{ source_type: 'sell', source_id: 2, remitted_on: '2026-03-01', fx_thb_per_unit: null }],
    })
    expect(result.foreign[0].status).toBe('needs_fx')
    expect(result.foreign[0].amount_thb).toBeNull()
    expect(result.base.foreignRemittedThb).toBe(0)
    expect(result.incomplete).toHaveLength(1)
  })
})

describe('progressiveTaxBeforeAllowances', () => {
  it('applies 5% only above the first exempt band', () => {
    expect(progressiveTaxBeforeAllowances(200000)).toBe(2500)
  })
})
