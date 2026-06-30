import { describe, it, expect } from 'vitest'
import { attachPerformancePct } from '../src/lib/portfolioHistory.js'
import { inferPortfolioCurrency } from '../src/lib/currency.js'

describe('attachPerformancePct', () => {
  it('ignores net deposits when computing return', () => {
    const points = [
      { date: '2025-01-01', total_value: 400000 },
      { date: '2025-01-15', total_value: 900000 },
      { date: '2025-02-01', total_value: 918000 },
    ]
    const txs = [
      { type: 'BUY', shares: 1000, price: 500, fee: 0, date: '2025-01-15' },
    ]
    const out = attachPerformancePct(points, txs)
    expect(out[1].performance_pct).toBe(0)
    expect(out[2].performance_pct).toBeCloseTo(2, 1)
  })

  it('tracks price gains without buys', () => {
    const points = [
      { date: '2025-01-01', total_value: 100000 },
      { date: '2025-02-01', total_value: 110000 },
    ]
    const out = attachPerformancePct(points, [])
    expect(out[1].performance_pct).toBeCloseTo(10, 2)
  })
})

describe('inferPortfolioCurrency', () => {
  it('prefers dominant holding currency over stale portfolio row', () => {
    const ccy = inferPortfolioCurrency('USD', [
      { currency: 'THB' },
      { currency: 'THB' },
    ])
    expect(ccy).toBe('THB')
  })
})
