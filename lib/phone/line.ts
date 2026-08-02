/**
 * Pure phone helpers — no I/O. E.164 normalization + line-type classification for the
 * VOIP/burner block (Branch 4 / L1). Tested; the Twilio adapter uses these.
 */
const E164 = /^\+[1-9]\d{6,14}$/

/** Normalize a user-entered number to E.164, or null if it can't be. Assumes US when no
 * country code is present (10 digits, or 11 starting with 1). */
export function normalizeE164(input: string, defaultCountry: 'US' = 'US'): string | null {
  const raw = (input ?? '').trim()
  if (E164.test(raw)) return raw
  const cleaned = raw.replace(/[^\d+]/g, '')
  if (cleaned.startsWith('+')) return E164.test(cleaned) ? cleaned : null
  const d = cleaned.replace(/\D/g, '')
  if (defaultCountry === 'US') {
    if (d.length === 10) return `+1${d}`
    if (d.length === 11 && d.startsWith('1')) return `+${d}`
  }
  return null
}

/** Twilio Lookup line types treated as burner/VOIP and blocked at signup. */
export const BLOCKED_LINE_TYPES = new Set(['voip', 'nonFixedVoip', 'fixedVoip', 'voicemail'])

export function isBlockedLineType(type: string | null | undefined): boolean {
  return typeof type === 'string' && BLOCKED_LINE_TYPES.has(type)
}
