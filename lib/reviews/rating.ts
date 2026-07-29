/**
 * Seller review / rating aggregation — PURE. No DB, no I/O, no side effects.
 *
 * Star ratings are integers 1..5. This module turns a set of stars into (a) a
 * display summary (count + mean + distribution) and (b) a trust signal that feeds
 * the seller ID-verification RISK trigger in `lib/idv/verification-policy.ts`.
 * "Repeated bad ratings" is one half of that risk trigger; the other half —
 * scam / shipping / refund complaints — comes from Trust & Safety signals [G6].
 * An orchestrator OR's the two; this file owns only the ratings half.
 *
 * Because it is pure, the same function backs both the profile rating shown to
 * buyers and the server-side risk evaluation — one source of truth, no drift.
 */

export const MIN_STAR = 1
export const MAX_STAR = 5

/** A valid star is an integer in [1, 5]. Anything else is ignored on aggregation. */
export function isValidStar(n: number): boolean {
  return Number.isInteger(n) && n >= MIN_STAR && n <= MAX_STAR
}

export type StarDistribution = { 1: number; 2: number; 3: number; 4: number; 5: number }

export type RatingSummary = {
  /** Number of valid reviews counted. */
  count: number
  /** Mean rounded to 1 decimal; null when there are no valid reviews. */
  average: number | null
  /** Count of reviews at each star value. */
  distribution: StarDistribution
  /** Share of 1–2★ reviews in [0, 1]; 0 when count === 0. */
  lowStarShare: number
}

/**
 * Aggregate raw stars into a display + risk summary. Invalid entries (non-integer,
 * out of range) are dropped so a malformed value can never skew the mean or count.
 */
export function aggregateRating(stars: number[]): RatingSummary {
  const distribution: StarDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  let count = 0
  let sum = 0
  for (const s of stars) {
    if (!isValidStar(s)) continue
    distribution[s as 1 | 2 | 3 | 4 | 5] += 1
    count += 1
    sum += s
  }
  if (count === 0) {
    return { count: 0, average: null, distribution, lowStarShare: 0 }
  }
  const average = Math.round((sum / count) * 10) / 10
  const lowStarShare = (distribution[1] + distribution[2]) / count
  return { count, average, distribution, lowStarShare }
}

// ── Ratings → RISK signal (feeds G4 seller verification) ─────────────────────

/** Minimum reviews before ratings can trigger risk — avoids tiny-sample noise. */
export const RATING_RISK_MIN_SAMPLE = 5
/** Mean at/below this (with enough sample) is a risk signal. */
export const RATING_RISK_AVG_CEILING = 2.5
/** 1–2★ share at/above this (with enough sample) is a risk signal. */
export const RATING_RISK_LOW_SHARE_FLOOR = 0.4

/**
 * Whether a seller's ratings alone are bad enough to raise the ID-verification
 * RISK flag. Requires a minimum sample; then true if the mean is at/below the
 * ceiling OR the low-star share is at/above the floor. Thresholds are tunable —
 * a product/T&S decision, not a legal one. This is the ratings half only; final
 * auto-flagging OR's this with T&S complaint signals [G6].
 */
export function ratingsTriggerRisk(stars: number[]): boolean {
  const s = aggregateRating(stars)
  if (s.count < RATING_RISK_MIN_SAMPLE) return false
  const lowAverage = s.average !== null && s.average <= RATING_RISK_AVG_CEILING
  return lowAverage || s.lowStarShare >= RATING_RISK_LOW_SHARE_FLOOR
}
