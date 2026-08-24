import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateName,
  validateOtpCode,
  validateTickerSymbol,
  parseFee,
  normalizeEmail,
} from '../src/lib/validate.js'
import { createLruCache } from '../src/lib/lruCache.js'

describe('validateEmail', () => {
  it('accepts valid email', () => {
    expect(validateEmail('user@example.com')).toBeNull()
  })

  it('rejects missing email', () => {
    expect(validateEmail('')).toBeTruthy()
  })

  it('rejects disposable email', () => {
    expect(validateEmail('test@mailinator.com')).toMatch(/ชั่วคราว/)
  })
})

describe('validatePassword', () => {
  it('requires minimum length', () => {
    expect(validatePassword('short')).toMatch(/8/)
  })

  it('accepts valid password', () => {
    expect(validatePassword('longenough')).toBeNull()
  })

  it('caps maximum length at 128', () => {
    expect(validatePassword('a'.repeat(128))).toBeNull()
    expect(validatePassword('a'.repeat(129))).toMatch(/128/)
  })
})

describe('validateTickerSymbol', () => {
  it('accepts normal tickers', () => {
    expect(validateTickerSymbol('AAPL')).toBeNull()
    expect(validateTickerSymbol('PTT-BK')).toBeNull()
    expect(validateTickerSymbol('BRK.B')).toBeNull()
  })

  it('rejects invalid or oversized symbols', () => {
    expect(validateTickerSymbol('')).toBeTruthy()
    expect(validateTickerSymbol('AAPL;DROP TABLE')).toBeTruthy()
    expect(validateTickerSymbol('a'.repeat(21))).toBeTruthy()
    expect(validateTickerSymbol('../etc/passwd')).toBeTruthy()
  })
})

describe('createLruCache', () => {
  it('evicts oldest entry past maxSize', () => {
    const cache = createLruCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.set('c', 3)
    expect(cache.size).toBe(2)
    expect(cache.get('a')).toBeUndefined()
    expect(cache.get('b')).toBe(2)
    expect(cache.get('c')).toBe(3)
  })

  it('refreshes recency on get', () => {
    const cache = createLruCache(2)
    cache.set('a', 1)
    cache.set('b', 2)
    cache.get('a')
    cache.set('c', 3)
    expect(cache.get('a')).toBe(1)
    expect(cache.get('b')).toBeUndefined()
  })
})

describe('validateName', () => {
  it('rejects empty name', () => {
    expect(validateName('   ')).toBeTruthy()
  })

  it('accepts trimmed name', () => {
    expect(validateName('Tanadon')).toBeNull()
  })
})

describe('validateOtpCode', () => {
  it('requires 6 digits', () => {
    expect(validateOtpCode('12345')).toBeTruthy()
    expect(validateOtpCode('123456')).toBeNull()
    expect(validateOtpCode('123 456')).toBeNull()
  })
})

describe('parseFee', () => {
  it('defaults empty to 0', () => {
    expect(parseFee('')).toBe(0)
    expect(parseFee(null)).toBe(0)
  })

  it('parses valid fee', () => {
    expect(parseFee('1.25')).toBe(1.25)
  })

  it('rejects negative fee', () => {
    expect(parseFee('-1')).toBeNull()
  })
})

describe('normalizeEmail', () => {
  it('lowercases and trims', () => {
    expect(normalizeEmail('  User@Example.COM ')).toBe('user@example.com')
  })
})
