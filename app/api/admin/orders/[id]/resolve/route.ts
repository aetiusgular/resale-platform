/**
 * POST /api/admin/orders/[id]/resolve
 * Admin resolves a dispute: 'release' (seller wins) or 'refund' (buyer wins).
 *
 * Atomicity strategy (fail-safe direction):
 *   release: transition DB → released FIRST, then create Stripe transfer.
 *            If transfer fails, /api/cron/process-transfers will retry.
 *   refund:  check Stripe for existing refund first (prevent double-refund),
 *            then transition DB → refunded, then issue Stripe refund.
 *            The charge.refunded webhook also calls transition_order (idempotent).
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { isUuid } from '@/lib/security/uuid'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'
import { recsMarkRemoved } from '@/lib/recs/sync'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  // Auth + admin check
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  let body: { resolution?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { resolution } = body
  if (resolution !== 'release' && resolution !== 'refund') {
    return NextResponse.json({ error: "resolution must be 'release' or 'refund'" }, { status: 400 })
  }

  const { id: orderId } = await params
  if (!isUuid(orderId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const service = createServiceClientRaw()

  // Fetch order + dispute
  const { data: order } = await service
    .from('orders')
    .select('id, state, listing_id, seller_id, transfer_cents, stripe_payment_intent_id, stripe_transfer_id')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Order not found' }, { status: 404 })
  if (order.state !== 'disputed') {
    return NextResponse.json({ error: 'Order is not in disputed state' }, { status: 422 })
  }

  const { data: dispute } = await service
    .from('disputes')
    .select('id')
    .eq('order_id', orderId)
    .is('resolved_at', null)
    .single()

  if (!dispute) return NextResponse.json({ error: 'No active dispute found' }, { status: 404 })

  if (resolution === 'refund') {
    // Check if Stripe already has a refund for this payment_intent (prevent double-refund on retry)
    const existingRefunds = await stripe.refunds.list({
      payment_intent: order.stripe_payment_intent_id,
      limit: 1,
    })

    // Transition DB state to refunded FIRST (charge.refunded webhook is also idempotent)
    const { error: transitionError } = await service.rpc('transition_order', {
      p_order_id:     orderId,
      p_to_state:     'refunded',
      p_source:       'admin',
      p_stripe_event: null,
      p_payload:      { resolved_by: user.id, resolution: 'refund' },
    })
    if (transitionError) {
      return NextResponse.json({ error: transitionError.message }, { status: 422 })
    }

    // Mark listing removed
    await service.from('listings').update({ status: 'removed' }).eq('id', order.listing_id)

    // Recs G1: drop the refunded listing from the index (non-blocking, fail-soft).
    after(() => recsMarkRemoved(order.listing_id))

    // Issue Stripe refund only if none exists yet
    if (existingRefunds.data.length === 0) {
      try {
        await stripe.refunds.create({
          payment_intent: order.stripe_payment_intent_id,
          metadata: { order_id: orderId, resolved_by: user.id },
        })
      } catch (stripeError) {
        // DB already transitioned — log and return success; manual Stripe refund needed
        console.error('[resolve] Stripe refund error after DB transition:', stripeError)
        return NextResponse.json({ ok: true, refundPending: true })
      }
    }
  } else {
    // Release: transition DB state FIRST, then create transfer
    // If transfer fails, /api/cron/process-transfers will retry
    const { error: transitionError } = await service.rpc('transition_order', {
      p_order_id:     orderId,
      p_to_state:     'released',
      p_source:       'admin',
      p_stripe_event: null,
      p_payload:      { resolved_by: user.id, resolution: 'release' },
    })
    if (transitionError) {
      return NextResponse.json({ error: transitionError.message }, { status: 422 })
    }

    if (!order.stripe_transfer_id) {
      const { data: seller } = await service
        .from('profiles')
        .select('stripe_connect_account_id')
        .eq('id', order.seller_id)
        .single()

      if (seller?.stripe_connect_account_id) {
        try {
          const transfer = await stripe.transfers.create({
            amount:      order.transfer_cents,
            currency:    'usd',
            destination: seller.stripe_connect_account_id,
            metadata:    { order_id: orderId, resolved_by: user.id },
          })
          await service
            .from('orders')
            .update({ stripe_transfer_id: transfer.id })
            .eq('id', orderId)
        } catch (stripeError) {
          // DB transitioned — cron will retry the transfer
          console.error('[resolve] Stripe transfer error after DB transition:', stripeError)
          return NextResponse.json({ ok: true, transferPending: true })
        }
      }
    }
  }

  // Mark dispute as resolved
  await service
    .from('disputes')
    .update({ resolution, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', dispute.id)

  return NextResponse.json({ ok: true })
}
