import { describe, it, expect } from 'vitest'
import {
  buildNewsSummarySystemPrompt,
  buildNewsSummaryUserMessage,
  normalizeNews,
  portfolioTickers,
  sanitizeNewsSummary,
  NEWS_SUMMARY_RESPONSE_FIELDS,
  MAX_NEWS,
} from '../src/lib/aiNewsSummaryPrompt.js'

const holdings = [{ ticker: 'PTT.BK' }, { ticker: 'voo' }, { ticker: 'PTT.BK' }]
const rawNews = [
  { title: 'PTT reports Q3 results &amp; outlook', source: { name: 'Yahoo' }, url: 'https://example.com/a', publishedAt: '2026-10-15' },
  { title: 'S&P 500 ETF flows', source: 'Google News', url: 'javascript:alert(1)' },
  { title: '   ' },
]

describe('aiNewsSummaryPrompt', () => {
  it('system prompt frames the AI as a news summarizer, not an analyst or adviser', () => {
    const prompt = buildNewsSummarySystemPrompt()
    expect(prompt).not.toContain('นักวิเคราะห์การลงทุน')
    expect(prompt).not.toContain('ที่ปรึกษา')
    expect(prompt).toContain('ไม่ใช่คำแนะนำการลงทุน')
    expect(prompt).toContain('ห้ามบอกว่าข่าวดีหรือร้าย')
    expect(prompt).toContain('ห้ามคาดการณ์ราคา')
    expect(prompt).toContain('ห้ามบอกให้ซื้อ ขาย ถือ')
    expect(prompt).toContain('แง่บวก')
    expect(prompt).toContain('ห้ามอนุมานว่า ETF')
  })

  it('requested JSON shape has no impact or watchOut fields', () => {
    const msg = buildNewsSummaryUserMessage({ tickers: portfolioTickers(holdings), news: normalizeNews(rawNews) })
    expect(msg).not.toMatch(/"impact"/)
    expect(msg).not.toMatch(/positive|negative|neutral/)
    expect(msg).not.toMatch(/watchOut/)
    expect(msg).not.toContain('ผลกระทบ')
    expect(msg).toContain('"newsItems"')
    expect(msg).toContain('"readMore"')
  })

  it('normalizes news: drops empty titles, unsafe urls, caps count', () => {
    const news = normalizeNews(rawNews)
    expect(news).toHaveLength(2)
    expect(news[0]).toMatchObject({ id: 1, source: 'Yahoo', url: 'https://example.com/a' })
    expect(news[1]).toMatchObject({ id: 2, source: 'Google News', url: null })
    const many = normalizeNews(Array.from({ length: 20 }, (_, i) => ({ title: `n${i}` })))
    expect(many).toHaveLength(MAX_NEWS)
  })

  it('dedupes and uppercases portfolio tickers', () => {
    expect(portfolioTickers(holdings)).toEqual(['PTT.BK', 'VOO'])
  })

  it('sanitize drops evaluative fields and keeps only portfolio tickers', () => {
    const news = normalizeNews(rawNews)
    const tickers = portfolioTickers(holdings)
    const out = sanitizeNewsSummary({
      impact: 'positive',
      watchOut: 'ระวังราคาน้ำมัน',
      highlights: ['x'],
      summary: ' ข่าวพูดถึงผลประกอบการ ',
      newsItems: [
        { id: 1, gist: 'PTT รายงานผลไตรมาส 3', tickers: ['ptt.bk', 'AAPL'], title: 'fake', url: 'https://evil' },
        { id: 1, gist: 'dup' },
        { id: 99, gist: 'unknown id' },
        { id: '2', gist: 'กระแสเงิน ETF', tickers: [] },
      ],
      readMore: ['ไตรมาสไหน', '', 'b', 'c', 'd'],
    }, { news, tickers })

    expect(Object.keys(out).sort()).toEqual([...NEWS_SUMMARY_RESPONSE_FIELDS].sort())
    expect(out).not.toHaveProperty('impact')
    expect(out).not.toHaveProperty('watchOut')
    expect(out.summary).toBe('ข่าวพูดถึงผลประกอบการ')
    expect(out.newsItems).toHaveLength(2)
    expect(out.newsItems[0]).toMatchObject({ id: 1, title: 'PTT reports Q3 results & outlook', url: 'https://example.com/a', tickers: ['PTT.BK'] })
    expect(out.newsItems[1]).toMatchObject({ id: 2, tickers: [] })
    expect(out.mentionedTickers).toEqual(['PTT.BK'])
    expect(out.readMore).toEqual(['ไตรมาสไหน', 'b', 'c'])
  })

  it('sanitize handles garbage input', () => {
    expect(sanitizeNewsSummary(null)).toEqual({ summary: '', newsItems: [], mentionedTickers: [], readMore: [] })
  })
})
