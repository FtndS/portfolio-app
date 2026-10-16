import { describe, it, expect } from 'vitest'
import { decodeEntities } from '../src/lib/htmlEntities.js'

describe('decodeEntities', () => {
  it('decodes named and numeric references once', () => {
    expect(decodeEntities('Real Value &amp; Impact')).toBe('Real Value & Impact')
    expect(decodeEntities('Nvidia&#39;s &quot;win&quot; &#x2014; ok')).toBe('Nvidia\'s "win" — ok')
    expect(decodeEntities('a?x=1&amp;oc=5')).toBe('a?x=1&oc=5')
    expect(decodeEntities('&amp;amp;')).toBe('&amp;')
  })

  it('leaves unknown references and plain text alone', () => {
    expect(decodeEntities('AT&T &foo; หุ้นไทย')).toBe('AT&T &foo; หุ้นไทย')
    expect(decodeEntities(undefined)).toBe('')
  })
})
