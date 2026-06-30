import { describe, it, expect } from 'vitest'
import { buildSubscriptionCatalog } from '../src/lib/subscriptionCatalog.js'

describe('subscriptionCatalog', () => {
  it('builds free and pro plans with weekly limits', () => {
    const catalog = buildSubscriptionCatalog()
    expect(catalog.proMonthlyThb).toBeGreaterThan(0)
    expect(catalog.plans).toHaveLength(2)
    const pro = catalog.plans.find((p) => p.id === 'pro')
    const analyze = pro.features.find((f) => f.id === 'analyze')
    expect(analyze.pro).toContain('8')
    const custom = pro.features.find((f) => f.id === 'copilotCustom')
    expect(custom.pro).toBe('✓')
  })
})
