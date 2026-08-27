import { describe, it, expect, afterEach } from 'vitest'
import { formatStripeError, isStripeConfigured } from '../src/lib/stripeClient.js'

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

  it('formatStripeError maps common Stripe failures', () => {
    expect(formatStripeError({ message: 'No such price: price_x' })).toMatch(/STRIPE_PRICE_ID/)
    expect(formatStripeError({ message: 'Invalid API Key provided' })).toMatch(/STRIPE_SECRET_KEY/)
    expect(formatStripeError({ message: 'Something custom from Stripe' })).toBe('Something custom from Stripe')
  })
})
