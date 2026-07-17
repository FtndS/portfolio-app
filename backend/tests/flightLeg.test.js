import { describe, it, expect } from 'vitest'
import {
  buildFlightProviderLinks,
  extractIataCodes,
  lookupIata,
  parseRoutePair,
  resolveFlightLeg,
} from '../src/lib/flightLeg.js'
import { attachBookingLinks, buildBookingLinks } from '../src/lib/bookingLinks.js'

describe('flightLeg', () => {
  it('extracts IATA codes from text', () => {
    expect(extractIataCodes('สนามบินดอนเมือง (DMK)')).toContain('DMK')
    expect(extractIataCodes('DMK-CNX')).toEqual(expect.arrayContaining(['DMK', 'CNX']))
  })

  it('looks up Thai city names', () => {
    expect(lookupIata('เชียงใหม่')).toBe('CNX')
    expect(lookupIata('กรุงเทพ')).toBe('BKK')
    expect(lookupIata('ดอนเมือง')).toBe('DMK')
  })

  it('parses route from Thai dash format', () => {
    expect(parseRoutePair('เที่ยวบิน กรุงเทพ–เชียงใหม่')).toEqual({ from: 'BKK', to: 'CNX' })
    expect(parseRoutePair('DMK-CNX')).toEqual({ from: 'DMK', to: 'CNX' })
  })

  it('resolves flight leg with dates from trip', () => {
    const leg = resolveFlightLeg({
      place: {
        type: 'transport',
        name: 'เที่ยวบิน กรุงเทพ–เชียงใหม่',
        notes: 'โหมด: บิน',
      },
      trip: {
        destination: 'เชียงใหม่',
        start_date: '2025-11-01',
        end_date: '2025-11-05',
      },
      dayDate: '2025-11-01',
    })
    expect(leg.origin).toBe('BKK')
    expect(leg.destination).toBe('CNX')
    expect(leg.departDate).toBe('2025-11-01')
    expect(leg.returnDate).toBe('2025-11-05')
    expect(leg.tripType).toBe('roundtrip')
  })

  it('builds structured provider URLs', () => {
    const links = buildFlightProviderLinks({
      origin: 'DMK',
      destination: 'CNX',
      departDate: '2025-11-01',
      returnDate: '2025-11-05',
      tripType: 'roundtrip',
      passengers: 1,
      cabin: 'economy',
    })
    expect(links.length).toBeGreaterThanOrEqual(4)
    expect(links[0].label).toBe('Google Flights')
    expect(decodeURIComponent(links[0].url)).toMatch(/DMK/)
    expect(links.some((l) => l.label === 'Skyscanner' && l.url.includes('dmk/cnx'))).toBe(true)
  })

  it('attachBookingLinks adds flight_leg for flight transport', () => {
    const place = attachBookingLinks(
      {
        type: 'transport',
        name: 'เที่ยวบิน กรุงเทพ–เชียงใหม่',
        notes: 'โหมด: บิน',
      },
      'เชียงใหม่',
      {
        trip: { destination: 'เชียงใหม่', start_date: '2025-11-01', end_date: '2025-11-05' },
        dayDate: '2025-11-01',
      },
    )
    expect(place.flight_leg?.origin).toBe('BKK')
    expect(place.booking_links?.some((l) => l.label === 'Skyscanner')).toBe(true)
    expect(place.booking_links?.every((l) => l.url.startsWith('https://'))).toBe(true)
  })

  it('buildBookingLinks flight uses IATA in google url when leg resolved', () => {
    const links = buildBookingLinks({
      type: 'transport',
      name: 'เที่ยวบิน กรุงเทพ–เชียงใหม่',
      notes: 'โหมด: บิน',
      destination: 'เชียงใหม่',
      place: { type: 'transport', name: 'เที่ยวบิน กรุงเทพ–เชียงใหม่', notes: 'โหมด: บิน' },
      trip: { destination: 'เชียงใหม่', start_date: '2025-11-01' },
      dayDate: '2025-11-01',
    })
    const google = links.find((l) => l.label === 'Google Flights')
    expect(decodeURIComponent(google.url)).toMatch(/BKK/)
    expect(decodeURIComponent(google.url)).toMatch(/CNX/)
  })
})
