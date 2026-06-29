import { describe, it, expect, vi, beforeEach } from 'vitest'
import jwt from 'jsonwebtoken'
import { isTokenVersionValid, signAuthToken } from '../src/lib/authToken.js'
import { validateHoldingId } from '../src/lib/holdingAccess.js'

describe('authToken', () => {
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-secret-key-at-least-32-chars-long'
  })

  it('accepts legacy tokens without tv when user version is 0', () => {
    expect(isTokenVersionValid(undefined, 0)).toBe(true)
  })

  it('rejects token when version mismatches', () => {
    expect(isTokenVersionValid(0, 1)).toBe(false)
    expect(isTokenVersionValid(1, 0)).toBe(false)
  })

  it('signs token with tv claim', () => {
    const token = signAuthToken(42, 3)
    const decoded = jwt.verify(token, process.env.JWT_SECRET)
    expect(decoded.userId).toBe(42)
    expect(decoded.tv).toBe(3)
  })
})

describe('validateHoldingId', () => {
  const db = { query: vi.fn() }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('allows null holding_id', async () => {
    const result = await validateHoldingId(db, 1, 10, null)
    expect(result).toEqual({ holdingId: null, currency: null })
    expect(db.query).not.toHaveBeenCalled()
  })

  it('rejects invalid holding_id', async () => {
    const result = await validateHoldingId(db, 1, 10, 'abc')
    expect(result.error).toBeTruthy()
  })

  it('rejects holding from another portfolio', async () => {
    db.query.mockResolvedValueOnce({ rows: [] })
    const result = await validateHoldingId(db, 1, 10, 99)
    expect(result.error).toContain('ไม่พบ holding')
  })

  it('returns holding when owned by user and portfolio', async () => {
    db.query.mockResolvedValueOnce({ rows: [{ id: 5, currency: 'USD' }] })
    const result = await validateHoldingId(db, 1, 10, 5)
    expect(result).toEqual({ holdingId: 5, currency: 'USD' })
    expect(db.query).toHaveBeenCalledWith(
      expect.stringContaining('portfolio_id'),
      [5, 1, 10]
    )
  })
})
