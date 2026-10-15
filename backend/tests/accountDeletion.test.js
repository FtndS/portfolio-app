import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('../src/lib/omiseClient.js', () => ({
  cancelOmiseSchedule: vi.fn(),
  getOmiseSchedule: vi.fn(),
  createOmiseCharge: vi.fn(),
  createOmiseCustomer: vi.fn(),
  createOmiseSchedule: vi.fn(),
  createOmiseSource: vi.fn(),
  getOmiseCharge: vi.fn(),
  isOmiseConfigured: vi.fn(() => true),
}))

const stripeMock = {
  subscriptions: { cancel: vi.fn(), retrieve: vi.fn() },
}
vi.mock('../src/lib/stripeClient.js', () => ({
  getStripe: vi.fn(() => stripeMock),
  isStripeConfigured: vi.fn(() => true),
}))

import { cancelOmiseSchedule, getOmiseSchedule } from '../src/lib/omiseClient.js'
import { getStripe } from '../src/lib/stripeClient.js'
import { deleteUserAccount, BillingCancelError } from '../src/lib/accountDeletion.js'

function fakePool({ scheduleId = null, stripeSubId = null } = {}) {
  return {
    query: vi.fn(async (sql) => {
      if (sql.startsWith('SELECT omise_schedule_id')) return { rows: [{ omise_schedule_id: scheduleId }] }
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
    expect(cancelOmiseSchedule).not.toHaveBeenCalled()
    expect(stripeMock.subscriptions.cancel).not.toHaveBeenCalled()
    expect(deleted(pool)).toBe(true)
  })

  it('cancels the Omise schedule before deleting', async () => {
    const pool = fakePool({ scheduleId: 'schd_1' })
    cancelOmiseSchedule.mockResolvedValue({ status: 'deleted' })
    await deleteUserAccount(pool, 7)
    expect(cancelOmiseSchedule).toHaveBeenCalledWith('schd_1')
    const sqls = pool.query.mock.calls.map(([sql]) => sql)
    const cancelIdx = sqls.findIndex((s) => s.includes('omise_schedule_id = NULL'))
    const deleteIdx = sqls.findIndex((s) => s.startsWith('DELETE FROM users'))
    expect(cancelIdx).toBeGreaterThan(-1)
    expect(deleteIdx).toBeGreaterThan(cancelIdx)
  })

  it('keeps the account when the Omise cancel fails', async () => {
    const pool = fakePool({ scheduleId: 'schd_1' })
    cancelOmiseSchedule.mockRejectedValue(Object.assign(new Error('network down'), { status: 500 }))
    getOmiseSchedule.mockResolvedValue({ status: 'active' })
    await expect(deleteUserAccount(pool, 7)).rejects.toBeInstanceOf(BillingCancelError)
    expect(deleted(pool)).toBe(false)
    expect(pool.query.mock.calls.some(([sql]) => sql.includes('omise_schedule_id = NULL'))).toBe(false)
  })

  it('treats an already-ended Omise schedule as cancelled', async () => {
    const pool = fakePool({ scheduleId: 'schd_1' })
    cancelOmiseSchedule.mockRejectedValue(Object.assign(new Error('already deleted'), { status: 400 }))
    getOmiseSchedule.mockResolvedValue({ status: 'deleted' })
    await deleteUserAccount(pool, 7)
    expect(deleted(pool)).toBe(true)
  })

  it('cancels an active Stripe subscription before deleting', async () => {
    const pool = fakePool({ stripeSubId: 'sub_1' })
    stripeMock.subscriptions.cancel.mockResolvedValue({ status: 'canceled' })
    await deleteUserAccount(pool, 7)
    expect(stripeMock.subscriptions.cancel).toHaveBeenCalledWith('sub_1')
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
