import { describe, it, expect } from 'vitest'
import { buildSlipReceivedEmail, buildProActivatedEmail } from '../src/lib/email.js'

describe('pro notification emails', () => {
  it('buildSlipReceivedEmail includes ticket id', () => {
    const { subject, text } = buildSlipReceivedEmail({ userName: 'Filmtnds', ticketId: 42 })
    expect(subject).toContain('#42')
    expect(text).toContain('#42')
    expect(text).toContain('1 วันทำการ')
  })

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
    expect(text).toContain('PromptPay')
  })
})
