/**
 * POST /api/conversations/[id]/offers/[offerId]/decline
 * Decline an open offer. Only the RECIPIENT may decline.
 */
import { NextRequest, NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { canRespond } from '@/lib/offers'
import type { Offer, Conversation } from '@/lib/offers'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify'

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

  // "Offer declined" to whoever made it (OFFER RESULT bucket, design 14A).
  if (NOTIFICATIONS_ENABLED) {
    after(async () => {
      const [{ data: actor }, { data: l }] = await Promise.all([
        service.from('profiles').select('username').eq('id', user.id).single(),
        service.from('listings').select('title, brand').eq('id', conv.listing_id).single(),
      ])
      await notify(service, offer.from_user, 'offer_declined', {
        actorName: (actor as { username?: string } | null)?.username,
        itemTitle: (l as { title?: string } | null)?.title,
        brand: (l as { brand?: string } | null)?.brand,
        amountCents: offer.amount_cents,
        conversationId,
        offerId,
      })
    })
  }

  return NextResponse.json({ offer: updated })
}
