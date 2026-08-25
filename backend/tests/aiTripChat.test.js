import { describe, expect, it } from 'vitest'
import {
  buildTripChatContext,
  normalizeTripChatResponse,
} from '../src/lib/aiTripChat.js'

describe('aiTripChat', () => {
  it('builds compact trip context with place ids', () => {
    const ctx = buildTripChatContext({
      id: 8,
      title: 'Japan',
      origin: 'Bangkok',
      destination: 'Tokyo',
      start_date: '2025-11-01',
      end_date: '2025-11-05',
      days: [{ id: 1, day_index: 1, title: 'Day 1', date: '2025-11-01' }],
      places: [
        { id: 10, trip_day_id: 1, type: 'airport', name: 'BKK', start_time: '08:00', sort_order: 0 },
        { id: 11, trip_day_id: 1, type: 'hotel', name: 'Peninsula', start_time: '20:00', sort_order: 1 },
      ],
    })
    expect(ctx).toContain('trip_id: 8')
    expect(ctx).toContain('place_id=10')
    expect(ctx).toContain('place_id=11')
    expect(ctx).toContain('Day 1 [day_id=1]')
  })

  it('normalizes reply and safe actions', () => {
    const r = normalizeTripChatResponse({
      status: 'reply',
      reply: 'เพิ่มร้านราเมงให้วันที่ 2 แล้ว',
      actions: [
        {
          type: 'add_place',
          day_index: 2,
          place: { type: 'restaurant', name: 'Ichiran', start_time: '12:00', end_time: '13:00' },
        },
        { type: 'remove_place', place_id: 99 },
        { type: 'hack', place_id: 1 },
        { type: 'update_place', place_id: 5, patch: { start_time: '10:00' } },
        { type: 'set_day_title', day_index: 2, title: 'กินราเมง' },
      ],
    })
    expect(r.error).toBeUndefined()
    expect(r.reply).toMatch(/ราเมง/)
    expect(r.actions).toHaveLength(4)
    expect(r.actions.map((a) => a.type)).toEqual([
      'add_place',
      'remove_place',
      'update_place',
      'set_day_title',
    ])
  })

  it('rejects empty reply', () => {
    const r = normalizeTripChatResponse({ status: 'reply', reply: '  ', actions: [] })
    expect(r.error).toBeTruthy()
  })
})
