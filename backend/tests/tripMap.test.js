import { describe, it, expect } from 'vitest'
import {
  buildDayOverviewEmbedUrl,
  isValidMapCoords,
  mappableDayPlaces,
  showPlaceOnMap,
} from '../../src/lib/tripMap.js'

describe('trip day map', () => {
  it('maps hotels with coords and skips driving legs', () => {
    const places = [
      { id: 1, type: 'hotel', name: 'Hotel A', lat: 34.67, lng: 135.5 },
      { id: 2, type: 'transport', name: 'ขับรถ', notes: 'โหมด: รถ · ระยะทาง 20 กม.', lat: 34.7, lng: 135.6 },
      { id: 3, type: 'attraction', name: 'Castle', lat: 0, lng: 0 },
    ]
    const pins = mappableDayPlaces(places)
    expect(pins).toHaveLength(1)
    expect(pins[0].id).toBe(1)
    expect(showPlaceOnMap(places[1])).toBe(false)
  })

  it('builds a day overview embed from multiple pins', () => {
    const url = buildDayOverviewEmbedUrl({
      places: [
        { type: 'airport', name: 'KIX', lat: 34.43, lng: 135.24 },
        { type: 'hotel', name: 'Namba', lat: 34.66, lng: 135.5 },
      ],
    })
    expect(url).toContain('output=embed')
    expect(url).toContain('saddr=34.43,135.24')
    expect(url).toContain('daddr=34.66,135.5')
  })

  it('falls back to destination when no coords', () => {
    const url = buildDayOverviewEmbedUrl({
      places: [{ type: 'hotel', name: 'TBD' }],
      destination: 'Osaka',
    })
    expect(decodeURIComponent(url)).toContain('Osaka')
    expect(isValidMapCoords(null, null)).toBe(false)
  })
})
