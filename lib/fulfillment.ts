/**
 * Order fulfillment — G12 prepaid-label orchestration. SERVER ONLY.
 *
 * Bridges the EasyPost label adapter (lib/shipping-labels) to the order lifecycle: on
 * seller-confirm, buy a prepaid label from the buyer's collected shipping and store it on the
 * order; on a pre-ship refund/cancel, reclaim an unused label. All fail-soft and gated behind
 * SHIPPING_LABELS_ENABLED — a failure NEVER blocks the sale (the manual ship path is the fallback).
 */
import type { createServiceClientRaw } from '@/lib/supabase/service'
import { SHIPPING_LABELS_ENABLED } from '@/lib/flags'
import { presetFor } from '@/lib/shipping'
import {
  buyShippingLabel,
  refundShippingLabel,
  isCompleteAddress,
  labelMarginCents,
  type LabelAddress,
} from '@/lib/shipping-labels'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

/**
 * Buy a prepaid label for a confirmed order and store it. Idempotent (skips if a shipment
 * already exists), fail-soft (returns a reason instead of throwing). Requires complete ship-to
 * (buyer) and ship-from (seller) addresses; without them, falls through to manual shipping.
 */
export async function buyLabelForOrder(
  service: ServiceClient,
  orderId: string,
): Promise<{ bought: boolean; reason?: string }> {
  if (!SHIPPING_LABELS_ENABLED) return { bought: false, reason: 'disabled' }
  try {
    const { data: order } = await service
      .from('orders')
      .select('id, seller_id, listing_id, shipping_cents, ship_to_address, easypost_shipment_id, state')
      .eq('id', orderId)
      .single()
    if (!order) return { bought: false, reason: 'order_not_found' }
    if (order.easypost_shipment_id) return { bought: false, reason: 'already_bought' }

    const [{ data: listing }, { data: seller }] = await Promise.all([
      service.from('listings').select('category').eq('id', order.listing_id).single(),
      service.from('profiles').select('ship_from_address').eq('id', order.seller_id).single(),
    ])

    const to = (order.ship_to_address ?? null) as Partial<LabelAddress> | null
    const from = ((seller?.ship_from_address ?? null) as Partial<LabelAddress> | null)
    if (!isCompleteAddress(to)) return { bought: false, reason: 'incomplete_to_address' }
    if (!isCompleteAddress(from)) return { bought: false, reason: 'incomplete_from_address' }

    const preset = presetFor((listing?.category as string) ?? 'Other')
    const label = await buyShippingLabel({ from, to, preset })
    if (!label) return { bought: false, reason: 'buy_failed' }

    const collected = order.shipping_cents ?? 0
    const margin = labelMarginCents(collected, label.rateCents)
    if (margin < 0) {
      console.warn(`[g12] label cost ${label.rateCents} > collected ${collected} on order ${orderId} (platform eats ${-margin}c)`)
    }

    await service
      .from('orders')
      .update({
        shipping_label_url:        label.labelUrl,
        shipping_label_cost_cents: label.rateCents,
        easypost_shipment_id:      label.shipmentId,
        easypost_tracker_id:       label.trackerId,
        carrier:                   label.carrier,
        tracking_number:           label.trackingCode,
        label_purchased_at:        new Date().toISOString(),
      })
      .eq('id', orderId)
      .is('easypost_shipment_id', null) // race guard: only the first buy wins
    return { bought: true }
  } catch (e) {
    console.warn('[g12] buyLabelForOrder failed (fail-soft):', e)
    return { bought: false, reason: 'exception' }
  }
}

/**
 * Reclaim an UNUSED label when an order is refunded/cancelled before shipping. No-op if the
 * label was already used (shipped/delivered/released) or already refunded.
 */
export async function refundLabelForOrder(service: ServiceClient, orderId: string): Promise<boolean> {
  if (!SHIPPING_LABELS_ENABLED) return false
  try {
    const { data: order } = await service
      .from('orders')
      .select('easypost_shipment_id, label_refunded_at, shipped_at, delivered_at, released_at')
      .eq('id', orderId)
      .single()
    if (!order?.easypost_shipment_id || order.label_refunded_at) return false
    // A label is USED once the order was ever shipped — never refund it then (timestamps
    // persist even after the order transitions to refunded/cancelled).
    if (order.shipped_at || order.delivered_at || order.released_at) return false
    const ok = await refundShippingLabel(order.easypost_shipment_id as string)
    if (ok) {
      await service.from('orders').update({ label_refunded_at: new Date().toISOString() }).eq('id', orderId)
    }
    return ok
  } catch (e) {
    console.warn('[g12] refundLabelForOrder failed:', e)
    return false
  }
}
