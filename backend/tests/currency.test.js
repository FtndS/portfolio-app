import { describe, it, expect } from 'vitest'
import { convertAmount, toUsd, fromUsd } from '../src/lib/currency.js'
import { validateSellQuantity, netSharesFromRows } from '../src/lib/transactionValidation.js'

describe('currency', () => {
  const usdThb = 35

  it('converts USD to THB', () => {
    expect(convertAmount(100, 'USD', 'THB', usdThb)).toBeCloseTo(3500, 2)
  })

  it('converts THB to USD display', () => {
    expect(convertAmount(3500, 'THB', 'USD', usdThb)).toBeCloseTo(100, 2)
  })

  it('converts HKD via USD cross', () => {
    expect(toUsd(780, 'HKD', usdThb)).toBeCloseTo(100, 1)
    expect(fromUsd(100, 'THB', usdThb)).toBeCloseTo(3500, 2)
  })
})

describe('validateSellQuantity', () => {
  it('rejects oversell', () => {
    expect(validateSellQuantity(10, 11)).toMatch(/ขายเกิน/)
  })

  it('allows valid sell', () => {
    expect(validateSellQuantity(10, 5)).toBeNull()
  })
})

describe('netSharesFromRows', () => {
  it('computes net from buys and sells', () => {
    const net = netSharesFromRows([
      { type: 'BUY', shares: '10' },
      { type: 'SELL', shares: '3' },
    ])
    expect(net).toBeCloseTo(7, 4)
  })
})
