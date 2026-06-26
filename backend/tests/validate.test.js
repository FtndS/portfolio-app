import { describe, it, expect } from 'vitest'
import {
  validateEmail,
  validatePassword,
  validateName,
  validateOtpCode,
  parseFee,
} from '../src/lib/validate.js'

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
