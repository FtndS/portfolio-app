import { describe, expect, it } from 'vitest'
import {
  estimatePlaceCost,
  formatEstimateRange,
  sumTripCostEstimates,
} from '../../src/lib/tripPriceEstimate.js'

describe('tripPriceEstimate', () => {
  it('prefers user budget over rules', () => {
    const e = estimatePlaceCost(
      { type: 'hotel', budget: 9999, name: 'Hotel' },
      { destination: 'Tokyo' }
    )
    expect(e.source).toBe('budget')
    expect(e.amount).toBe(9999)
  })

  it('estimates Japan hotel in THB band', () => {
    const e = estimatePlaceCost(
      { type: 'hotel', name: 'Shinjuku Hotel' },
      { destination: 'Tokyo Japan' }
    )
    expect(e.source).toBe('estimate')
    expect(e.amount).toBeGreaterThan(2000)
    expect(e.low).toBeLessThan(e.high)
  })

  it('estimates flight via flight_leg as regional Asia', () => {
    const e = estimatePlaceCost(
      {
        type: 'transport',
        name: 'BKK → NRT',
        flight_leg: { origin: 'BKK', destination: 'NRT', destinationLabel: 'Tokyo' },
      },
      { destination: 'Japan', origin: 'Bangkok' }
    )
    expect(e.source).toBe('estimate')
    expect(e.amount).toBeGreaterThan(5000)
  })

  it('prefers live Google Flights quote over rule estimate', () => {
    const place = {
      id: 42,
      type: 'transport',
      name: 'BKK → NRT',
      flight_leg: { origin: 'BKK', destination: 'NRT' },
    }
    const e = estimatePlaceCost(place, {
      destination: 'Japan',
      flightQuotes: { 42: { price: 12345, currency: 'THB' } },
    })
    expect(e.source).toBe('live')
    expect(e.amount).toBe(12345)
    expect(e.label).toMatch(/Google Flights/)
  })

  it('sums trip with mix of budget and estimate', () => {
    const sum = sumTripCostEstimates(
      [
        { type: 'hotel', budget: 3000 },
        { type: 'restaurant', name: 'Ramen' },
        { type: 'airport', name: 'NRT' },
      ],
      { destination: 'Tokyo' }
    )
    expect(sum.budgeted).toBe(1)
    expect(sum.estimated).toBe(1)
    expect(sum.total).toBeGreaterThan(3000)
  })

  it('formats dual-currency ranges with currencies grouped', () => {
    const estimate = { source: 'estimate', amount: 28000, low: 18000, high: 38000, label: 'ประมาณ' }
    const one = (n) => `฿${n} · ¥${n * 5}`
    const range = (low, high) => `฿${low} – ฿${high} · ¥${low * 5} – ¥${high * 5}`
    expect(formatEstimateRange(estimate, one, range)).toBe('฿18000 – ฿38000 · ¥90000 – ¥190000')
    expect(formatEstimateRange(estimate, (n) => `฿${n}`)).toBe('฿18000 – ฿38000')
  })
})
