import { describe, it, expect } from 'vitest'
import {
  enumerateDateRange,
  normalizePlacePayload,
  normalizeTripPayload,
  isValidPlaceType,
} from '../src/lib/tripHelpers.js'

describe('tripHelpers', () => {
  it('enumerates inclusive date ranges', () => {
    expect(enumerateDateRange('2026-07-01', '2026-07-03')).toEqual([
      '2026-07-01',
      '2026-07-02',
      '2026-07-03',
    ])
    expect(enumerateDateRange('2026-07-03', '2026-07-01')).toEqual([])
    expect(enumerateDateRange(null, '2026-07-01')).toEqual([])
  })

  it('validates place types', () => {
    expect(isValidPlaceType('hotel')).toBe(true)
    expect(isValidPlaceType('cafe')).toBe(false)
  })

  it('normalizes trip payload', () => {
    const ok = normalizeTripPayload({
      title: '  Chiang Mai ',
      start_date: '2026-08-01',
      end_date: '2026-08-03',
    })
    expect(ok.error).toBeUndefined()
    expect(ok.title).toBe('Chiang Mai')
    expect(ok.currency).toBe('THB')

    expect(normalizeTripPayload({ title: '' }).error).toBeTruthy()
    expect(normalizeTripPayload({
      title: 'X',
      start_date: '2026-08-05',
      end_date: '2026-08-01',
    }).error).toBeTruthy()
  })

  it('normalizes place payload', () => {
    const ok = normalizePlacePayload({
      name: 'วัดพระธาตุดอยสุเทพ',
      type: 'attraction',
      lat: 18.8045,
      lng: 98.9215,
    })
    expect(ok.error).toBeUndefined()
    expect(ok.type).toBe('attraction')

    expect(normalizePlacePayload({ name: 'A', lat: 1 }).error).toBeTruthy()
    expect(normalizePlacePayload({ name: '', type: 'hotel' }).error).toBeTruthy()

    const withPhoto = normalizePlacePayload({
      name: 'Hotel X',
      type: 'hotel',
      photo_url: ' https://example.com/a.jpg ',
      external_id: 'abc',
      external_source: 'google',
    })
    expect(withPhoto.photo_url).toBe('https://example.com/a.jpg')
    expect(withPhoto.external_source).toBe('google')
  })
})
