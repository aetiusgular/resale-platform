/**
 * POST /api/conversations
 * Create or return existing conversation for (listingId, buyerId, sellerId).
 * Buyer opens the conversation; seller cannot initiate.
 *
 * GET /api/conversations
 * The inbox rows for the current user — the same assembly /messages renders
 * (lib/loaders/inbox): handle, role, listing snapshot, preview, unread count.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { loadInbox } from '@/lib/loaders/inbox'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { listingId?: unknown }
  try { body = await request.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { listingId } = body
  if (typeof listingId !== 'string' || !listingId) {
    return NextResponse.json({ error: 'listingId required' }, { status: 400 })
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(listingId)) {
    return NextResponse.json({ error: 'Invalid listingId' }, { status: 400 })
  }

  const service = createServiceClientRaw()

  // Fetch listing to get seller_id
  const { data: listing } = await service
    .from('listings')
    .select('id, seller_id, status')
    .eq('id', listingId)
    .single()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found' }, { status: 404 })
  }
  if (listing.status === 'sold' || listing.status === 'removed') {
    return NextResponse.json({ error: 'Listing is no longer active' }, { status: 409 })
  }
  if (listing.seller_id === user.id) {
    return NextResponse.json({ error: 'Cannot message your own listing' }, { status: 422 })
  }

  // Upsert conversation (ignore conflict, return existing)
  const { data: conv, error } = await service
    .from('conversations')
    .upsert(
      {
        listing_id: listingId,
        buyer_id:   user.id,
        seller_id:  listing.seller_id,
      },
      { onConflict: 'listing_id,buyer_id,seller_id', ignoreDuplicates: false },
    )
    .select()
    .single()

  if (error || !conv) {
    console.error('[conversations] upsert error:', error)
    return NextResponse.json({ error: 'Failed to create conversation' }, { status: 500 })
  }

  return NextResponse.json({ conversation: conv }, { status: 201 })
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Same rows the /messages inbox renders (unread badge, preview, listing snapshot).
  const conversations = await loadInbox(supabase, user.id)
  return NextResponse.json({ conversations })
}
