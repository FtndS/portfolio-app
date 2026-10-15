import { describe, it, expect, vi } from 'vitest'

const stripeMock = {
  customers: { list: vi.fn() },
  invoices: { list: vi.fn() },
}
vi.mock('../src/lib/stripeClient.js', () => ({
  getStripe: vi.fn(() => stripeMock),
  isStripeConfigured: vi.fn(() => true),
}))

import { fetchBillingHistory } from '../src/lib/stripeSubscription.js'

const pool = { query: vi.fn(async () => ({ rows: [] })) }

describe('fetchBillingHistory', () => {
  it('does not throw when the stored customer belongs to the other Stripe mode', async () => {
    stripeMock.invoices.list.mockRejectedValue(
      Object.assign(new Error("No such customer: 'cus_live123'"), { code: 'resource_missing' })
    )
    const rows = await fetchBillingHistory(pool, 7, {
      email: 'a@example.com',
      stripeCustomerId: 'cus_live123',
      proMonthlyThb: 99,
    })
    expect(rows).toEqual([])
  })

  it('maps Stripe invoices when the lookup works', async () => {
    stripeMock.invoices.list.mockResolvedValue({
      data: [{ id: 'in_1', amount_paid: 9900, currency: 'thb', status: 'paid', created: 1_700_000_000 }],
    })
    const rows = await fetchBillingHistory(pool, 7, {
      email: 'a@example.com',
      stripeCustomerId: 'cus_test1',
      proMonthlyThb: 99,
    })
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ source: 'stripe', amountThb: 99, status: 'paid' })
  })
})
