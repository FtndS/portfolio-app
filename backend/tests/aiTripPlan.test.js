import { describe, it, expect } from 'vitest'
import {
  normalizeAiPlanResponse,
  normalizeAiTripPlanMessages,
} from '../src/lib/aiTripPlan.js'
import { normalizeReorderPayload } from '../src/lib/tripHelpers.js'

describe('normalizeReorderPayload', () => {
  it('accepts ordered place ids for a day', () => {
    const ok = normalizeReorderPayload({ day_id: 3, place_ids: [9, 8, 7] })
    expect(ok.error).toBeUndefined()
    expect(ok.day_id).toBe(3)
    expect(ok.place_ids).toEqual([9, 8, 7])
  })

  it('rejects duplicates and empty lists', () => {
    expect(normalizeReorderPayload({ day_id: 1, place_ids: [] }).error).toBeTruthy()
    expect(normalizeReorderPayload({ day_id: 1, place_ids: [1, 1] }).error).toBeTruthy()
    expect(normalizeReorderPayload({ place_ids: [1] }).error).toBeTruthy()
  })
})

describe('aiTripPlan normalize', () => {
  it('normalizes chat messages', () => {
    const msgs = normalizeAiTripPlanMessages([
      { role: 'user', content: '  จัดทริปญี่ปุ่น  ' },
      { role: 'assistant', content: 'ถามเมืองไหน' },
      { role: 'other', content: '' },
    ])
    expect(msgs).toHaveLength(2)
    expect(msgs[0].role).toBe('user')
    expect(msgs[1].role).toBe('assistant')
  })

  it('normalizes clarify response', () => {
    const r = normalizeAiPlanResponse({
      status: 'clarify',
      questions: ['สนใจเมืองไหน?', 'งบประมาณเท่าไร?', ''],
    })
    expect(r.status).toBe('clarify')
    expect(r.questions).toHaveLength(2)
  })

  it('normalizes plan with airport hotel restaurant', () => {
    const r = normalizeAiPlanResponse({
      status: 'plan',
      trip: {
        title: 'ญี่ปุ่น 5 วัน',
        destination: 'โตเกียว',
        start_date: '2026-08-01',
        end_date: '2026-08-05',
        days: [
          {
            day_index: 1,
            title: 'วันที่ 1',
            places: [
              { type: 'airport', name: 'สนามบินนาริตะ', start_time: '10:00' },
              { type: 'hotel', name: 'Hotel Gracery Shinjuku' },
              { type: 'restaurant', name: 'Ichiran Shinjuku' },
              {
                type: 'transport',
                name: 'เที่ยวบิน กรุงเทพ–โตเกียว',
                notes: 'โหมด: บิน',
                start_time: '08:00',
                end_time: '16:00',
              },
            ],
          },
        ],
      },
    })
    expect(r.error).toBeUndefined()
    expect(r.status).toBe('plan')
    expect(r.trip.days[0].places).toHaveLength(4)
    expect(r.trip.days[0].places[0].type).toBe('airport')
    const hotel = r.trip.days[0].places.find((p) => p.type === 'hotel')
    expect(hotel.booking_links?.length).toBeGreaterThan(0)
    const transport = r.trip.days[0].places.find((p) => p.type === 'transport')
    expect(transport.notes).toContain('โหมด: บิน')
    expect(transport.booking_links?.some((l) => l.label === 'Google Flights')).toBe(true)
  })

  it('rejects empty place plan', () => {
    const r = normalizeAiPlanResponse({
      status: 'plan',
      trip: { title: 'X', days: [{ day_index: 1, places: [] }] },
    })
    expect(r.error).toBeTruthy()
  })
})
