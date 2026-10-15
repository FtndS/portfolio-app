import { describe, it, expect } from 'vitest'
import { buildProActivatedEmail } from '../src/lib/email.js'

describe('pro notification emails', () => {
  it('buildProActivatedEmail uses stripe source label', () => {
    const { text } = buildProActivatedEmail({
      userName: 'Test',
      planExpiresAt: '2026-08-30T00:00:00.000Z',
      source: 'stripe',
    })
    expect(text).toContain('บัตร')
  })

  it('buildProActivatedEmail uses manual source label', () => {
    const { text } = buildProActivatedEmail({
      userName: 'Test',
      planExpiresAt: '2026-08-30T00:00:00.000Z',
      source: 'manual',
    })
    expect(text).toContain('ทีมงานเปิดสิทธิ์')
    expect(text).not.toContain('PromptPay')
  })
})
