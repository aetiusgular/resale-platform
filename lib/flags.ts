/**
 * Feature flags — checked at runtime, not build time.
 * Server-only values (no NEXT_PUBLIC_ prefix where not needed).
 */

export const VERIFICATION_ENABLED =
  process.env.VERIFICATION_ENABLED === 'true'
