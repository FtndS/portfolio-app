import { describe, it, expect, beforeEach } from 'vitest'
import { getPlanConfigForUser } from '../src/lib/aiPlan.js'
import { resolveCopilotQuestion } from '../src/lib/aiCopilotContext.js'

describe('getPlanConfigForUser', () => {
  beforeEach(() => {
    delete process.env.AI_OWNER_EMAIL
  })

  it('gives pro copilot limits to owner email on free plan', () => {
    const cfg = getPlanConfigForUser('user', 'tanadon.sangkhatorn@gmail.com', 'free', null)
    expect(cfg.id).toBe('pro')
    expect(cfg.copilot.allowCustomQuestion).toBe(true)

    const resolved = resolveCopilotQuestion(undefined, 'คำถามทดสอบ', cfg)
    expect(resolved.error).toBeUndefined()
    expect(resolved.question).toBe('คำถามทดสอบ')
  })

  it('keeps free copilot limits for regular users', () => {
    const cfg = getPlanConfigForUser('user', 'other@example.com', 'free', null)
    expect(cfg.id).toBe('free')

    const resolved = resolveCopilotQuestion(undefined, 'คำถามทดสอบ', cfg)
    expect(resolved.error).toContain('Pro')
  })
})
