import { describe, it, expect } from 'vitest'
import { buildQuery, isGooglePlacesConfigured } from '../src/lib/placeSearch.js'

describe('placeSearch', () => {
  it('builds search query with type hint and destination', () => {
    expect(buildQuery('โรงแรม', 'hotel', 'เชียงใหม่')).toMatch(/โรงแรม/)
    expect(buildQuery('โรงแรม', 'hotel', 'เชียงใหม่')).toMatch(/เชียงใหม่/)
    expect(buildQuery('', 'restaurant', 'ภูเก็ต')).toMatch(/restaurant/)
    expect(buildQuery('', 'restaurant', 'ภูเก็ต')).toMatch(/ภูเก็ต/)
  })

  it('reports google config from env', () => {
    const prev = process.env.GOOGLE_PLACES_API_KEY
    process.env.GOOGLE_PLACES_API_KEY = ''
    expect(isGooglePlacesConfigured()).toBe(false)
    process.env.GOOGLE_PLACES_API_KEY = 'test-key'
    expect(isGooglePlacesConfigured()).toBe(true)
    process.env.GOOGLE_PLACES_API_KEY = prev
  })
})
