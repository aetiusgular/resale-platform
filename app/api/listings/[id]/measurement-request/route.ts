/**
 * POST /api/listings/[id]/measurement-request — a buyer asks the seller to add
 * measurements to a listing that has none yet (PDP R5B empty state).
 *
 * One structured request per buyer per listing (idempotent — a repeat press just
 * returns ok). The seller is notified once per new request. Fulfilment (notifying the
 * requesters back) happens in the listing PATCH route when measurements are added.
 * Rate-limited as an abuse backstop.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isBanned } from '@/lib/auth/ban'
import { checkRateLimit } from '@/lib/rate-limit'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify/dispatch'

export async function POST(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClientRaw()
  if (await isBanned(service, user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  const rl = await checkRateLimit(`meas_req:${user.id}`, 20, 60_000)
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: { 'Retry-After': String(rl.retryAfterSeconds) } })
  }

  // Existence + guardrails: active listing, not the seller's own, and only when
  // measurements are actually missing (the button is shown only in that state).
  const { data: listing } = await service
    .from('listings')
    .select('id, seller_id, status, title, measurements')
    .eq('id', id)
    .single()
  if (!listing || listing.status !== 'active') return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (listing.seller_id === user.id) return NextResponse.json({ error: 'This is your own listing' }, { status: 400 })
  const meas = (listing.measurements ?? {}) as Record<string, unknown>
  if (Object.keys(meas).length > 0) {
    return NextResponse.json({ error: 'Measurements are already listed', code: 'already_present' }, { status: 409 })
  }

  // Idempotent insert (unique listing_id + requester_id). ignoreDuplicates so a repeat
  // press is a no-op that still returns requested:true; the seller is notified only on
  // a genuinely new row.
  const { data: inserted } = await service
    .from('measurement_requests')
    .upsert({ listing_id: id, requester_id: user.id }, { onConflict: 'listing_id,requester_id', ignoreDuplicates: true })
    .select('id')

  const isNew = Array.isArray(inserted) && inserted.length > 0
  if (isNew && NOTIFICATIONS_ENABLED) {
    const { data: me } = await service.from('profiles').select('username').eq('id', user.id).maybeSingle()
    await notify(service, listing.seller_id, 'measurement_request', {
      actorName: (me?.username as string) || undefined,
      itemTitle: listing.title ?? undefined,
      listingId: id,
    })
  }

  return NextResponse.json({ ok: true, requested: true })
}
