/**
 * Listing "bump" (refresh) eligibility — PURE. No DB, no I/O, no clock read
 * (the caller passes `nowMs`, so the rule is deterministic and testable).
 *
 * A bump lifts an active listing back up the browse/feed ordering. The rule
 * (Grailed-style) gives sellers a free bump on a cadence, plus an early bump when
 * they make a real price cut:
 *
 *   1. FIRST BUMP    — a listing that has never been bumped is eligible.
 *   2. COOLDOWN      — a free bump once every 7 days (`BUMP_COOLDOWN_DAYS`).
 *   3. PRICE DROP    — within the 7-day cooldown, a ≥10% cut BELOW the price at the
 *                      last bump earns an early bump. This is self-limiting: each
 *                      bump resets the reference to the new (lower) price, so a
 *                      second early bump needs another 10% off the *reduced* price —
 *                      a genuine, compounding markdown, not a gameable nudge.
 *
 * SINCE MIGRATION 0042 (creation anchor, 2026-08-25): a BEFORE INSERT trigger sets
 * bumped_at = now() and bumped_price_cents = list price at creation (plus a backfill for
 * older rows), so creation itself counts as the first bump. In practice a new listing
 * starts "fresh" in the browse ordering, its first FREE bump unlocks 7 days after
 * listing, and the price-drop reference starts at the original list price. Rule 1 and
 * the null-tolerant inputs remain for robustness (and for any row predating the
 * backfill), not as an expected path.
 *
 * NOTE on the roadmap's "≥10% price drop to re-bump after 30 days": the compounding
 * reference above makes the price-drop path self-limiting without a separate 30-day
 * timer or extra column. If instead you want the price-drop path to open only for
 * *older* listings, gate the caller on listing age before offering it — say the word
 * and it becomes a one-line constant here.
 *
 * Money is integer cents; the percentage is a float used only for the threshold
 * test and display, never to compute an amount.
 */

export const BUMP_COOLDOWN_DAYS = 7
export const PRICE_DROP_BUMP_MIN_PCT = 10

const DAY_MS = 24 * 60 * 60 * 1000
export const BUMP_COOLDOWN_MS = BUMP_COOLDOWN_DAYS * DAY_MS

/**
 * Percentage drop from `fromCents` to `toCents` (positive when price decreased),
 * 0 when there was no decrease or the inputs are unusable. Fail-safe: never returns
 * a negative or non-finite number, so a bad input can't accidentally qualify a bump.
 */
export function priceDropPct(fromCents: number, toCents: number): number {
  if (!Number.isFinite(fromCents) || fromCents <= 0) return 0
  if (!Number.isFinite(toCents) || toCents < 0) return 0
  if (toCents >= fromCents) return 0
  return ((fromCents - toCents) / fromCents) * 100
}

export type BumpInput = {
  /** Current time in epoch ms (caller supplies — keeps this pure). */
  nowMs: number
  /** Epoch ms of the last bump, or null if the listing has never been bumped. */
  bumpedAtMs: number | null
  /** Current listing price, integer cents. */
  currentPriceCents: number
  /** Price (integer cents) at the last bump, or null if never bumped. */
  priceAtLastBumpCents: number | null
}

export type BumpEligibility =
  | { ok: true; reason: 'first_bump' | 'cooldown_elapsed' | 'price_drop' }
  | {
      ok: false
      reason: 'cooldown_active'
      /** When the free (time-based) bump next becomes available, epoch ms. */
      nextEligibleAtMs: number
      /** The price cut (percent, below last-bump price) that would unlock an early bump now. */
      qualifyingPriceDropPct: number
    }

/**
 * Decide whether a listing may be bumped right now. The caller is responsible for
 * confirming the listing is the seller's own and currently `active` before offering
 * this; this function owns only the cadence / price-drop policy.
 */
export function bumpEligibility(input: BumpInput): BumpEligibility {
  const { nowMs, bumpedAtMs, currentPriceCents, priceAtLastBumpCents } = input

  if (bumpedAtMs === null) return { ok: true, reason: 'first_bump' }

  const elapsed = nowMs - bumpedAtMs
  if (elapsed >= BUMP_COOLDOWN_MS) return { ok: true, reason: 'cooldown_elapsed' }

  // Still within the cooldown: a real ≥10% markdown from the last-bump price unlocks
  // an early bump.
  if (
    priceAtLastBumpCents !== null &&
    priceDropPct(priceAtLastBumpCents, currentPriceCents) >= PRICE_DROP_BUMP_MIN_PCT
  ) {
    return { ok: true, reason: 'price_drop' }
  }

  return {
    ok: false,
    reason: 'cooldown_active',
    nextEligibleAtMs: bumpedAtMs + BUMP_COOLDOWN_MS,
    qualifyingPriceDropPct: PRICE_DROP_BUMP_MIN_PCT,
  }
}

/** Convenience boolean for the endpoint gate. */
export function canBump(input: BumpInput): boolean {
  return bumpEligibility(input).ok
}
