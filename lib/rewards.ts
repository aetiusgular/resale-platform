/**
 * Buyer milestone rewards (Fee Model v3) — SERVER ONLY.
 *
 * A buyer earns a ONE-TIME percentage discount each time their trailing-365-day
 * PURCHASE volume crosses a milestone: $1k → 5%, $5k → 10%, $10k → 15%, each capped
 * ($50 / $150 / $300). Milestones re-arm on a rolling-year basis (a reward can be
 * re-earned once its prior grant is >365 days old). The discount is PLATFORM-FUNDED:
 * it reduces what the buyer pays; the seller's payout is never touched.
 *
 * Pure cores (REWARD_TIERS, milestonesToGrant, rewardDiscountCents) are unit-tested;
 * the DB helpers wrap them. Everything is fail-soft — a reward miss never blocks a sale.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { trailingVolumeCents } from '@/lib/fee-tier'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

import type { RewardTier } from '@/lib/rewards-core'
import { REWARD_TIERS, rewardDiscountCents, milestonesToGrant, milestoneLabel } from '@/lib/rewards-core'
export type { RewardTier }
export { REWARD_TIERS, rewardDiscountCents, milestonesToGrant, milestoneLabel }

/**
 * Grant any newly-earned milestone rewards for a buyer (call after an order settles).
 * Reads trailing gross purchase volume + milestones granted in the last 365 days,
 * inserts the fresh rewards. Returns the tiers granted (for notification). Fail-soft.
 */
export async function issueBuyerRewards(service: ServiceClient, buyerId: string): Promise<RewardTier[]> {
  try {
    const volumeCents = await trailingVolumeCents(service, buyerId, 'buyer')
    const cutoff = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000).toISOString()
    const { data } = await service
      .from('buyer_rewards')
      .select('milestone_cents')
      .eq('buyer_id', buyerId)
      .gte('granted_at', cutoff)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const granted = ((data as any[]) ?? []).map((r) => r.milestone_cents as number)
    const toGrant = milestonesToGrant(volumeCents, granted)
    if (toGrant.length === 0) return []
    await service.from('buyer_rewards').insert(
      toGrant.map((t) => ({
        buyer_id: buyerId,
        milestone_cents: t.milestoneCents,
        discount_bps: t.bps,
        cap_cents: t.capCents,
        status: 'active',
      })),
    )
    if (NOTIFICATIONS_ENABLED) {
      for (const t of toGrant) {
        await notify(service, buyerId, 'buyer_reward', {
          rewardPct: t.bps / 100,
          milestoneLabel: milestoneLabel(t.milestoneCents),
        })
      }
    }
    return toGrant
  } catch {
    return [] // fail-soft: a reward miss must never break order settlement
  }
}


export interface ReservedReward {
  rewardId: string
  discountCents: number
}

/**
 * Reserve the buyer's best available reward for a checkout and return the discount.
 * Atomic: flips status active→reserved so a reward can't be double-spent across two
 * concurrent checkouts. Returns null when the buyer has none (→ no discount applied).
 */
export async function reserveBestReward(
  service: ServiceClient,
  buyerId: string,
  priceCents: number,
): Promise<ReservedReward | null> {
  try {
    const nowIso = new Date().toISOString()
    const { data } = await service
      .from('buyer_rewards')
      .select('id, discount_bps, cap_cents')
      .eq('buyer_id', buyerId)
      .eq('status', 'active')
      .gt('expires_at', nowIso)
      .order('cap_cents', { ascending: false })
      .limit(1)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const reward = ((data as any[]) ?? [])[0]
    if (!reward) return null
    const discountCents = rewardDiscountCents(priceCents, reward.discount_bps, reward.cap_cents)
    if (discountCents <= 0) return null
    const { data: locked } = await service
      .from('buyer_rewards')
      .update({ status: 'reserved' })
      .eq('id', reward.id)
      .eq('status', 'active')
      .select('id')
      .single()
    if (!locked) return null // lost a race → no discount this checkout
    return { rewardId: reward.id, discountCents }
  } catch {
    return null
  }
}

/** Restore a reserved reward to active (checkout failed / payment failed). Fail-soft. */
export async function restoreReward(service: ServiceClient, rewardId: string): Promise<void> {
  try {
    await service.from('buyer_rewards').update({ status: 'active' }).eq('id', rewardId).eq('status', 'reserved')
  } catch { /* fail-soft */ }
}

/** Mark a reserved reward redeemed against an order (payment succeeded). Fail-soft. */
export async function redeemReservedReward(service: ServiceClient, rewardId: string, orderId: string): Promise<void> {
  try {
    await service
      .from('buyer_rewards')
      .update({ status: 'redeemed', redeemed_at: new Date().toISOString(), order_id: orderId })
      .eq('id', rewardId)
      .eq('status', 'reserved')
  } catch { /* fail-soft */ }
}
