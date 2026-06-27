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
    const status = await getFeatureQuota(1, 'tanadon.sangkhatorn@gmail.com', AI_FEATURES.ANALYZE)
    expect(status.allowed).toBe(true)
    expect(status.isOwner).toBe(true)
    expect(pool.query).not.toHaveBeenCalled()
  })

  it('blocks when used within 7 days', async () => {
    const usedAt = new Date('2026-06-20T10:00:00Z')
    pool.query.mockResolvedValueOnce({ rows: [{ used_at: usedAt }] })

    const status = await getFeatureQuota(2, 'user@test.com', AI_FEATURES.NEWS_SUMMARY)
    expect(status.allowed).toBe(false)
    expect(status.nextAvailableAt).toBe(new Date(usedAt.getTime() + 7 * 24 * 60 * 60 * 1000).toISOString())
  })

  it('allows when no recent usage', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] })

    const status = await getFeatureQuota(2, 'user@test.com', AI_FEATURES.ANALYZE)
    expect(status.allowed).toBe(true)
    expect(status.nextAvailableAt).toBeNull()
  })

  it('builds Thai quota message', () => {
    const msg = quotaExceededMessage(AI_FEATURES.ANALYZE, '2026-06-27T10:00:00.000Z')
    expect(msg).toContain('วิเคราะห์พอร์ต')
    expect(msg).toContain('ใช้ได้อีกครั้งหลัง')
  })
})
