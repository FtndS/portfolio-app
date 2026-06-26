import { describe, it, expect } from 'vitest'
import { computePortfolioPnL } from '../src/lib/pnl.js'

const id = (n) => n

describe('computePortfolioPnL', () => {
  const convert = (amount) => amount

  it('unrealized only when no sells', () => {
    const holdings = [{ ticker: 'AAPL', shares: 10, avg_cost: 100, currency: 'USD' }]
    const prices = { AAPL: 110 }
    const result = computePortfolioPnL({
      transactions: [{ id: id(1), ticker: 'AAPL', type: 'BUY', shares: 10, price: 100, fee: 0, date: '2024-01-01', currency: 'USD' }],
      holdings,
      prices,
      convert,
    })
    expect(result.realized).toBe(0)
    expect(result.unrealized).toBe(100)
    expect(result.total).toBe(100)
    expect(result.hasRealized).toBe(false)
  })

  it('realized gain on partial sell', () => {
    const holdings = [{ ticker: 'AAPL', shares: 5, avg_cost: 100, currency: 'USD' }]
    const prices = { AAPL: 120 }
    const result = computePortfolioPnL({
      transactions: [
        { id: id(1), ticker: 'AAPL', type: 'BUY', shares: 10, price: 100, fee: 10, date: '2024-01-01', currency: 'USD' },
        { id: id(2), ticker: 'AAPL', type: 'SELL', shares: 5, price: 120, fee: 1, date: '2024-06-01', currency: 'USD' },
      ],
      holdings,
      prices,
      convert,
    })
    // avg cost = (1000+10)/10 = 101; sell 5 @ 120 fee 1 => realized 5*120-1 - 5*101 = 94
    expect(result.realized).toBeCloseTo(94, 2)
    expect(result.unrealized).toBeCloseTo(5 * (120 - 101), 2)
    expect(result.hasRealized).toBe(true)
  })
})
