import { describe, it, expect } from 'vitest'
import { getSubscriptionPeriodEnd } from '../src/lib/stripeSubscription.js'

describe('getSubscriptionPeriodEnd', () => {
  it('uses legacy subscription.current_period_end when present', () => {
    const end = getSubscriptionPeriodEnd({ current_period_end: 1_700_000_000 })
    expect(end.toISOString()).toBe(new Date(1_700_000_000_000).toISOString())
  })

  it('uses max item current_period_end on Basil API shape', () => {
    const end = getSubscriptionPeriodEnd({
      items: {
        data: [
          { current_period_end: 1_700_000_000 },
          { current_period_end: 1_800_000_000 },
        ],
      },
    })
    expect(end.toISOString()).toBe(new Date(1_800_000_000_000).toISOString())
  })

  it('throws when period end is missing', () => {
    expect(() => getSubscriptionPeriodEnd({ items: { data: [] } })).toThrow(
      'Subscription period end not found'
    )
  })
})
