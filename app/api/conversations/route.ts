/**
 * POST /api/conversations
 * Create or return existing conversation for (listingId, buyerId, sellerId).
 * Buyer opens the conversation; seller cannot initiate.
 *
 * GET /api/conversations
 * List conversations for the current user (inbox).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'

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

  // RLS ensures participants only see their own conversations
  const { data: conversations, error } = await supabase
    .from('conversations')
    .select(`
      id, listing_id, buyer_id, seller_id,
      comments_consent_buyer, comments_consent_seller,
      updated_at, created_at,
      listings:listing_id (title, brand, price_cents, images, status),
      buyer:buyer_id (username),
      seller:seller_id (username)
    `)
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .order('updated_at', { ascending: false })
    .limit(50)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch conversations' }, { status: 500 })
  }

  return NextResponse.json({ conversations })
}
