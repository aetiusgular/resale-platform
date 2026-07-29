/**
 * Seller ID-verification policy (decided 2026-07-26). SERVER ONLY.
 *
 * Model: NO user is ID-gated by default (buyers never; general commenting never).
 * A SELLER must complete Persona ID verification only when triggered by either:
 *   1. RISK  — a trust & safety flag (repeated bad ratings / scam / shipping-fraud /
 *      refund-abuse complaints). Depends on ratings [G9] + T&S signals [G6]; until
 *      those exist, an admin/manual flag drives it (passed in as `riskFlagged`).
 *   2. VOLUME — trailing-12-month sales ≥ $5,000, reusing the fee trailing-volume
 *      resolver (seller side).
 *
 * NOTE (compliance): the US INFORM Consumers Act obliges the MARKETPLACE to verify a
 * "high-volume seller" — $5,000 gross revenue AND 200+ transactions in a 12-month
 * window. We trigger on the $5,000 half alone (ignoring the 200-tx condition), which
 * verifies MORE sellers than the statute strictly requires — the conservative,
 * never-under-verify direction. Confirm the final threshold with a lawyer for US sales.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { trailingVolumeCents } from '@/lib/fee-tier'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

/** Trailing-12mo sales (integer cents) at/above which a seller must verify ID. */
export const SELLER_VERIFICATION_SALES_CENTS = 500_000 // $5,000 (INFORM Act, conservative)

/** Pure: does trailing sales volume trigger mandatory seller ID verification? */
export function salesTriggersVerification(trailingSalesCents: number): boolean {
  return trailingSalesCents >= SELLER_VERIFICATION_SALES_CENTS
}

/**
 * Whether a seller must complete ID verification before continuing to sell /
 * receive payouts. Risk flag OR high sales volume. Buyers are never gated.
 */
export async function sellerRequiresIdVerification(
  service: ServiceClient,
  sellerId: string,
  opts: { riskFlagged?: boolean } = {},
): Promise<boolean> {
  if (opts.riskFlagged) return true
  const trailingSales = await trailingVolumeCents(service, sellerId, 'seller')
  return salesTriggersVerification(trailingSales)
}
