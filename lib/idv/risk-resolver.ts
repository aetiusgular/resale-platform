/**
 * Seller verification resolver — SERVER ONLY. Assembles the two RISK signals now that
 * their sources exist (G9 reviews + G6 upheld_complaints) and asks the G4 policy whether
 * the seller must complete ID verification. This is the convergence point:
 *
 *   ratings (G9)  ─┐
 *   complaints(G6)─┤→ sellerRiskFlagged ─┐
 *                  │                      ├→ sellerRequiresIdVerification (risk OR $5k volume)
 *   trailing sales ─────────────────────┘   (volume resolved inside the policy)
 *
 * Call this at the sell / payout gate (behind VERIFICATION_ENABLED); on true, hold
 * selling/payout pending Persona. Uses the service client (reads across a seller's
 * reviews + profile) — never import into a client component.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { sellerRiskFlagged } from '@/lib/trust/risk-signal'
import { sellerRequiresIdVerification } from '@/lib/idv/verification-policy'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

/**
 * Resolve whether a seller currently must complete ID verification. Fail-OPEN to `false`
 * (don't block a seller) only on the read layer — the policy's own volume path is
 * fail-safe. Any thrown error from the policy propagates to the caller to handle.
 */
export async function sellerMustVerify(service: ServiceClient, sellerId: string): Promise<boolean> {
  // RATINGS signal — the seller's received buyer→seller stars.
  let ratings: number[] = []
  try {
    const { data } = await service
      .from('reviews')
      .select('stars')
      .eq('subject_id', sellerId)
      .eq('direction', 'buyer_to_seller')
    ratings = (data ?? []).map((r: { stars: number }) => r.stars)
  } catch {
    ratings = [] // missing ratings must never, by itself, force verification
  }

  // COMPLAINTS signal — upheld T&S complaints (G6 record_moderation_action increments this).
  let upheldComplaints = 0
  try {
    const { data } = await service
      .from('profiles')
      .select('upheld_complaints')
      .eq('id', sellerId)
      .single()
    upheldComplaints = (data as { upheld_complaints?: number } | null)?.upheld_complaints ?? 0
  } catch {
    upheldComplaints = 0
  }

  const riskFlagged = sellerRiskFlagged({ ratings, upheldComplaints })

  // The policy OR's this risk flag with the $5k trailing-sales volume path.
  return sellerRequiresIdVerification(service, sellerId, { riskFlagged })
}
