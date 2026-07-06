import { describe, it, expect, afterEach } from 'vitest'
import { isStripeConfigured } from '../src/lib/stripeClient.js'

describe('stripeClient', () => {
  const env = { ...process.env }

  afterEach(() => {
    process.env = { ...env }
  })

  it('isStripeConfigured requires enabled flag and keys', () => {
    delete process.env.STRIPE_ENABLED
    delete process.env.STRIPE_SECRET_KEY
    delete process.env.STRIPE_PRICE_ID
    expect(isStripeConfigured()).toBe(false)

    process.env.STRIPE_ENABLED = 'true'
    process.env.STRIPE_SECRET_KEY = 'sk_test_x'
    process.env.STRIPE_PRICE_ID = 'price_x'
    expect(isStripeConfigured()).toBe(true)
  })
})
