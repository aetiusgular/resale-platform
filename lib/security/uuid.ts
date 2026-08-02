/**
 * UUID validator — PURE. Rejects malformed admin path params before they reach the DB, so a
 * bad id returns a clean 400 instead of a 500 + a wasted round-trip (defense-in-depth).
 * Accepts a canonical RFC-4122 UUID (versions 1–5).
 */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_RE.test(value)
}
