import { describe, it, expect } from 'vitest'
import {
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsOpenUrl,
  buildMapSearchQueries,
  cleanMapSearchQuery,
  isValidMapCoords,
  resolveTripPlaceMap,
  shouldBiasSearchWithDestination,
} from '../src/lib/googleMaps.js'

describe('googleMaps urls', () => {
  it('rejects null-island coordinates', () => {
    expect(isValidMapCoords(0, 0)).toBe(false)
    expect(isValidMapCoords(0.001, -0.001)).toBe(false)
    expect(isValidMapCoords(7.89, 98.29)).toBe(true)
  })

  it('builds open url with place id', () => {
    const url = buildGoogleMapsOpenUrl({
      name: 'Patong Beach',
      placeId: 'ChIJxyz',
    })
    expect(url).toContain('query_place_id=ChIJxyz')
    expect(url).toContain('Patong')
  })

  it('prefers place name over null-island coords for embed', () => {
    const url = buildGoogleMapsEmbedUrl({
      name: 'Baan Rim Pa',
      address: 'Patong, Phuket',
      destination: 'Phuket',
      lat: 0,
      lng: 0,
    })
    expect(url).toContain('output=embed')
    expect(decodeURIComponent(url)).toContain('Baan Rim Pa')
    expect(url).not.toMatch(/q=0(,|%2C)0/)
  })

  it('builds embed url from name query', () => {
    const url = buildGoogleMapsEmbedUrl({
      name: 'Baan Rim Pa',
      destination: 'Phuket',
    })
    expect(url).toContain('output=embed')
    expect(decodeURIComponent(url)).toContain('Baan Rim Pa')
  })

  it('resolve prefers search hit coords over 0,0 request', async () => {
    const search = async () => [{
      name: 'บ้านริมผา',
      address: 'Patong, Phuket',
      lat: 7.916,
      lng: 98.296,
      externalId: 'ChIJabc',
      source: 'google',
      rating: 4.2,
    }]
    const r = await resolveTripPlaceMap(search, {
      name: 'Baan Rim Pa',
      type: 'restaurant',
      near: 'Phuket',
      lat: 0,
      lng: 0,
    })
    expect(r.place.lat).toBeCloseTo(7.916)
    expect(r.place.lng).toBeCloseTo(98.296)
    expect(decodeURIComponent(r.embedUrl)).toMatch(/Baan|บ้านริมผา|Patong|Phuket/i)
    expect(r.embedUrl).not.toMatch(/q=0(,|%2C)0/)
  })

  it('does not bias airport search with trip destination and ignores wrong stored coords', async () => {
    const calls = []
    const search = async (opts) => {
      calls.push(opts)
      return [{
        name: 'Don Mueang International Airport',
        address: 'Don Mueang, Bangkok',
        lat: 13.9126,
        lng: 100.6067,
        externalId: 'ChIJdmk',
        source: 'google',
      }, {
        name: 'Navatanee Golf Course',
        address: 'Khan Na Yao',
        lat: 13.82,
        lng: 100.68,
        externalId: 'ChIJwrong',
        source: 'google',
      }]
    }
    const r = await resolveTripPlaceMap(search, {
      name: 'สนามบินดอนเมือง (DMK)',
      type: 'airport',
      near: 'เชียงใหม่',
      lat: 13.82,
      lng: 100.68,
    })
    expect(calls[0].near).toBe('')
    expect(r.place.lat).toBeCloseTo(13.9126)
    expect(r.place.placeId).toBe('ChIJdmk')
    expect(decodeURIComponent(r.embedUrl)).not.toMatch(/เชียงใหม่/)
  })

  it('builds restaurant search queries with English name and destination', () => {
    const qs = buildMapSearchQueries(
      'ร้านอาหาร โขงข้าว (Khong Khao Restaurant)',
      'ถนนราชดำเนิน เมืองเก่า เชียงใหม่',
      'เชียงใหม่',
      'restaurant',
    )
    expect(qs.some((q) => /Khong Khao/i.test(q))).toBe(true)
    expect(qs.some((q) => /เชียงใหม่/.test(q))).toBe(true)
    expect(cleanMapSearchQuery('ร้านอาหาร โขงข้าว (Khong Khao Restaurant)')).toBe('โขงข้าว (Khong Khao Restaurant)')
  })

  it('uses destination bias for restaurants but not airports', () => {
    expect(shouldBiasSearchWithDestination('ร้านอาหาร โขงข้าว (Khong Khao Restaurant)', 'restaurant')).toBe(true)
    expect(shouldBiasSearchWithDestination('สนามบินดอนเมือง (DMK)', 'airport')).toBe(false)
  })

  it('resolves bilingual restaurant via English search query', async () => {
    const calls = []
    const search = async (opts) => {
      calls.push(opts)
      if (/Khong Khao/i.test(opts.query)) {
        return [{
          name: 'Khong Khao Restaurant',
          address: 'Ratchadamnoen Rd, Chiang Mai',
          lat: 18.788,
          lng: 98.993,
          externalId: 'ChIJkhong',
          source: 'google',
        }]
      }
      return []
    }
    const r = await resolveTripPlaceMap(search, {
      name: 'ร้านอาหาร โขงข้าว (Khong Khao Restaurant)',
      type: 'restaurant',
      near: 'เชียงใหม่',
      address: 'ถนนราชดำเนิน เมืองเก่า เชียงใหม่',
      lat: 18.79,
      lng: 98.99,
    })
    expect(calls.some((c) => /Khong Khao/i.test(c.query))).toBe(true)
    expect(calls.some((c) => c.near === 'เชียงใหม่')).toBe(true)
    expect(r.place.lat).toBeCloseTo(18.788)
    expect(r.place.placeId).toBe('ChIJkhong')
  })
})
