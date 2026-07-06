import { describe, it, expect } from 'vitest'
import { getSubscriptionPeriodEnd, applyManualProCredit } from '../src/lib/stripeSubscription.js'

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

describe('applyManualProCredit', () => {
  it('adds remaining manual Pro time on top of Stripe period', () => {
    const now = new Date('2026-07-06T12:00:00Z')
    const stripeEnd = new Date('2026-08-06T12:00:00Z')
    const manualEnd = new Date('2026-07-30T12:00:00Z')
    const result = applyManualProCredit(stripeEnd, manualEnd, now)
    expect(result.extraDays).toBe(24)
    expect(result.expiresAt.toISOString()).toBe(
      new Date(stripeEnd.getTime() + 24 * 86400000).toISOString()
    )
  })

  it('returns Stripe period when manual Pro already expired', () => {
    const now = new Date('2026-08-01T12:00:00Z')
    const stripeEnd = new Date('2026-09-06T12:00:00Z')
    const manualEnd = new Date('2026-07-30T12:00:00Z')
    const result = applyManualProCredit(stripeEnd, manualEnd, now)
    expect(result.extraMs).toBe(0)
    expect(result.expiresAt.toISOString()).toBe(stripeEnd.toISOString())
  })
})
