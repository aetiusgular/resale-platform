/**
 * Seller RISK evaluation — PURE. No DB, no I/O.
 *
 * This is the orchestrator that produces the `riskFlagged` input consumed by
 * `sellerRequiresIdVerification` in `lib/idv/verification-policy.ts`. The G4 policy
 * says a seller must verify ID on RISK **or** on ≥$5k volume; this file owns the
 * RISK half by OR-ing two independent signals:
 *
 *   1. RATINGS  — "repeated bad ratings" via `ratingsTriggerRisk` (G9 reviews).
 *   2. COMPLAINTS — substantiated Trust & Safety complaints (scam / shipping fraud /
 *      refund abuse) upheld against the seller, i.e. disputes/strikes a human
 *      moderator resolved against them. A raw/open complaint is NOT a signal — only
 *      an upheld one — so a malicious buyer can't force a seller into verification.
 *   3. MANUAL — an admin hard override (always wins).
 *
 * The caller supplies the counts/ratings it has already read from the DB; keeping
 * this pure means the same rule backs the verification gate, the admin console, and
 * any test, with no drift. Thresholds are a product/T&S decision, not legal.
 */
import { ratingsTriggerRisk } from '@/lib/reviews/rating'

/** Upheld T&S complaints at/above this count raise the risk flag. */
export const COMPLAINT_RISK_THRESHOLD = 2

export type SellerRiskSignals = {
  /** Trailing seller ratings (stars 1..5). Optional — absent means "no ratings yet". */
  ratings?: number[]
  /** Count of T&S-substantiated (upheld) complaints against the seller. */
  upheldComplaints?: number
  /** Admin hard override — forces the flag regardless of the other signals. */
  manualFlag?: boolean
}

export type RiskReason = 'ratings' | 'complaints' | 'manual'

export type RiskEvaluation = {
  flagged: boolean
  /** Every signal that fired, for the audit log / admin display. */
  reasons: RiskReason[]
}

/**
 * Evaluate all risk signals and report which fired. `flagged` is true iff at least
 * one reason is present. Designed so its output can be written verbatim into a
 * moderation audit record (the `reasons` array explains the decision).
 */
export function evaluateSellerRisk(signals: SellerRiskSignals): RiskEvaluation {
  const reasons: RiskReason[] = []

  if (signals.manualFlag) reasons.push('manual')
  if (signals.ratings && signals.ratings.length > 0 && ratingsTriggerRisk(signals.ratings)) {
    reasons.push('ratings')
  }
  if ((signals.upheldComplaints ?? 0) >= COMPLAINT_RISK_THRESHOLD) {
    reasons.push('complaints')
  }

  return { flagged: reasons.length > 0, reasons }
}

/**
 * Convenience boolean for the verification gate:
 *   sellerRequiresIdVerification(service, id, { riskFlagged: sellerRiskFlagged(signals) })
 */
export function sellerRiskFlagged(signals: SellerRiskSignals): boolean {
  return evaluateSellerRisk(signals).flagged
}
