/**
 * POST /api/orders/[id]/ship
 * Seller marks order as shipped with carrier + tracking number.
 * (seller_confirmed → shipped)
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { carrier?: unknown; trackingNumber?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { carrier, trackingNumber } = body
  if (typeof carrier !== 'string' || !carrier.trim()) {
    return NextResponse.json({ error: 'carrier required' }, { status: 400 })
  }
  if (typeof trackingNumber !== 'string' || !trackingNumber.trim()) {
    return NextResponse.json({ error: 'trackingNumber required' }, { status: 400 })
  }

  const { id: orderId } = await params
  const service = createServiceClientRaw()

  const { data: order } = await service
    .from('orders')
    .select('seller_id, buyer_id, listing_id, state')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.seller_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Transition state first; only write carrier/tracking on success
  const { error } = await service.rpc('transition_order', {
    p_order_id:     orderId,
    p_to_state:     'shipped',
    p_source:       'user',
    p_stripe_event: null,
    p_payload:      { carrier: carrier.trim(), tracking_number: trackingNumber.trim() },
  })

  if (error) {
    console.error('[ship] transition error:', error)
    return NextResponse.json({ error: error.message }, { status: 422 })
  }

  // Write carrier + tracking only after confirmed state transition
  await service
    .from('orders')
    .update({ carrier: carrier.trim(), tracking_number: trackingNumber.trim() })
    .eq('id', orderId)

  if (NOTIFICATIONS_ENABLED) {
    after(async () => {
      const { data: l } = await service.from('listings').select('title').eq('id', order.listing_id).single()
      await notify(service, order.buyer_id, 'shipped', { itemTitle: (l as { title?: string } | null)?.title, orderId })
    })
  }

  return NextResponse.json({ ok: true })
}
