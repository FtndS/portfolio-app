import { describe, it, expect } from 'vitest'
import {
  buildCopilotSystemPrompt,
  buildCopilotUserMessage,
  citedNews,
  normalizeCopilotNews,
} from '../src/lib/aiCopilotPrompt.js'
import { COPILOT_PRESETS } from '../src/lib/aiCopilotContext.js'

const rawNews = [
  { title: 'KBTG AI Real Value &amp; Impact', source: { name: 'thestandard.co' }, url: 'https://example.com/a' },
  { title: 'Nvidia at AI lunch', source: 'Moomoo', url: 'https://example.com/b', publishedAt: '2026-10-15' },
  { title: 'Bad link', url: 'javascript:alert(1)' },
  { title: '' },
]

describe('aiCopilotPrompt', () => {
  it('system prompt frames Copilot as a review aid, not an adviser or analyst', () => {
    const prompt = buildCopilotSystemPrompt({ maxWords: 300 })
    expect(prompt).not.toContain('ที่ปรึกษา')
    expect(prompt).not.toContain('นักวิเคราะห์การลงทุน')
    expect(prompt).not.toContain('เหตุผลที่เป็นไปได้')
    expect(prompt).toContain('ไม่ใช่คำแนะนำการลงทุน')
    expect(prompt).toContain('ห้ามบอกให้ซื้อ ขาย ถือต่อ เพิ่ม หรือลดสัดส่วน')
    expect(prompt).toContain('ห้ามคาดการณ์ราคา')
    expect(prompt).toContain('ห้ามอธิบายว่าข่าวเป็นสาเหตุ')
    expect(prompt).toContain('ห้ามใช้ชื่อฟิลด์ภายใน')
    expect(prompt).toContain('300')
  })

  it('presets do not ask for risk verdicts, standouts, or recommendations', () => {
    for (const p of Object.values(COPILOT_PRESETS)) {
      expect(p.label).not.toMatch(/เสี่ยงเกิน/)
      expect(p.prompt).not.toMatch(/แนะนำ|โดดเด่น|ควรจำ|บ่อยเกินไป/)
    }
  })

  it('normalizes news: decodes entities, numbers items, drops unsafe urls', () => {
    const news = normalizeCopilotNews(rawNews, 8)
    expect(news).toHaveLength(3)
    expect(news[0]).toMatchObject({ id: 1, title: 'KBTG AI Real Value & Impact', source: 'thestandard.co' })
    expect(news[2]).toMatchObject({ id: 3, url: '' })
    expect(normalizeCopilotNews(rawNews, 1)).toHaveLength(1)
  })

  it('user message lists news by citation number', () => {
    const msg = buildCopilotUserMessage({ context: 'CTX', news: normalizeCopilotNews(rawNews), question: 'Q?' })
    expect(msg).toContain('[2] Nvidia at AI lunch | Moomoo | 2026-10-15')
    expect(msg).toContain('คำถาม: Q?')
    expect(buildCopilotUserMessage({ context: 'CTX', news: [], question: 'Q' })).toContain('— ไม่มี')
  })

  it('citedNews returns only the news the answer cites', () => {
    const news = normalizeCopilotNews(rawNews)
    expect(citedNews('ข่าว Nvidia [2] และ [1, 3]', news).map((n) => n.id)).toEqual([1, 2, 3])
    expect(citedNews('อ้าง [2] กับ [9]', news).map((n) => n.id)).toEqual([2])
    expect(citedNews('ไม่มีข่าวที่พูดถึงหุ้นในพอร์ต', news)).toEqual([])
  })
})
