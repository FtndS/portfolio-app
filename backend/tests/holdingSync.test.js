import { describe, it, expect } from 'vitest'
import { computeHoldingFromTxRows } from '../src/lib/holdingSync.js'

describe('computeHoldingFromTxRows', () => {
  it('keeps avg cost after partial sell', () => {
    const rows = [
      { type: 'BUY', shares: 100, price: 10, fee: 0 },
      { type: 'SELL', shares: 50, price: 12, fee: 0 },
    ]
    const { netShares, avgCost } = computeHoldingFromTxRows(rows)
    expect(netShares).toBe(50)
    expect(avgCost).toBeCloseTo(10, 4)
  })

  it('resets cost basis after full sell then new buy', () => {
    const rows = [
      { type: 'BUY', shares: 100, price: 10, fee: 0 },
      { type: 'SELL', shares: 100, price: 12, fee: 0 },
      { type: 'BUY', shares: 50, price: 20, fee: 0 },
    ]
    const { netShares, avgCost } = computeHoldingFromTxRows(rows)
    expect(netShares).toBe(50)
    expect(avgCost).toBeCloseTo(20, 4)
  })

  it('weights new buys after partial sell', () => {
    const rows = [
      { type: 'BUY', shares: 100, price: 10, fee: 0 },
      { type: 'SELL', shares: 50, price: 12, fee: 0 },
      { type: 'BUY', shares: 50, price: 30, fee: 0 },
    ]
    const { netShares, avgCost } = computeHoldingFromTxRows(rows)
    expect(netShares).toBe(100)
    expect(avgCost).toBeCloseTo(20, 4)
  })

  it('includes fees in buy cost basis', () => {
    const rows = [{ type: 'BUY', shares: 10, price: 100, fee: 50 }]
    const { netShares, avgCost } = computeHoldingFromTxRows(rows)
    expect(netShares).toBe(10)
    expect(avgCost).toBeCloseTo(105, 4)
  })
})
