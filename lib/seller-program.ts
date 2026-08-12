/**
 * Elite Seller Program (Fee Model v3) — SERVER ONLY.
 * When a seller's trailing-365-day GROSS sales cross $25k, flag them for founder
 * outreach (boosted listings, lower fees, etc.) exactly once and notify them.
 * Fail-soft: never blocks order settlement.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { trailingVolumeCents } from '@/lib/fee-tier'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

/** $25,000 trailing gross sales unlocks the program. */
export const ELITE_PROGRAM_THRESHOLD_CENTS = 2_500_000

export async function checkEliteEligibility(service: ServiceClient, sellerId: string): Promise<void> {
  try {
    // Skip if already flagged (idempotent, one-time).
    const { data: profile } = await service
      .from('profiles')
      .select('elite_program_eligible')
      .eq('id', sellerId)
      .single()
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((profile as any)?.elite_program_eligible) return

    const volumeCents = await trailingVolumeCents(service, sellerId, 'seller')
    if (volumeCents < ELITE_PROGRAM_THRESHOLD_CENTS) return

    const { data: flagged } = await service
      .from('profiles')
      .update({ elite_program_eligible: true, elite_program_notified_at: new Date().toISOString() })
      .eq('id', sellerId)
      .eq('elite_program_eligible', false) // atomic: only the first crossing notifies
      .select('id')
      .single()
    if (flagged && NOTIFICATIONS_ENABLED) {
      // Seller: congratulate + set expectations.
      await notify(service, sellerId, 'elite_program', {})
      // Admins: surface the lead for founder outreach.
      const { data: sp } = await service.from('profiles').select('username').eq('id', sellerId).single()
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const username = (sp as any)?.username as string | undefined
      const { data: admins } = await service.from('profiles').select('id').eq('role', 'admin')
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      for (const a of (((admins as any[]) ?? []))) {
        await notify(service, a.id as string, 'admin_elite_lead', { actorName: username, amountCents: volumeCents })
      }
    }
  } catch { /* fail-soft */ }
}
