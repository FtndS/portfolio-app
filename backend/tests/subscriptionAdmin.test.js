import { describe, it, expect } from 'vitest'
import { computeProExpiry, normalizePlanId } from '../src/lib/subscriptionAdmin.js'

describe('subscriptionAdmin', () => {
  describe('normalizePlanId', () => {
    it('maps pro only when exact', () => {
      expect(normalizePlanId('pro')).toBe('pro')
      expect(normalizePlanId('Pro')).toBe('free')
      expect(normalizePlanId('')).toBe('free')
      expect(normalizePlanId(undefined)).toBe('free')
    })
  })

  describe('computeProExpiry', () => {
    it('extends from explicit date', () => {
      const d = computeProExpiry({ planExpiresAt: '2026-12-31T00:00:00.000Z' })
      expect(d.toISOString()).toBe('2026-12-31T00:00:00.000Z')
    })

    it('rejects invalid explicit date', () => {
      expect(computeProExpiry({ planExpiresAt: 'not-a-date' })).toBeNull()
    })

    it('adds months from now when no current expiry', () => {
      const now = new Date()
      const d = computeProExpiry({ extendMonths: 3 })
      const expected = new Date(now)
      expected.setMonth(expected.getMonth() + 3)
      expect(Math.abs(d - expected)).toBeLessThan(2000)
    })

    it('extends from future expiry when still active', () => {
      const future = new Date()
      future.setMonth(future.getMonth() + 2)
      const d = computeProExpiry({
        currentExpiresAt: future.toISOString(),
        extendMonths: 1,
      })
      const expected = new Date(future)
      expected.setMonth(expected.getMonth() + 1)
      expect(Math.abs(d - expected)).toBeLessThan(2000)
    })
  })
})
