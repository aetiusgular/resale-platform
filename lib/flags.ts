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

// ── Fee Model v3 add-ons ─────────────────────────────────────────────────────
// Buyer milestone rewards (loyalty coupons at $1k/$5k/$10k rolling-year purchases).
export const BUYER_REWARDS_ENABLED =
  process.env.BUYER_REWARDS_ENABLED === 'true'
// Paid boosted/promoted listings. NEXT_PUBLIC so the seller UI can gate its entry point.
export const BOOSTED_POSTS_ENABLED =
  process.env.NEXT_PUBLIC_BOOSTED_POSTS_ENABLED === 'true'

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

// ── G11 identity locks (phone + payout-bank hard lock + card soft flag) ──────
// Anti-abuse anchor that replaced Persona ID verification at signup. The payout BANK
// fingerprint is hard-locked to one account (payouts blocked on a duplicate); the buyer
// CARD fingerprint is soft (a card seen on many accounts flags the order for moderation,
// never blocks — shared household cards are legitimate). Off by default like every other
// gap feature; turn on at launch. Phone uniqueness is already enforced in-DB.
export const IDENTITY_LOCKS_ENABLED =
  process.env.IDENTITY_LOCKS_ENABLED === 'true'
// A buyer card seen on at least this many OTHER accounts flags the order for moderation.
export const IDENTITY_CARD_MAX_OTHER_ACCOUNTS = 2

// ── Google OAuth sign-in/up (NEXT_PUBLIC — read in client auth pages). Off until the
// Google provider is configured in Supabase (see docs/GOOGLE_OAUTH_SETUP.md). ──
export const GOOGLE_AUTH_ENABLED =
  process.env.NEXT_PUBLIC_GOOGLE_AUTH_ENABLED === 'true'

// ── Fee model v2 §1f: tier dashboards (display only) ──
export const TIER_DASHBOARD_ENABLED =
  process.env.TIER_DASHBOARD_ENABLED === 'true'
