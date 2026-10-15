import { describe, it, expect, vi, beforeEach } from 'vitest'

const stripeMock = {
  subscriptions: { cancel: vi.fn(), retrieve: vi.fn() },
}
vi.mock('../src/lib/stripeClient.js', () => ({
  getStripe: vi.fn(() => stripeMock),
  isStripeConfigured: vi.fn(() => true),
}))

import { getStripe } from '../src/lib/stripeClient.js'
import { deleteUserAccount, BillingCancelError } from '../src/lib/accountDeletion.js'

function fakePool({ stripeSubId = null } = {}) {
  return {
    query: vi.fn(async (sql) => {
      if (sql.startsWith('SELECT stripe_subscription_id')) return { rows: [{ stripe_subscription_id: stripeSubId }] }
      return { rows: [] }
    }),
  }
}

const deleted = (pool) => pool.query.mock.calls.some(([sql]) => sql.startsWith('DELETE FROM users'))

beforeEach(() => {
  vi.clearAllMocks()
  getStripe.mockReturnValue(stripeMock)
})

describe('deleteUserAccount', () => {
  it('deletes an account without any subscription', async () => {
    const pool = fakePool()
    await deleteUserAccount(pool, 7)
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled()
    expect(deleted(pool)).toBe(true)
  })

  it('cancels an active Stripe subscription before deleting', async () => {
    const pool = fakePool({ stripeSubId: 'sub_1' })
    stripeMock.subscriptions.cancel.mockResolvedValue({ status: 'canceled' })
    await deleteUserAccount(pool, 7)
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith('sub_1')
    const sqls = pool.query.mock.calls.map(([sql]) => sql)
    const clearIdx = sqls.findIndex((q) => q.includes('stripe_subscription_id = NULL'))
    const deleteIdx = sqls.findIndex((q) => q.startsWith('DELETE FROM users'))
    expect(clearIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(clearIdx)
  })

  it('treats an already-cancelled Stripe subscription as cancelled', async () => {
    const pool = fakePool({ stripeSubId: 'sub_1' })
    stripeMock.subscriptions.cancel.mockRejectedValue(new Error('already canceled'))
    stripeMock.subscriptions.retrieve.mockResolvedValue({ status: 'canceled' })
    await deleteUserAccount(pool, 7)
    expect(deleted(pool)).toBe(true)
  })

  it('keeps the account when the Stripe cancel fails', async () => {
    const pool = fakePool({ stripeSubId: 'sub_1' })
    stripeMock.subscriptions.cancel.mockRejectedValue(new Error('stripe down'))
    stripeMock.subscriptions.retrieve.mockResolvedValue({ status: 'active' })
    await expect(deleteUserAccount(pool, 7)).rejects.toBeInstanceOf(BillingCancelError)
    expect(deleted(pool)).toBe(false)
  })

  it('keeps the account when a Stripe subscription exists but Stripe is not configured', async () => {
    const pool = fakePool({ stripeSubId: 'sub_1' })
    getStripe.mockReturnValue(null)
    await expect(deleteUserAccount(pool, 7)).rejects.toBeInstanceOf(BillingCancelError)
    expect(deleted(pool)).toBe(false)
  })
})
