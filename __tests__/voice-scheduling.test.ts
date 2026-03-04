import { describe, it, expect } from 'vitest'
import {
  timeToMinutes,
  minutesToTime,
  formatTimeForSpeech,
  DAY_NAMES,
  findAvailableSlots,
  filterSlotsByPreference,
  formatSlotsForSpeech,
} from '@/lib/voice/scheduling'

// ─── timeToMinutes ──────────────────────────────────────────────

describe('timeToMinutes', () => {
  it('converts midnight', () => {
    expect(timeToMinutes('00:00')).toBe(0)
  })

  it('converts morning time', () => {
    expect(timeToMinutes('09:00')).toBe(540)
  })

  it('converts afternoon time', () => {
    expect(timeToMinutes('13:30')).toBe(810)
  })

  it('converts end of day', () => {
    expect(timeToMinutes('17:00')).toBe(1020)
  })

  it('handles time without minutes part', () => {
    expect(timeToMinutes('9:00')).toBe(540)
  })
})

// ─── minutesToTime ──────────────────────────────────────────────

describe('minutesToTime', () => {
  it('converts 0 to 00:00', () => {
    expect(minutesToTime(0)).toBe('00:00')
  })

  it('converts 540 to 09:00', () => {
    expect(minutesToTime(540)).toBe('09:00')
  })

  it('converts 810 to 13:30', () => {
    expect(minutesToTime(810)).toBe('13:30')
  })

  it('pads single-digit hours', () => {
    expect(minutesToTime(60)).toBe('01:00')
  })

  it('roundtrips with timeToMinutes', () => {
    const times = ['00:00', '08:30', '12:00', '17:45', '23:59']
    for (const time of times) {
      expect(minutesToTime(timeToMinutes(time))).toBe(time)
    }
  })
})

// ─── formatTimeForSpeech ────────────────────────────────────────

describe('formatTimeForSpeech', () => {
  it('formats morning time', () => {
    expect(formatTimeForSpeech('09:00')).toBe('9am')
  })

  it('formats afternoon time', () => {
    expect(formatTimeForSpeech('14:00')).toBe('2pm')
  })

  it('formats noon', () => {
    expect(formatTimeForSpeech('12:00')).toBe('12pm')
  })

  it('formats midnight', () => {
    expect(formatTimeForSpeech('00:00')).toBe('12am')
  })

  it('includes minutes when non-zero', () => {
    expect(formatTimeForSpeech('09:30')).toBe('9:30am')
    expect(formatTimeForSpeech('14:15')).toBe('2:15pm')
  })
})

// ─── DAY_NAMES ──────────────────────────────────────────────────

describe('DAY_NAMES', () => {
  it('maps all 7 days', () => {
    expect(Object.keys(DAY_NAMES)).toHaveLength(7)
    expect(DAY_NAMES[0]).toBe('sun')
    expect(DAY_NAMES[1]).toBe('mon')
    expect(DAY_NAMES[5]).toBe('fri')
    expect(DAY_NAMES[6]).toBe('sat')
  })
})

// ─── findAvailableSlots ─────────────────────────────────────────

