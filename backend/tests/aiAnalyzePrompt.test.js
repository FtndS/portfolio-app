import { describe, it, expect } from 'vitest'
import {
  buildAnalyzeSystemPrompt,
  buildAnalyzeUserMessage,
  sanitizeAnalysis,
  currencyAllocation,
  ANALYZE_RESPONSE_FIELDS,
} from '../src/lib/aiAnalyzePrompt.js'

const payload = {
  displayCurrency: 'THB',
  portfolioWithPct: [
    { ticker: 'PTT.BK', sector: 'Energy', currency: 'THB', value: 600, allocation: '60.0' },
    { ticker: 'VOO', sector: 'ETF', currency: 'USD', value: 400, allocation: '40.0' },
  ],
  sectorAlloc: [{ sector: 'Energy', pct: '60.0' }, { sector: 'ETF', pct: '40.0' }],
  totalValue: 1000,
  txSummary: { stats: { total: 0 }, byTicker: [], recent: [] },
  journalSummary: { entries: [], stats: { total: 0 } },
  dataScope: { plan: 'free' },
}

describe('aiAnalyzePrompt', () => {
  it('system prompt frames the AI as a review aid, not an adviser', () => {
    const prompt = buildAnalyzeSystemPrompt({ maxLen: 200, maxRec: 5 })
    expect(prompt).not.toContain('ที่ปรึกษา')
    expect(prompt).toContain('ไม่ใช่คำแนะนำการลงทุน')
    expect(prompt).toContain('ห้ามบอกให้ซื้อ ขาย ถือต่อ เพิ่ม หรือลดสัดส่วน')
    expect(prompt).toContain('ห้ามให้คะแนน')
  })

  it('requested JSON shape has no score or rebalance fields', () => {
    const msg = buildAnalyzeUserMessage(payload)
    expect(msg).not.toMatch(/"score"/)
    expect(msg).not.toMatch(/scoreReason/)
    expect(msg).not.toMatch(/rebalance/i)
    expect(msg).not.toMatch(/"recommendations"/)
    expect(msg).toContain('"reviewPoints"')
  })

  it('computes allocation by currency', () => {
    expect(currencyAllocation(payload.portfolioWithPct, 1000)).toEqual([
      { currency: 'THB', pct: '60.0' },
      { currency: 'USD', pct: '40.0' },
    ])
  })

  it('drops advisory fields even if Claude still returns them', () => {
    const out = sanitizeAnalysis({
      summary: 'พอร์ตมีหุ้น 2 ตัว',
      score: 7,
      scoreReason: 'ดี',
      recommendations: [{ type: 'reduce', ticker: 'PTT.BK', action: 'ลด PTT' }],
      rebalanceSuggestion: 'ปรับเป็น 50/50',
      actionPlan: ['ขาย PTT'],
      strengths: ['x'],
      reviewPoints: [
        { topic: 'concentration', ticker: 'PTT.BK', observation: 'PTT 60%', question: 'ตั้งใจไหม' },
        { topic: 'rebalance', ticker: null, observation: 'หมวด ETF 40%', question: 'ตรงแผนไหม' },
        { topic: 'sector' },
      ],
    })
    expect(Object.keys(out).sort()).toEqual([...ANALYZE_RESPONSE_FIELDS].sort())
    expect(out).not.toHaveProperty('score')
    expect(out).not.toHaveProperty('rebalanceSuggestion')
    expect(out).not.toHaveProperty('recommendations')
    expect(JSON.stringify(out)).not.toMatch(/rebalance/i)
    expect(out.reviewPoints).toHaveLength(2)
    expect(out.reviewPoints[1].topic).toBe('other')
    expect(out.reviewPoints[1].ticker).toBeNull()
  })

  it('caps review points and steps', () => {
    const out = sanitizeAnalysis({
      reviewPoints: Array.from({ length: 10 }, (_, i) => ({ topic: 'sector', observation: `o${i}` })),
      reviewSteps: ['1', '2', '3', '4', '5'],
    }, { maxRec: 3 })
    expect(out.reviewPoints).toHaveLength(3)
    expect(out.reviewSteps).toHaveLength(4)
  })

  it('survives non-object input', () => {
    const out = sanitizeAnalysis(null)
    expect(out.summary).toBe('')
    expect(out.reviewPoints).toEqual([])
    expect(out.tradingPattern).toBeNull()
  })
})
