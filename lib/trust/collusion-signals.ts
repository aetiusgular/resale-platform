/**
 * Collusion signal gathering + pre-payout hold — SERVER ONLY. Bridges the pure engine
 * (lib/trust/collusion) to the DB: reads a user's accumulated payment fingerprints/billing
 * from payment_identities and the two order addresses, evaluates, and (when flagged) marks
 * the order held + logs a collusion_flags row so the transfer is NOT created. Callers gate
 * on COLLUSION_HOLD_ENABLED. Fail-OPEN on read error (never block a legitimate payout on a
 * flaky query) — the check is defense-in-depth, not the only control.
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { evaluateCollusion, type PartySignals } from './collusion'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

type IdRow = { kind: string; fingerprint: string; billing_name: string | null; billing_zip: string | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalizeAddress(a: any): string {
  if (!a || typeof a !== 'object') return ''
  const parts = [a.line1, a.line2, a.city, a.state, a.postal_code ?? a.postal ?? a.zip, a.country]
  return parts.filter(Boolean).join(' ').trim().toLowerCase().replace(/\s+/g, ' ')
}

async function gatherPaymentSignals(service: ServiceClient, userId: string): Promise<PartySignals> {
  const { data } = await service
    .from('payment_identities')
    .select('kind, fingerprint, billing_name, billing_zip')
    .eq('user_id', userId)
  const rows = (data ?? []) as IdRow[]
  return {
    cardFingerprints: rows.filter((r) => r.kind === 'card').map((r) => r.fingerprint),
    bankFingerprints: rows.filter((r) => r.kind === 'bank').map((r) => r.fingerprint),
    billingName: rows.find((r) => r.billing_name)?.billing_name ?? null,
    billingZip: rows.find((r) => r.billing_zip)?.billing_zip ?? null,
  }
}

type OrderLike = { id: string; buyer_id: string; seller_id: string; shipping_address?: unknown }

/**
 * Returns { held, reasons }. When held, the order is marked (transfer_hold_reason) and a
 * collusion_flags row is written; the caller must NOT create the Stripe transfer.
 */
export async function collusionHold(service: ServiceClient, order: OrderLike): Promise<{ held: boolean; reasons: string[] }> {
  try {
    const [buyer, seller] = await Promise.all([
      gatherPaymentSignals(service, order.buyer_id),
      gatherPaymentSignals(service, order.seller_id),
    ])
    // ship-to-self: buyer's ship-to (order) vs seller's origin (their profile address)
    const { data: sellerProfile } = await service.from('profiles').select('shipping_address').eq('id', order.seller_id).single()
    buyer.addresses = [normalizeAddress(order.shipping_address)].filter(Boolean)
    seller.addresses = [normalizeAddress((sellerProfile as { shipping_address?: unknown } | null)?.shipping_address)].filter(Boolean)

    const result = evaluateCollusion(buyer, seller)
    if (!result.flagged) return { held: false, reasons: [] }

    await service.from('orders').update({ transfer_hold_reason: result.reasons.join(',') }).eq('id', order.id)
    await service.from('collusion_flags').upsert(
      { order_id: order.id, buyer_id: order.buyer_id, seller_id: order.seller_id, reasons: result.reasons },
      { onConflict: 'order_id' },
    )
    console.warn(`[collusion] payout held for order ${order.id}:`, result.reasons.join(','))
    return { held: true, reasons: result.reasons }
  } catch (e) {
    console.warn('[collusion] check failed (fail-open, allowing payout):', e)
    return { held: false, reasons: [] }
  }
}
