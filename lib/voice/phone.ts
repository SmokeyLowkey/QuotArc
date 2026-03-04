/**
 * Phone number normalization utilities for caller recognition.
 */

/**
 * Strip a phone string to its last 10 digits (North American).
 * Returns null if fewer than 10 digits remain.
 *
 * "+14165551234"   → "4165551234"
 * "(416) 555-1234" → "4165551234"
 * "4165551234"     → "4165551234"
 * "5551234"        → null (too short)
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/\D/g, '')
  if (digits.length < 10) return null
  return digits.slice(-10)
}

/**
 * Check if two phone numbers match after normalization.
 */
export function phonesMatch(a: string | null | undefined, b: string | null | undefined): boolean {
  const na = normalizePhone(a)
  const nb = normalizePhone(b)
  if (!na || !nb) return false
  return na === nb
}
