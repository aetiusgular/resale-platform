/**
 * Invite code utilities.
 * Format: XXXX-XXXX
 * Alphabet: unambiguous (no 0/O/1/I)
 */

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const SEGMENT_LEN = 4

export function generateCode(): string {
  const seg = () =>
    Array.from({ length: SEGMENT_LEN }, () =>
      ALPHABET[Math.floor(Math.random() * ALPHABET.length)],
    ).join('')
  return `${seg()}-${seg()}`
}

export function normalizeCode(raw: string): string {
  return raw.trim().toUpperCase().replace(/[\s_]/g, '-')
}

export function isValidCodeFormat(code: string): boolean {
  // Unambiguous alphabet: A-H, J-N, P-Z (no I, O), 2-9 (no 0, 1)
  return /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/.test(normalizeCode(code))
}
