import { describe, it, expect, vi, beforeEach } from 'vitest'
import {
  AI_FEATURES,
  getAiOwnerEmail,
  isAiOwner,
  quotaExceededMessage,
} from '../src/lib/aiQuota.js'

vi.mock('../src/db/index.js', () => ({
  default: {
    query: vi.fn(),
  },
}))

import pool from '../src/db/index.js'
import { getFeatureQuota } from '../src/lib/aiQuota.js'

describe('aiQuota', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.AI_OWNER_EMAIL
  })

  it('uses default owner email', () => {
    expect(getAiOwnerEmail()).toBe('tanadon.sangkhatorn@gmail.com')
    expect(isAiOwner('Tanadon.Sangkhatorn@gmail.com')).toBe(true)
    expect(isAiOwner('other@example.com')).toBe(false)
  })

  it('respects AI_OWNER_EMAIL env', () => {
    process.env.AI_OWNER_EMAIL = 'owner@test.com'
    expect(isAiOwner('owner@test.com')).toBe(true)
    expect(isAiOwner('tanadon.sangkhatorn@gmail.com')).toBe(false)
  })

  it('allows owner without checking database', async () => {
    const status = await getFeatureQuota(1, 'tanadon.sangkhatorn@gmail.com', AI_FEATURES.ANALYZE, 'user', 'free', null)
    expect(status.allowed).toBe(true)
    expect(status.isOwner).toBe(true)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('allows admin role without checking database', async () => {
    const status = await getFeatureQuota(2, 'other@test.com', AI_FEATURES.ANALYZE, 'admin', 'free', null)
    expect(status.allowed).toBe(true)
    expect(status.isOwner).toBe(true)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('blocks free user when weekly limit reached', async () => {
    const usedAt = new Date('2026-06-20T10:00:00Z')
    pool.query.mockResolvedValueOnce({ rows: [{ used_at: usedAt }] })

    const status = await getFeatureQuota(2, 'user@test.com', AI_FEATURES.NEWS_SUMMARY, 'user', 'free', null)
    expect(status.allowed).toBe(false)
    expect(status.used).toBe(1)
    expect(status.limit).toBe(1)
    expect(status.remaining).toBe(0)
    expect(status.nextAvailableAt).toBe(new Date(usedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
  })

  it('allows pro user with remaining weekly quota', async () => {
    pool.query.mockResolvedValueOnce({
      rows: [
        { used_at: new Date('2026-06-20T10:00:00Z') },
        { used_at: new Date('2026-06-22T10:00:00Z') },
      ],
    })

    const status = await getFeatureQuota(2, 'user@test.com', AI_FEATURES.ANALYZE, 'user', 'pro', '2099-01-01T00:00:00Z')
    expect(status.allowed).toBe(true)
    expect(status.used).toBe(2)
    expect(status.limit).toBe(8)
    expect(status.remaining).toBe(6)
  })

  it('allows when no recent usage', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const status = await getFeatureQuota(2, 'user@test.com', AI_FEATURES.ANALYZE, 'user', 'free', null)
    expect(status.allowed).toBe(true)
    expect(status.remaining).toBe(1)
  })

  it('blocks free user when copilot weekly limit reached', async () => {
    const usedAt = new Date('2026-06-20T10:00:00Z')
    pool.query.mockResolvedValueOnce({
      rows: [
        { used_at: usedAt },
        { used_at: new Date('2026-06-21T10:00:00Z') },
      ],
    })

    const status = await getFeatureQuota(2, 'user@test.com', AI_FEATURES.COPILOT, 'user', 'free', null)
    expect(status.allowed).toBe(false)
    expect(status.used).toBe(2)
    expect(status.limit).toBe(2)
    expect(status.remaining).toBe(0)
  })

  it('builds Thai quota message', () => {
    const msg = quotaExceededMessage(AI_FEATURES.ANALYZE, '2026-06-27T10:00:00.000Z', { limit: 1 })
    expect(msg).toContain('วิเคราะห์พอร์ต')
    expect(msg).toContain('ใช้ได้อีกครั้งหลัง')
  })
})
