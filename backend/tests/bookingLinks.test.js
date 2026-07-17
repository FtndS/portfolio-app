import { describe, it, expect } from 'vitest'
import {
  attachBookingLinks,
  buildBookingLinks,
  inferTransportMode,
  sanitizeBookingLinks,
} from '../src/lib/bookingLinks.js'

describe('bookingLinks', () => {
  it('builds hotel links for Agoda Booking Trip.com', () => {
    const links = buildBookingLinks({
      type: 'hotel',
      name: 'Hotel Gracery Shinjuku',
      destination: 'Tokyo',
    })
    const hosts = links.map((l) => new URL(l.url).hostname)
    expect(links.map((l) => l.label)).toEqual(['Agoda', 'Booking.com', 'Trip.com'])
    expect(hosts.some((h) => h.includes('agoda'))).toBe(true)
    expect(hosts.some((h) => h.includes('booking'))).toBe(true)
    expect(hosts.some((h) => h.includes('trip.com'))).toBe(true)
  })

  it('builds flight links for airport and flight transport', () => {
    const airport = buildBookingLinks({ type: 'airport', name: 'สนามบินสุวรรณภูมิ' })
    expect(airport.some((l) => l.label === 'Google Flights')).toBe(true)

    const flight = buildBookingLinks({
      type: 'transport',
      name: 'เที่ยวบิน กรุงเทพ–เชียงใหม่',
      notes: 'โหมด: บิน',
    })
    expect(inferTransportMode('เที่ยวบิน กรุงเทพ–เชียงใหม่', 'โหมด: บิน')).toBe('flight')
    expect(flight.some((l) => l.kind === 'flight')).toBe(true)
  })

  it('builds 12Go links for train/ferry and Grab for car', () => {
    const train = buildBookingLinks({
      type: 'transport',
      name: 'รถไฟสายใต้ กรุงเทพ–หัวหิน',
      notes: 'โหมด: รถไฟ',
    })
    expect(train.some((l) => l.label === '12Go')).toBe(true)

    const car = buildBookingLinks({
      type: 'transport',
      name: 'Grab ไปตลาดมหาชัย',
      notes: 'โหมด: รถ',
    })
    expect(car.some((l) => l.label === 'Grab')).toBe(true)
  })

  it('skips restaurant and attraction', () => {
    expect(buildBookingLinks({ type: 'restaurant', name: 'Ichiran' })).toEqual([])
    expect(buildBookingLinks({ type: 'attraction', name: 'ตลาดมหาชัย' })).toEqual([])
  })

  it('sanitizes allowlisted https only', () => {
    const ok = sanitizeBookingLinks([
      { label: 'Agoda', url: 'https://www.agoda.com/search?q=x', kind: 'hotel' },
      { label: 'Evil', url: 'https://evil.example/phish', kind: 'hotel' },
      { label: 'Http', url: 'http://www.agoda.com/x', kind: 'hotel' },
      { label: 'Bad', url: 'not-a-url', kind: 'hotel' },
    ])
    expect(ok).toHaveLength(1)
    expect(ok[0].label).toBe('Agoda')
  })

  it('attachBookingLinks overwrites with curated list', () => {
    const place = attachBookingLinks(
      {
        type: 'hotel',
        name: 'Marriott Bangkok',
        booking_links: [{ label: 'Fake', url: 'https://evil.example' }],
      },
      'Bangkok'
    )
    expect(place.booking_links.every((l) => l.url.startsWith('https://'))).toBe(true)
    expect(place.booking_links.some((l) => l.label === 'Agoda')).toBe(true)
  })
})
