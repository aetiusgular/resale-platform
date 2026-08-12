/**
 * Buyer-reward pure cores (no I/O, no server imports) — safe to unit-test and
 * import anywhere. The DB-backed helpers live in lib/rewards.ts.
 */
import { feeAt } from '@/lib/fees'

export interface RewardTier {
  milestoneCents: number
  bps: number
  capCents: number
}

/** Richest milestone first. $10k → 15% (cap $300) · $5k → 10% ($150) · $1k → 5% ($50). */
export const REWARD_TIERS: readonly RewardTier[] = [
  { milestoneCents: 1_000_000, bps: 1500, capCents: 30_000 },
  { milestoneCents:   500_000, bps: 1000, capCents: 15_000 },
  { milestoneCents:   100_000, bps:  500, capCents:  5_000 },
]

/** Discount (cents) a reward grants on an item: min(cap, price·bps), never negative. */
export function rewardDiscountCents(priceCents: number, bps: number, capCents: number): number {
  return Math.max(0, Math.min(capCents, feeAt(priceCents, bps)))
}

/**
 * Which milestones to grant now: every tier whose milestone the buyer's trailing
 * volume meets AND that hasn't been granted within the rolling window (caller passes
 * the milestones already granted in the last 365 days).
 */
export function milestonesToGrant(volumeCents: number, grantedMilestones: readonly number[]): RewardTier[] {
  if (!Number.isFinite(volumeCents) || volumeCents <= 0) return []
  const granted = new Set(grantedMilestones)
  return REWARD_TIERS.filter((t) => volumeCents >= t.milestoneCents && !granted.has(t.milestoneCents))
}

/** Human label for a milestone amount, e.g. "$1,000". */
export function milestoneLabel(cents: number): string {
  return '$' + Math.round(cents / 100).toLocaleString('en-US')
}
