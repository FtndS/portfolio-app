import { describe, it, expect } from 'vitest'
import {
  extractIataToken,
  mergeFlightInput,
  parseFlightTaggedFields,
  parseRouteFromText,
} from '../src/lib/flightInput.js'
import {
  buildFlightProviderLinks,
  resolveFlightLeg,
} from '../src/lib/flightLeg.js'
import { attachBookingLinks } from '../src/lib/bookingLinks.js'

describe('flightInput', () => {
  it('parses tagged fields from notes', () => {
    const f = parseFlightTaggedFields('โหมด: บิน | จาก:DMK ถึง:CNX | ผู้โดยสาร:2 | ชั้น:business')
    expect(f.origin).toBe('DMK')
    expect(f.destination).toBe('CNX')
    expect(f.passengers).toBe(2)
    expect(f.cabin).toBe('business')
  })

  it('extracts IATA only when explicit in text', () => {
    expect(extractIataToken('สนามบินดอนเมือง (DMK)')).toBe('DMK')
    expect(extractIataToken('เชียงใหม่')).toBe(null)
  })

  it('parses route from dash using input city names', () => {
    expect(parseRouteFromText('เที่ยวบิน กรุงเทพ–เชียงใหม่')).toEqual({
      origin: { code: null, label: 'กรุงเทพ', query: 'กรุงเทพ' },
      destination: { code: null, label: 'เชียงใหม่', query: 'เชียงใหม่' },
    })
  })
})

describe('flightLeg from input', () => {
  it('uses trip origin + destination from form fields', () => {
    const leg = resolveFlightLeg({
      place: {
        type: 'transport',
        name: 'เที่ยวบิน',
        notes: 'โหมด: บิน',
      },
      trip: {
        origin: 'DMK',
        destination: 'CNX',
        start_date: '2025-11-01',
        end_date: '2025-11-05',
      },
      dayDate: '2025-11-01',
    })
    expect(leg.origin).toBe('DMK')
    expect(leg.destination).toBe('CNX')
    expect(leg.passengers).toBeNull()
    expect(leg.cabin).toBeNull()
  })

  it('uses passengers and cabin from place notes', () => {
    const leg = resolveFlightLeg({
      place: {
        type: 'transport',
        name: 'เที่ยวบิน กรุงเทพ–เชียงใหม่',
        notes: 'โหมด: บิน | ผู้โดยสาร:3 | ชั้น:premium economy',
      },
      trip: { destination: 'เชียงใหม่', start_date: '2025-11-01' },
      dayDate: '2025-11-01',
    })
    expect(leg.passengers).toBe(3)
    expect(leg.cabin).toBe('premium economy')
    expect(leg.originLabel).toBe('กรุงเทพ')
  })

  it('returns null when route cannot be inferred from input', () => {
    const leg = resolveFlightLeg({
      place: { type: 'transport', name: 'เที่ยวบิน', notes: 'โหมด: บิน' },
      trip: { destination: 'เชียงใหม่' },
    })
    expect(leg).toBeNull()
  })

  it('builds provider URLs from input labels', () => {
    const links = buildFlightProviderLinks({
      origin: 'กรุงเทพ',
      destination: 'เชียงใหม่',
      originLabel: 'กรุงเทพ',
      destinationLabel: 'เชียงใหม่',
      departDate: '2025-11-01',
      tripType: 'oneway',
      passengers: 2,
      cabin: 'economy',
    })
    expect(decodeURIComponent(links[0].url)).toMatch(/กรุงเทพ|เชียงใหม่/)
  })

  it('attachBookingLinks only adds flight_leg when input resolves', () => {
    const withLeg = attachBookingLinks(
      { type: 'transport', name: 'เที่ยวบิน กรุงเทพ–เชียงใหม่', notes: 'โหมด: บิน' },
      'เชียงใหม่',
      { trip: { origin: 'กรุงเทพ', destination: 'เชียงใหม่', start_date: '2025-11-01' }, dayDate: '2025-11-01' },
    )
    expect(withLeg.flight_leg?.originLabel).toBe('กรุงเทพ')

    const noLeg = attachBookingLinks(
      { type: 'transport', name: 'เที่ยวบิน', notes: 'โหมด: บิน' },
      'เชียงใหม่',
      { trip: { destination: 'เชียงใหม่' } },
    )
    expect(noLeg.flight_leg).toBeUndefined()
  })
})
