import { describe, it, expect } from 'vitest'
import { stripeCustomerDisplayName } from '../src/lib/stripeCustomer.js'

describe('stripeCustomerDisplayName', () => {
  it('uses PortDiary display name when set', () => {
    expect(stripeCustomerDisplayName({ name: 'Filmtnds', email: 'a@b.com' })).toBe('Filmtnds')
  })

  it('falls back to email local part', () => {
    expect(stripeCustomerDisplayName({ name: '', email: 'filmtnds@gmail.com' })).toBe('filmtnds')
  })
})
