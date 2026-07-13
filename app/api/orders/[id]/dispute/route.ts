/**
 * POST /api/orders/[id]/dispute
 * Buyer opens a dispute within 72h of delivery.
 * Requires ≥1 photo URL (photos uploaded to Supabase Storage separately).
 * Transitions order: delivered → disputed (freezes auto-release).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isDisputeWindowOpen } from '@/lib/orders'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { description?: unknown; photos?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { description, photos } = body

  if (typeof description !== 'string' || description.trim().length < 10) {
    return NextResponse.json({ error: 'description must be at least 10 characters' }, { status: 400 })
  }
  if (!Array.isArray(photos) || photos.length < 1 || !photos.every(p => typeof p === 'string')) {
    return NextResponse.json({ error: 'At least 1 photo URL required' }, { status: 400 })
  }

  const { id: orderId } = await params
  const service = createServiceClientRaw()

  const { data: order } = await service
    .from('orders')
    .select('id, buyer_id, state, delivered_at')
    .eq('id', orderId)
    .single()

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (order.buyer_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  if (order.state !== 'delivered') {
    return NextResponse.json(
      { error: `Disputes can only be opened on delivered orders (current: ${order.state})` },
      { status: 422 },
    )
  }

  // Enforce 72h window server-side
  if (!order.delivered_at || !isDisputeWindowOpen(new Date(order.delivered_at))) {
    return NextResponse.json(
      { error: 'Dispute window has closed (72h after delivery)' },
      { status: 422 },
    )
  }

  // Create dispute record first
  const { error: disputeError } = await service
    .from('disputes')
    .insert({
      order_id:    orderId,
      buyer_id:    user.id,
      photos:      photos as string[],
      description: description.trim(),
    })

  if (disputeError) {
    if (disputeError.code === '23505') {
      return NextResponse.json({ error: 'Dispute already opened for this order' }, { status: 409 })
    }
    throw new Error(`Dispute insert failed: ${disputeError.message}`)
  }

  // Transition order to disputed state
  const { error: transitionError } = await service.rpc('transition_order', {
    p_order_id:     orderId,
    p_to_state:     'disputed',
    p_source:       'user',
    p_stripe_event: null,
    p_payload:      { opened_by: user.id },
  })

  if (transitionError) {
    // Roll back the dispute insert if transition fails
    await service.from('disputes').delete().eq('order_id', orderId)
    return NextResponse.json({ error: transitionError.message }, { status: 422 })
  }

  return NextResponse.json({ ok: true })
}
