import { describe, it, expect } from 'vitest'
import {
  extractPlaceSearchQuery,
  isGenericPlaceName,
  pickUniquePlaceHit,
  resolvePlaceDisplayName,
  scorePlaceNameMatch,
} from '../src/lib/placeMatch.js'

describe('placeMatch', () => {
  it('detects generic AI place names', () => {
    expect(isGenericPlaceName('ร้านซีฟู้ดมื้อเย็น (แนะนำ: ร้านอาหารทะเลแถวท่าฉลอม)')).toBe(true)
    expect(isGenericPlaceName('ร้านเจ๊ไฝ ซีฟู้ด')).toBe(false)
  })

  it('extracts search query from recommendation text', () => {
    const q = extractPlaceSearchQuery(
      'ร้านซีฟู้ดมื้อเย็น (แนะนำ: ร้านอาหารทะเลแถวท่าฉลอม-มหาชัย)',
      'restaurant',
      'สมุทรสาคร'
    )
    expect(q).toContain('ท่าฉลอม')
  })

  it('falls back to type + destination for vague names', () => {
    const q = extractPlaceSearchQuery('ร้านซีฟู้ดมื้อเย็น', 'restaurant', 'สมุทรสาคร')
    expect(q).toContain('ร้านอาหาร')
    expect(q).toContain('สมุทรสาคร')
  })

  it('picks unique hits and skips duplicate media', () => {
    const used = new Set()
    const results = [
      { id: 'a', name: 'ตลาดมหาชัย', photoUrl: '/photo/a.jpg' },
      { id: 'b', name: 'สะพานปลาสมุทรสาคร', photoUrl: '/photo/b.jpg' },
    ]
    const first = pickUniquePlaceHit(results, 'ตลาดมหาชัย', used)
    expect(first?.id).toBe('a')
    used.add('photo:/photo/a.jpg')

    const dupResults = [
      { id: 'a2', name: 'สะพานปลา', photoUrl: '/photo/a.jpg' },
      { id: 'b2', name: 'สะพานปลาสมุทรสาคร', photoUrl: '/photo/b.jpg' },
    ]
    const second = pickUniquePlaceHit(dupResults, 'สะพานปลาสมุทรสาคร', used)
    expect(second?.photoUrl).toBe('/photo/b.jpg')
  })

  it('resolves display name from search hit when generic', () => {
    expect(
      resolvePlaceDisplayName(
        'ร้านซีฟู้ดมื้อเย็น (แนะนำ: ...)',
        'ร้านอาหารทะเลเจ้าเก่า'
      )
    ).toBe('ร้านอาหารทะเลเจ้าเก่า')
    expect(resolvePlaceDisplayName('ตลาดมหาชัย', 'Mahachai Market')).toBe('ตลาดมหาชัย')
  })

  it('scores name similarity', () => {
    expect(scorePlaceNameMatch('ตลาดมหาชัย', 'ตลาดมหาชัย สมุทรสาคร')).toBeGreaterThan(0.5)
  })
})
