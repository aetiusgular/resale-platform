import { NextRequest, NextResponse, after } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { SAVED_SEARCH_ALERTS_ENABLED } from '@/lib/flags'
import { dispatchSavedSearchAlerts } from '@/lib/search/dispatch'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Admin check — query the profile role
  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { id } = await params

  // Use service client to bypass RLS for the status→active transition
  const service = await createServiceClient()

  // Gate: seller must have payouts_enabled before listing can go active.
  const { data: listing } = await service
    .from('listings')
    .select('seller_id')
    .eq('id', id)
    .eq('status', 'pending_review')
    .single()

  if (!listing) {
    return NextResponse.json({ error: 'Listing not found or not pending review' }, { status: 404 })
  }

  const { data: sellerProfile } = await service
    .from('profiles')
    .select('payouts_enabled')
    .eq('id', listing.seller_id)
    .single()

  if (!sellerProfile?.payouts_enabled) {
    return NextResponse.json(
      { error: 'Seller has not completed Stripe Connect onboarding. Listing cannot be activated until payouts are enabled.' },
      { status: 422 },
    )
  }

  const { error } = await service
    .from('listings')
    .update({ status: 'active' })
    .eq('id', id)
    .eq('status', 'pending_review')

  if (error) {
    console.error('[admin/approve] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // G8: alert users whose saved search matches this now-active listing (non-blocking).
  if (SAVED_SEARCH_ALERTS_ENABLED) {
    after(async () => {
      await dispatchSavedSearchAlerts(createServiceClientRaw(), id, process.env.NEXT_PUBLIC_APP_URL)
    })
  }

  return NextResponse.json({ ok: true })
}
