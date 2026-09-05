/**
 * Auto-generated usernames (reference signup collects email + password only;
 * the username is derived and changeable 1× / 30 days in Settings). PURE.
 *
 * "jordan.demo+test@archive.supply" → "jordandemo"; a collision retries with a
 * 4-char suffix ("jordandemo_k3f9"). Always 3–30 chars of [a-z0-9_].
 */
const RESERVED = new Set(['admin', 'archive', 'support', 'moderator', 'root', 'system', 'null', 'undefined', 'me'])

export function usernameFromEmail(email: string, suffix?: string): string {
  const local = (email.split('@')[0] ?? '').split('+')[0].toLowerCase()
  let base = local.replace(/[^a-z0-9_]/g, '').slice(0, 20)
  if (base.length < 3 || RESERVED.has(base)) base = `${base}user`.slice(0, 20)
  if (base.length < 3) base = 'member'
  const tail = suffix ? `_${suffix.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 6)}` : ''
  return `${base}${tail}`.slice(0, 30)
}

/** Short random suffix for collision retries (browser + node). */
export function randomSuffix(len = 4): string {
  const alphabet = 'abcdefghjkmnpqrstuvwxyz23456789'
  let out = ''
  const buf = new Uint8Array(len)
  if (typeof crypto !== 'undefined' && 'getRandomValues' in crypto) crypto.getRandomValues(buf)
  else for (let i = 0; i < len; i++) buf[i] = Math.floor(Math.random() * 256)
  for (let i = 0; i < len; i++) out += alphabet[buf[i] % alphabet.length]
  return out
}

export const PASSWORD_MIN = 10
/** Reference rule: "MIN 10 CHARACTERS · AT LEAST 1 NUMBER". */
export function passwordProblem(pw: string): string | null {
  if (pw.length < PASSWORD_MIN) return `PASSWORD NEEDS AT LEAST ${PASSWORD_MIN} CHARACTERS`
  if (!/\d/.test(pw)) return 'PASSWORD NEEDS AT LEAST ONE NUMBER'
  return null
}
