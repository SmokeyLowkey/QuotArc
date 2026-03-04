/**
 * Unit tests for phone number normalization utilities.
 */
import { describe, it, expect } from 'vitest'
import { normalizePhone, phonesMatch } from '@/lib/voice/phone'

describe('normalizePhone', () => {
  it('strips E.164 format to last 10 digits', () => {
    expect(normalizePhone('+14165551234')).toBe('4165551234')
  })

  it('handles bare 10-digit number', () => {
    expect(normalizePhone('4165551234')).toBe('4165551234')
  })

  it('handles formatted number with parens and dashes', () => {
    expect(normalizePhone('(416) 555-1234')).toBe('4165551234')
  })

  it('handles 11-digit with leading 1', () => {
    expect(normalizePhone('14165551234')).toBe('4165551234')
  })

  it('handles dots as separators', () => {
    expect(normalizePhone('416.555.1234')).toBe('4165551234')
  })

  it('handles spaces as separators', () => {
    expect(normalizePhone('416 555 1234')).toBe('4165551234')
  })

  it('returns null for too-short numbers', () => {
    expect(normalizePhone('5551234')).toBeNull()
  })

  it('returns null for null', () => {
    expect(normalizePhone(null)).toBeNull()
  })

  it('returns null for undefined', () => {
    expect(normalizePhone(undefined)).toBeNull()
  })

  it('returns null for empty string', () => {
    expect(normalizePhone('')).toBeNull()
  })
})

describe('phonesMatch', () => {
  it('matches E.164 against formatted', () => {
    expect(phonesMatch('+14165551234', '(416) 555-1234')).toBe(true)
  })

  it('matches two E.164 numbers', () => {
    expect(phonesMatch('+14165551234', '+14165551234')).toBe(true)
  })

  it('does not match different numbers', () => {
    expect(phonesMatch('+14165551234', '+14165559999')).toBe(false)
  })

  it('returns false when first is null', () => {
    expect(phonesMatch(null, '+14165551234')).toBe(false)
  })

  it('returns false when second is null', () => {
    expect(phonesMatch('+14165551234', null)).toBe(false)
  })

  it('returns false when both are null', () => {
    expect(phonesMatch(null, null)).toBe(false)
  })
})
