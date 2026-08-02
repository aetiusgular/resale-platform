/**
 * POST /api/orders/[id]/deliver
 * Buyer confirms receipt → delivered → released.
 * On release, creates the Stripe transfer to the seller's Connect account.
 *
 * Flow: buyer confirm → delivered → released (immediately, since buyer is confirming)
 * The 3-day auto-release window is only for when the buyer does NOT confirm manually.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify'
import stripe from '@/lib/stripe'
import { applyTierProgress } from '@/lib/tier-progress'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: orderId } = await params
  const service = createServiceClientRaw()

  const { data: order } = await service
    .from('orders')
    .select('id, buyer_id, seller_id, listing_id, state, transfer_cents, stripe_payment_intent_id, stripe_transfer_id')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Fetch seller's connect account
  const { data: seller } = await service
    .from('profiles')
    .select('stripe_connect_account_id')
    .eq('id', order.seller_id)
    .single()

  if (!seller?.stripe_connect_account_id) {
    return NextResponse.json({ error: 'Seller payout account not found' }, { status: 422 })
  }

  // If order is shipped, first transition to delivered, then to released
  if (order.state === 'shipped') {
    const { error: deliverError } = await service.rpc('transition_order', {
      p_order_id:     orderId,
      p_to_state:     'delivered',
      p_source:       'user',
      p_stripe_event: null,
      p_payload:      { confirmed_by: user.id },
    })
    if (deliverError) {
      return NextResponse.json({ error: deliverError.message }, { status: 422 })
    }
  } else if (order.state !== 'delivered') {
    return NextResponse.json({ error: `Cannot confirm from state: ${order.state}` }, { status: 422 })
  }

  // Transition to released
  const { error: releaseError } = await service.rpc('transition_order', {
    p_order_id:     orderId,
    p_to_state:     'released',
    p_source:       'user',
    p_stripe_event: null,
    p_payload:      { confirmed_by: user.id },
  })

  if (releaseError) {
    console.error('[deliver] release error:', releaseError)
    return NextResponse.json({ error: releaseError.message }, { status: 422 })
  }

  // v2 stateful tiers: a completed sale can upgrade both parties' tier + relock
  // 30 days. Idempotent (upgrades only on strict improvement) and non-fatal.
  await Promise.all([
    applyTierProgress(service, order.buyer_id, 'buyer'),
    applyTierProgress(service, order.seller_id, 'seller'),
  ])

  if (NOTIFICATIONS_ENABLED) {
    after(async () => {
      const { data: l } = await service.from('listings').select('title').eq('id', order.listing_id).single()
      await notify(service, order.seller_id, 'delivered', { itemTitle: (l as { title?: string } | null)?.title, orderId })
    })
  }

  // Re-fetch order after release to get current stripe_transfer_id
  // (a concurrent cron run could have issued the transfer between our two RPCs)
  const { data: freshOrder } = await service
    .from('orders')
    .select('stripe_transfer_id')
    .eq('id', orderId)
    .single()

  // Skip if already transferred (idempotent)
  if (freshOrder?.stripe_transfer_id) {
    return NextResponse.json({ ok: true })
  }

  // Create Stripe transfer to seller's Connect account
  // transfer_cents = item_cents - seller_fee_cents
  let transferId: string | undefined
  try {
    const transfer = await stripe.transfers.create({
      amount:      order.transfer_cents,
      currency:    'usd',
      destination: seller.stripe_connect_account_id,
      description: `Order ${orderId} — funds release`,
      metadata:    { order_id: orderId },
    })
    transferId = transfer.id
  } catch (stripeError) {
    // Transfer failed — order is released in DB but no transfer yet.
    // This is logged and the /api/cron/process-transfers endpoint will retry.
    console.error('[deliver] Stripe transfer error:', stripeError)
    return NextResponse.json({ ok: true, transferPending: true })
  }

  // Store transfer ID on order
  if (transferId) {
    await service
      .from('orders')
      .update({ stripe_transfer_id: transferId })
      .eq('id', orderId)
  }

  return NextResponse.json({ ok: true, transferId })
}
