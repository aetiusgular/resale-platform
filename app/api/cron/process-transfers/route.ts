/**
 * GET /api/cron/process-transfers
 *
 * Processes Stripe transfers for orders that are in 'released' state but
 * have no stripe_transfer_id yet. This handles:
 *   1. Auto-released orders (pg_cron changes state but can't call Stripe)
 *   2. Failed transfers from the deliver endpoint (retry path)
 *
 * Protected by CRON_SECRET header. Called by Vercel cron (vercel.json) every hour.
 * Safe to call manually for testing (with correct secret).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'
import { applyTierProgress } from '@/lib/tier-progress'
import { issueBuyerRewards } from '@/lib/rewards'
import { checkEliteEligibility } from '@/lib/seller-program'
import { BUYER_REWARDS_ENABLED } from '@/lib/flags'
import { collusionHold } from '@/lib/trust/collusion-signals'
import { COLLUSION_HOLD_ENABLED } from '@/lib/flags'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  // CRON_SECRET is mandatory — never skip auth even in development
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[process-transfers] CRON_SECRET is not set — refusing to process transfers')
    return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 })
  }
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const service = createServiceClientRaw()

  // Find released orders with no transfer yet
  const { data: orders } = await service
    .from('orders')
    .select('id, buyer_id, seller_id, transfer_cents, shipping_address')
    .eq('state', 'released')
    .is('stripe_transfer_id', null)
    .is('transfer_hold_reason', null)
    .limit(50)

  if (!orders?.length) {
    return NextResponse.json({ processed: 0 })
  }

  const sellerIds = [...new Set(orders.map(o => o.seller_id))]
  const { data: sellers } = await service
    .from('profiles')
    .select('id, stripe_connect_account_id')
    .in('id', sellerIds)

  const sellerMap = new Map(sellers?.map(s => [s.id, s.stripe_connect_account_id]) ?? [])

  let processed = 0
  let failed = 0

  for (const order of orders) {
    const connectAccountId = sellerMap.get(order.seller_id)
    if (!connectAccountId) { failed++; continue }

    if (COLLUSION_HOLD_ENABLED) {
      const { held } = await collusionHold(service, order)
      if (held) { continue }
    }

    try {
      const transfer = await stripe.transfers.create({
        amount:      order.transfer_cents,
        currency:    'usd',
        destination: connectAccountId,
        description: `Order ${order.id} — auto-release transfer`,
        metadata:    { order_id: order.id, source: 'cron' },
      })
      await service
        .from('orders')
        .update({ stripe_transfer_id: transfer.id })
        .eq('id', order.id)
      processed++
      // v2 stateful tiers: auto-released sale upgrades both parties (idempotent).
      await Promise.all([
        applyTierProgress(service, order.buyer_id, 'buyer'),
        applyTierProgress(service, order.seller_id, 'seller'),
      ])
      // Fee Model v3: grant buyer milestone rewards + check elite-seller threshold (fail-soft).
      await Promise.all([
        BUYER_REWARDS_ENABLED ? issueBuyerRewards(service, order.buyer_id) : Promise.resolve([]),
        checkEliteEligibility(service, order.seller_id),
      ])
    } catch (err) {
      console.error(`[process-transfers] Transfer failed for order ${order.id}:`, err)
      failed++
    }
  }

  return NextResponse.json({ processed, failed })
}
