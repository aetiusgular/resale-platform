/**
 * POST /api/conversations/[id]/offers/[offerId]/decline
 * Decline an open offer. Only the RECIPIENT may decline.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { canRespond } from '@/lib/offers'
import type { Offer, Conversation } from '@/lib/offers'

interface RouteContext {
  params: Promise<{ id: string; offerId: string }>
}

export async function POST(_req: NextRequest, { params }: RouteContext) {
  const { id: conversationId, offerId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

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
    return NextResponse.json({ error: 'Cannot decline this offer' }, { status: 422 })
  }

  const { data: updated, error } = await service
    .from('offers')
    .update({ state: 'declined' })
    .eq('id', offerId)
    .eq('state', 'open')
    .select()
    .single()

  if (error || !updated) {
    return NextResponse.json({ error: 'Offer no longer open' }, { status: 409 })
  }

  return NextResponse.json({ offer: updated })
}
