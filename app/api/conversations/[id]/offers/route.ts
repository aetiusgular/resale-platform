/**
 * POST /api/conversations/[id]/offers
 * Create a new offer in a conversation (open state, 24h expiry).
 * Both buyer and seller can make offers; from_user = caller.
 * Any existing open offer from the caller is voided before creating the new one.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'

interface RouteContext {
  params: Promise<{ id: string }>
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function POST(request: NextRequest, { params }: RouteContext) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id: conversationId } = await params
  if (!UUID_RE.test(conversationId)) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  let body: { amountCents?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const amountCents = Number(body.amountCents)
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents must be a positive integer' }, { status: 400 })
  }

  const service = createServiceClientRaw()

  // Verify participant
  const { data: conv } = await service
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id')
    .eq('id', conversationId)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  if (conv.buyer_id !== user.id && conv.seller_id !== user.id) {
    return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })
  }

  // Fetch listing price as floor/ceiling reference (must still be active or pending_escrow from accepted offer)
  const { data: listing } = await service
    .from('listings')
    .select('price_cents, status')
    .eq('id', conv.listing_id)
    .single()

  if (!listing || listing.status === 'sold' || listing.status === 'removed') {
    return NextResponse.json({ error: 'Listing is no longer available' }, { status: 409 })
  }

  // Check for existing open offer from this user — close it as voided if present
  // (Only one open offer per user per conversation at a time)
  const { data: existingOpen } = await service
    .from('offers')
    .select('id')
    .eq('conversation_id', conversationId)
    .eq('from_user', user.id)
    .eq('state', 'open')
    .maybeSingle()

  if (existingOpen) {
    await service
      .from('offers')
      .update({ state: 'voided' })
      .eq('id', existingOpen.id)
  }

  // Create the new offer
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data: offer, error } = await service
    .from('offers')
    .insert({
      conversation_id: conversationId,
      listing_id:      conv.listing_id,
      from_user:       user.id,
      amount_cents:    amountCents,
      state:           'open',
      expires_at:      expiresAt,
    })
    .select()
    .single()

  if (error || !offer) {
    // Restore the voided offer if the insert failed (compensate non-atomic operation)
    if (existingOpen) {
      await service.from('offers').update({ state: 'open' }).eq('id', existingOpen.id)
    }
    console.error('[offers] insert error:', error)
    return NextResponse.json({ error: 'Failed to create offer' }, { status: 500 })
  }

  return NextResponse.json({ offer }, { status: 201 })
}
