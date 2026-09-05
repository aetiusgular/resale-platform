/**
 * PATCH  /api/listings/[id] — edit your own listing.
 *   draft          → any field (partial), stays a draft.
 *   active/pending → title, description, price, size, colour, category tree,
 *                    measurements. Photos are locked once published (they are
 *                    hashed + possession-checked at publish time). A price CUT
 *                    notifies everyone who saved the item (price_drop) — the
 *                    price_history trigger records it either way.
 * DELETE /api/listings/[id] — delete your own draft (RLS: drafts only).
 * GET    /api/listings/[id] — the listing detail bundle /listings/[id] renders from
 *        (lib/loaders/listing): public for active + sold, seller/admin for other statuses.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isBanned } from '@/lib/auth/ban'
import { lintListing } from '@/lib/antislop-lint'
import { allImageUrlsAllowed, storageHost } from '@/lib/security/image-url'
import { cleanDraftFields } from '@/lib/listings/draft-fields'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { notify } from '@/lib/notify'
import { loadListingDetail } from '@/lib/loaders/listing'
import { ApiError, respond } from '@/lib/api/respond'

export const runtime = 'nodejs'

interface Ctx { params: Promise<{ id: string }> }

const UUID_RE_GET = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export async function GET(_request: NextRequest, { params }: Ctx) {
  return respond(async () => {
    const { id } = await params
    if (!UUID_RE_GET.test(id)) throw new ApiError(400, 'Invalid listing id')
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const detail = await loadListingDetail({ supabase, user, id })
    if (!detail) throw new ApiError(404, 'Not found')
    return detail
  })
}

const PUBLISHED_EDITABLE = new Set(['title', 'description', 'price_cents', 'size', 'color', 'category', 'subcategory', 'department', 'measurements', 'condition_score', 'condition_notes'])

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const service = createServiceClientRaw()
  if (await isBanned(service, user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const { data: listing } = await service
    .from('listings')
    .select('id, seller_id, status, title, brand, description, category, price_cents')
    .eq('id', id)
    .single()
  if (!listing || listing.seller_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['draft', 'active', 'pending_review'].includes(listing.status)) {
    return NextResponse.json({ error: 'This listing can no longer be edited' }, { status: 409 })
  }

  const fields = cleanDraftFields({ ...body, current_category: body.category ?? listing.category })
  const patch: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(fields)) {
    if (v === undefined) continue
    if (listing.status !== 'draft' && !PUBLISHED_EDITABLE.has(k)) continue
    if (listing.status !== 'draft' && v === null) continue // published rows keep their invariants
    patch[k] = v
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  if (listing.status !== 'draft') {
    // Anti-slop lint on the (new) copy — same bar as publishing.
    const title = (patch.title as string | undefined) ?? listing.title ?? ''
    const desc = (patch.description as string | undefined) ?? listing.description ?? ''
    const hard = lintListing(title, desc).find((v) => v.severity === 'reject')
    if (hard) return NextResponse.json({ error: hard.message }, { status: 400 })
  }
  const host = storageHost()
  const urls = [...((patch.images as string[] | undefined) ?? []), (patch.possession_photo_url as string | null | undefined) ?? ''].filter(Boolean)
  if (host && urls.length && !allImageUrlsAllowed(urls, host)) {
    return NextResponse.json({ error: 'Images must be uploaded to the platform.', code: 'invalid_image_url' }, { status: 400 })
  }

  // Drafts write through RLS; published rows need the service client (the seller
  // update policy blocks status='active' rows) — ownership was checked above.
  const writer = listing.status === 'draft' ? supabase : service
  const { error } = await writer.from('listings').update(patch).eq('id', id).eq('seller_id', user.id)
  if (error) {
    console.error('[listings/:id] update error:', error)
    return NextResponse.json({ error: 'Could not save changes' }, { status: 500 })
  }

  // Price cut on a live listing → tell everyone who saved it (non-blocking).
  const newPrice = patch.price_cents as number | undefined
  if (listing.status === 'active' && typeof newPrice === 'number' && typeof listing.price_cents === 'number' && newPrice < listing.price_cents && NOTIFICATIONS_ENABLED) {
    const { data: savers } = await service.from('saves').select('user_id').eq('listing_id', id).limit(500)
    const ids = new Set(((savers ?? []) as Array<{ user_id: string }>).map((s) => s.user_id))
    ids.delete(user.id)
    await Promise.all([...ids].map((uid) => notify(service, uid, 'price_drop', {
      itemTitle: listing.title ?? undefined, listingId: id, amountCents: newPrice, oldAmountCents: listing.price_cents,
    })))
  }

  return NextResponse.json({ ok: true, id, patch })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  // RLS: sellers may delete their own drafts only.
  const { data, error } = await supabase.from('listings').delete().eq('id', id).eq('seller_id', user.id).eq('status', 'draft').select('id')
  if (error) return NextResponse.json({ error: 'Could not delete draft' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Draft not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
