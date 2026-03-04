/**
 * Scheduling utility functions for voice agent availability checking.
 * Extracted for testability.
 */

export function timeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number)
  return h * 60 + (m || 0)
}

export function minutesToTime(minutes: number): string {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

export function formatTimeForSpeech(time: string): string {
  const [h, m] = time.split(':').map(Number)
  const period = h >= 12 ? 'pm' : 'am'
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h
  return m > 0 ? `${hour}:${String(m).padStart(2, '0')}${period}` : `${hour}${period}`
}

export const DAY_NAMES: Record<number, string> = {
  0: 'sun', 1: 'mon', 2: 'tue', 3: 'wed', 4: 'thu', 5: 'fri', 6: 'sat',
}

/**
 * Get today's date as YYYY-MM-DD in the given IANA timezone.
 * Falls back to UTC if the timezone is invalid.
 */
export function todayInTimezone(tz: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: tz,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(new Date())
    const y = parts.find(p => p.type === 'year')!.value
    const m = parts.find(p => p.type === 'month')!.value
    const d = parts.find(p => p.type === 'day')!.value
    return `${y}-${m}-${d}`
  } catch {
    return new Date().toISOString().split('T')[0]
  }
}

/**
 * Get the day-of-week index (0=Sun) for a YYYY-MM-DD string
 * interpreted in the given IANA timezone.
 */
export function dayOfWeekInTimezone(dateStr: string, tz: string): number {
  try {
    const weekday = new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'short',
    }).format(new Date(dateStr + 'T12:00:00Z'))
    const map: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 }
    return map[weekday] ?? new Date(dateStr + 'T12:00:00Z').getUTCDay()
  } catch {
    return new Date(dateStr + 'T12:00:00Z').getUTCDay()
  }
}

/**
 * Format a YYYY-MM-DD date string for speech, using the given timezone.
 */
export function formatDateForSpeech(dateStr: string, tz: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: tz,
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    }).format(new Date(dateStr + 'T12:00:00Z'))
  } catch {
    return new Date(dateStr + 'T12:00:00Z').toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    })
  }
}

export interface TimeWindow {
  start: number
  end: number
}

/**
 * Find available time slots within business hours that aren't occupied.
 * Returns slot start times in HH:MM format.
 */
export function findAvailableSlots(
  businessStart: number,
  businessEnd: number,
  jobDurationMinutes: number,
  occupied: TimeWindow[],
): string[] {
  const sorted = [...occupied].sort((a, b) => a.start - b.start)
  const slots: string[] = []
  let cursor = businessStart

  for (const window of sorted) {
    // Fill every slot in the free window before this occupied block
    while (cursor + jobDurationMinutes <= window.start) {
      slots.push(minutesToTime(cursor))
      cursor += jobDurationMinutes
    }
    cursor = Math.max(cursor, window.end)
  }
  // Fill remaining slots after the last occupied block
  while (cursor + jobDurationMinutes <= businessEnd) {
    slots.push(minutesToTime(cursor))
    cursor += jobDurationMinutes
  }

  return slots
}

/**
 * Filter slots by time preference (morning = before noon, afternoon = noon+).
 */
export function filterSlotsByPreference(
  slots: string[],
  preference?: string,
): string[] {
  if (preference === 'morning') {
    return slots.filter(s => timeToMinutes(s) < 720)
  }
  if (preference === 'afternoon') {
    return slots.filter(s => timeToMinutes(s) >= 720)
  }
  return slots
}

/**
 * Format a list of time slots into natural speech.
 */
export function formatSlotsForSpeech(slots: string[]): string {
  const descriptions = slots.slice(0, 3).map(formatTimeForSpeech)
  if (descriptions.length === 1) return descriptions[0]
  return `${descriptions.slice(0, -1).join(', ')} or ${descriptions[descriptions.length - 1]}`
}