describe('findAvailableSlots', () => {
  const businessStart = timeToMinutes('08:00') // 480
  const businessEnd = timeToMinutes('17:00') // 1020
  const jobDuration = 120 // 2 hours

  it('returns all possible slots when no jobs exist', () => {
    const slots = findAvailableSlots(businessStart, businessEnd, jobDuration, [])
    // First slot at 08:00, with 2h duration, last possible slot at 15:00
    expect(slots[0]).toBe('08:00')
    expect(slots.length).toBeGreaterThan(0)
    // All slots should be within business hours
    for (const slot of slots) {
      const m = timeToMinutes(slot)
      expect(m).toBeGreaterThanOrEqual(businessStart)
      expect(m + jobDuration).toBeLessThanOrEqual(businessEnd)
    }
  })

  it('finds slot before an existing job', () => {
    const occupied = [{ start: timeToMinutes('10:00'), end: timeToMinutes('12:00') }]
    const slots = findAvailableSlots(businessStart, businessEnd, jobDuration, occupied)
    expect(slots).toContain('08:00')
  })

  it('finds slot after an existing job', () => {
    const occupied = [{ start: timeToMinutes('08:00'), end: timeToMinutes('10:00') }]
    const slots = findAvailableSlots(businessStart, businessEnd, jobDuration, occupied)
    expect(slots).toContain('10:00')
  })

  it('finds no slots when fully booked', () => {
    const occupied = [
      { start: timeToMinutes('08:00'), end: timeToMinutes('10:00') },
      { start: timeToMinutes('10:00'), end: timeToMinutes('12:00') },
      { start: timeToMinutes('12:00'), end: timeToMinutes('14:00') },
      { start: timeToMinutes('14:00'), end: timeToMinutes('16:00') },
      { start: timeToMinutes('16:00'), end: timeToMinutes('18:00') },
    ]
    const slots = findAvailableSlots(businessStart, businessEnd, jobDuration, occupied)
    expect(slots).toHaveLength(0)
  })

  it('finds gap between two jobs', () => {
    const occupied = [
      { start: timeToMinutes('08:00'), end: timeToMinutes('10:00') },
      { start: timeToMinutes('14:00'), end: timeToMinutes('16:00') },
    ]
    const slots = findAvailableSlots(businessStart, businessEnd, jobDuration, occupied)
    // Algorithm returns earliest possible start per gap
    expect(slots).toContain('10:00')
    // After the second job (16:00), there should be no room (17:00 - 16:00 = 1h < 2h)
    expect(slots).not.toContain('16:00')
    // Also verify 16:00 after second job
    expect(slots.length).toBeGreaterThanOrEqual(1)
  })

  it('does not return slot if gap is too small', () => {
    // 1h gap between 10:00-11:00, but job needs 2h
    const occupied = [
      { start: timeToMinutes('08:00'), end: timeToMinutes('10:00') },
      { start: timeToMinutes('11:00'), end: timeToMinutes('13:00') },
    ]
    const slots = findAvailableSlots(businessStart, businessEnd, jobDuration, occupied)
    expect(slots).not.toContain('10:00')
    // Should still find slot after 13:00
    expect(slots).toContain('13:00')
  })

  it('handles unsorted occupied windows', () => {
    const occupied = [
      { start: timeToMinutes('14:00'), end: timeToMinutes('16:00') },
      { start: timeToMinutes('08:00'), end: timeToMinutes('10:00') },
    ]
    const slots = findAvailableSlots(businessStart, businessEnd, jobDuration, occupied)
    expect(slots).toContain('10:00')
  })

  it('handles 30-minute job durations', () => {
    const shortDuration = 30
    const occupied = [
      { start: timeToMinutes('09:00'), end: timeToMinutes('09:30') },
    ]
    const slots = findAvailableSlots(businessStart, businessEnd, shortDuration, occupied)
    // Should find 08:00 (before job) and 09:30 (after job)
    expect(slots).toContain('08:00')
    expect(slots).toContain('09:30')
  })
})

// ─── filterSlotsByPreference ────────────────────────────────────

describe('filterSlotsByPreference', () => {
  const slots = ['08:00', '10:00', '13:00', '15:00']

  it('returns all slots for "any" or no preference', () => {
    expect(filterSlotsByPreference(slots, 'any')).toEqual(slots)
    expect(filterSlotsByPreference(slots, undefined)).toEqual(slots)
  })

  it('filters morning slots (before noon)', () => {
    const result = filterSlotsByPreference(slots, 'morning')
    expect(result).toEqual(['08:00', '10:00'])
  })

  it('filters afternoon slots (noon and after)', () => {
    const result = filterSlotsByPreference(slots, 'afternoon')
    expect(result).toEqual(['13:00', '15:00'])
  })

  it('returns empty array if no slots match preference', () => {
    const morningOnly = ['08:00', '10:00']
    expect(filterSlotsByPreference(morningOnly, 'afternoon')).toEqual([])
  })
})

// ─── formatSlotsForSpeech ───────────────────────────────────────

describe('formatSlotsForSpeech', () => {
  it('formats single slot', () => {
    expect(formatSlotsForSpeech(['09:00'])).toBe('9am')
  })

  it('formats two slots with "or"', () => {
    expect(formatSlotsForSpeech(['09:00', '14:00'])).toBe('9am or 2pm')
  })

  it('formats three slots with comma and "or"', () => {
    expect(formatSlotsForSpeech(['09:00', '13:00', '15:00'])).toBe('9am, 1pm or 3pm')
  })

  it('limits to first 3 slots', () => {
    const result = formatSlotsForSpeech(['08:00', '10:00', '13:00', '15:00'])
    expect(result).toBe('8am, 10am or 1pm')
  })
})
