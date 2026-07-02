import { describe, it, expect } from 'vitest'
import { summarizeTransactions, summarizeJournal } from '../src/lib/aiAnalyzeContext.js'

describe('aiAnalyzeContext', () => {
  it('summarizes transaction activity per ticker', () => {
    const result = summarizeTransactions([
      { date: '2026-01-10', ticker: 'VOO', type: 'BUY', shares: 10, price: 400, total: 4000, currency: 'USD' },
      { date: '2026-02-01', ticker: 'VOO', type: 'SELL', shares: 2, price: 420, total: 840, currency: 'USD' },
      { date: '2026-02-15', ticker: 'AAPL', type: 'BUY', shares: 5, price: 180, total: 900, currency: 'USD' },
    ], { maxItems: 10 })

    expect(result.stats.total).toBe(3)
    expect(result.stats.buys).toBe(2)
    expect(result.stats.sells).toBe(1)
    expect(result.byTicker.find((r) => r.ticker === 'VOO')?.sells).toBe(1)
    expect(result.recent).toHaveLength(3)
  })

  it('limits recent transactions separately from stats', () => {
    const txs = Array.from({ length: 10 }, (_, i) => ({
      date: `2026-01-${String(i + 1).padStart(2, '0')}`,
      ticker: 'VOO',
      type: 'BUY',
      shares: 1,
      price: 100,
      total: 100,
      currency: 'USD',
    }))
    const result = summarizeTransactions(txs, { maxRecent: 3 })
    expect(result.stats.total).toBe(10)
    expect(result.recent).toHaveLength(3)
  })

  it('summarizes journal entries with limits', () => {
    const entries = Array.from({ length: 5 }, (_, i) => ({
      date: `2026-01-0${i + 1}`,
      title: `Note ${i}`,
      tag: i % 2 ? 'thesis' : 'review',
      content: 'content',
    }))
    const result = summarizeJournal(entries, { maxItems: 3 })
    expect(result.stats.total).toBe(5)
    expect(result.entries).toHaveLength(3)
    expect(result.stats.tags.length).toBeGreaterThan(0)
  })
})
