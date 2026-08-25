import { describe, expect, it } from 'vitest'
import {
  estimatePlaceCost,
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
})
