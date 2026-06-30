import { describe, it, expect } from 'vitest'
import {
  attachPerformancePct,
  attachPriceIndexPerformance,
  priceOnDate,
  densifyPriceMap,
} from '../src/lib/portfolioHistory.js'
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

describe('priceOnDate', () => {
  it('does not forward-fill future quotes into past dates', () => {
    const map = { '2025-06-01': 100, '2025-06-02': 110 }
    expect(priceOnDate(map, '2025-05-01', 50)).toBe(50)
    expect(priceOnDate(map, '2025-06-01', 50)).toBe(100)
    expect(priceOnDate(map, '2025-06-03', 50)).toBe(110)
  })
})

describe('densifyPriceMap', () => {
  it('carries last quote forward within range but not before first quote', () => {
    const map = { '2025-06-01': 100, '2025-06-03': 105 }
    const dates = ['2025-05-15', '2025-06-01', '2025-06-02', '2025-06-03']
    const dense = densifyPriceMap(map, dates, 80)
    expect(dense['2025-05-15']).toBe(80)
    expect(dense['2025-06-02']).toBe(100)
    expect(dense['2025-06-03']).toBe(105)
  })
})

describe('attachPriceIndexPerformance', () => {
  it('moves when prices change even if shares were bought mid-period', () => {
    const points = [
      { date: '2025-04-01', total_value: 10000, total_cost: 10000 },
      { date: '2025-04-15', total_value: 20000, total_cost: 20000 },
      { date: '2025-05-01', total_value: 21000, total_cost: 20000 },
    ]
    const txs = [
      { ticker: 'VOO', type: 'BUY', shares: 10, price: 100, fee: 0, date: '2025-04-01' },
      { ticker: 'VOO', type: 'BUY', shares: 10, price: 100, fee: 0, date: '2025-04-15' },
    ]
    const priceMaps = {
      VOO: {
        '2025-04-01': 100,
        '2025-04-15': 100,
        '2025-05-01': 105,
      },
    }
    const out = attachPriceIndexPerformance(points, txs, priceMaps)
    expect(out[1].performance_pct).toBe(0)
    expect(out[2].performance_pct).toBeCloseTo(5, 1)
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
