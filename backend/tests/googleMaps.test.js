import { describe, it, expect } from 'vitest'
import { buildGoogleMapsEmbedUrl, buildGoogleMapsOpenUrl } from '../src/lib/googleMaps.js'

describe('googleMaps urls', () => {
  it('builds open url with place id', () => {
    const url = buildGoogleMapsOpenUrl({
      name: 'Patong Beach',
      placeId: 'ChIJxyz',
    })
    expect(url).toContain('query_place_id=ChIJxyz')
    expect(url).toContain('Patong')
  })

  it('builds embed url from coordinates without requiring key', () => {
    const url = buildGoogleMapsEmbedUrl({
      name: 'Kata Mama',
      lat: 7.81,
      lng: 98.3,
    })
    expect(url).toContain('google.com/maps')
    expect(url).toContain('7.81')
    expect(url).toContain('98.3')
    expect(url).toContain('output=embed')
  })

  it('builds embed url from name query', () => {
    const url = buildGoogleMapsEmbedUrl({
      name: 'Baan Rim Pa',
      destination: 'Phuket',
    })
    expect(url).toContain('output=embed')
    expect(decodeURIComponent(url)).toContain('Baan Rim Pa')
  })
})
