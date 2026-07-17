import { describe, it, expect } from 'vitest'
import {
  buildGoogleMapsEmbedUrl,
  buildGoogleMapsOpenUrl,
  isValidMapCoords,
  resolveTripPlaceMap,
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
})
