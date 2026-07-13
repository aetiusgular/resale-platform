/**
 * POST /api/conversations/[id]/offers/[offerId]/counter
 * Counter an open offer: marks the existing offer as 'countered' and creates
 * a new open offer with the counter amount. Only the RECIPIENT may counter.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { canRespond } from '@/lib/offers'
import type { Offer, Conversation } from '@/lib/offers'

interface RouteContext {
  params: Promise<{ id: string; offerId: string }>
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const { id: conversationId, offerId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { amountCents?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const amountCents = Number(body.amountCents)
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    return NextResponse.json({ error: 'amountCents must be a positive integer' }, { status: 400 })
  }

  const service = createServiceClientRaw()

  const { data: conv } = await service
    .from('conversations')
    .select('id, listing_id, buyer_id, seller_id')
    .eq('id', conversationId)
    .single()

  if (!conv) return NextResponse.json({ error: 'Conversation not found' }, { status: 404 })

  const { data: offer } = await service
    .from('offers')
    .select('id, conversation_id, listing_id, from_user, amount_cents, state, expires_at, accepted_at, created_at')
    .eq('id', offerId)
    .eq('conversation_id', conversationId)
    .single()

  if (!offer) return NextResponse.json({ error: 'Offer not found' }, { status: 404 })

  if (!canRespond(offer as Offer, conv as Conversation, user.id)) {
    return NextResponse.json({ error: 'Cannot counter this offer' }, { status: 422 })
  }

  // Mark existing offer as countered
  const { error: markErr } = await service
    .from('offers')
    .update({ state: 'countered' })
    .eq('id', offerId)
    .eq('state', 'open')

  if (markErr) {
    return NextResponse.json({ error: 'Offer no longer open' }, { status: 409 })
  }

  // Create the counter-offer
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
  const { data: newOffer, error: insertErr } = await service
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

  if (insertErr || !newOffer) {
    // Restore the original offer to 'open' if counter-offer creation failed
    await service.from('offers').update({ state: 'open' }).eq('id', offerId)
    console.error('[offers/counter] insert error:', insertErr)
    return NextResponse.json({ error: 'Failed to create counter-offer' }, { status: 500 })
  }

  return NextResponse.json({ offer: newOffer }, { status: 201 })
}
