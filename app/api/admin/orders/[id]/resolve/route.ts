/**
 * POST /api/admin/orders/[id]/resolve
 * Admin resolves a dispute: 'release' (seller wins) or 'refund' (buyer wins).
 *
 * On 'refund': issues Stripe refund, order → refunded, listing → removed.
 * On 'release': creates Stripe transfer, order → released, listing stays sold.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'

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
    // Issue Stripe refund on the payment intent
    try {
      await stripe.refunds.create({
        payment_intent: order.stripe_payment_intent_id,
        metadata: { order_id: orderId, resolved_by: user.id },
      })
    } catch (stripeError) {
      console.error('[resolve] Stripe refund error:', stripeError)
      return NextResponse.json({ error: 'Stripe refund failed' }, { status: 502 })
    }

    // Transition order to refunded
    await service.rpc('transition_order', {
      p_order_id:     orderId,
      p_to_state:     'refunded',
      p_source:       'admin',
      p_stripe_event: null,
      p_payload:      { resolved_by: user.id, resolution: 'refund' },
    })

    // Mark listing removed
    await service.from('listings').update({ status: 'removed' }).eq('id', order.listing_id)
  } else {
    // Release: transfer to seller if not already done
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
          console.error('[resolve] Stripe transfer error:', stripeError)
          return NextResponse.json({ error: 'Stripe transfer failed' }, { status: 502 })
        }
      }
    }

    await service.rpc('transition_order', {
      p_order_id:     orderId,
      p_to_state:     'released',
      p_source:       'admin',
      p_stripe_event: null,
      p_payload:      { resolved_by: user.id, resolution: 'release' },
    })
  }

  // Mark dispute as resolved
  await service
    .from('disputes')
    .update({ resolution, resolved_by: user.id, resolved_at: new Date().toISOString() })
    .eq('id', dispute.id)

  return NextResponse.json({ ok: true })
}
