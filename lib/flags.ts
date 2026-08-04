/**
 * Feature flags — checked at runtime, not build time.
 * Server-only values (no NEXT_PUBLIC_ prefix where not needed).
 *
 * Pre-launch gap features each ship behind their own flag, OFF by default, so
 * partial/in-progress work never affects production. See docs/LAUNCH_ROADMAP.md
 * for the phase that turns each on.
 */

export const VERIFICATION_ENABLED =
  process.env.VERIFICATION_ENABLED === 'true'

// ── Recommendation engine (recs-engine microservice) ────────────────────────
// Platform stays fully functional with this false — discovery/browse falls back
// to the existing default listing order and telemetry is a no-op.
export const RECS_ENABLED =
  process.env.RECS_ENABLED === 'true'

// Client-side telemetry gate (NEXT_PUBLIC — read in the browser). Keep in step with
// RECS_ENABLED on the server: when off, the browser emits no recs telemetry at all.
export const RECS_TELEMETRY_ENABLED =
  process.env.NEXT_PUBLIC_RECS_ENABLED === 'true'

// ── Pre-launch gap features (see docs/LAUNCH_ROADMAP.md) ─────────────────────
export const BUMP_ENABLED =
  process.env.BUMP_ENABLED === 'true'
export const SAVED_SEARCH_ALERTS_ENABLED =
  process.env.SAVED_SEARCH_ALERTS_ENABLED === 'true'
export const NOTIFICATIONS_ENABLED =
  process.env.NOTIFICATIONS_ENABLED === 'true'
export const AUTH_BADGE_ENABLED =
  process.env.AUTH_BADGE_ENABLED === 'true'
export const SHIPPING_LABELS_ENABLED =
  process.env.SHIPPING_LABELS_ENABLED === 'true'
export const FOLLOWS_ENABLED =
  process.env.FOLLOWS_ENABLED === 'true'
export const REVIEWS_ENABLED =
  process.env.REVIEWS_ENABLED === 'true'

// ── Branch 4: anti-fraud ──
export const COLLUSION_HOLD_ENABLED =
  process.env.COLLUSION_HOLD_ENABLED === 'true'
export const PHONE_VERIFICATION_ENABLED =
  process.env.PHONE_VERIFICATION_ENABLED === 'true'

// ── Google OAuth sign-in/up (NEXT_PUBLIC — read in client auth pages). Off until the
// Google provider is configured in Supabase (see docs/GOOGLE_OAUTH_SETUP.md). ──
export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

// ── Fee model v2 §1f: tier dashboards (display only) ──
export const TIER_DASHBOARD_ENABLED =
  process.env.TIER_DASHBOARD_ENABLED === 'true'
