/**
 * Listing drafts — the wizard auto-saves while the seller types (design: "DRAFT
 * AUTO-SAVED"). A draft is a listings row with status='draft' and possibly partial
 * fields (migration 0045 relaxes NOT NULL for drafts only). Publishing goes
 * through POST /api/listings (the full anti-slop / pHash / prohibited pipeline)
 * with `draft_id`, which deletes the draft on success.
 *
 * POST /api/listings/drafts { ...fields } → { id }         create a draft
 * GET  /api/listings/drafts                → { drafts }     the caller's drafts
 *
 * Writes go through the caller's client, so RLS (listings_seller_insert /
 * listings_seller_update, status ∈ draft|pending_review) is the authority.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isBanned } from '@/lib/auth/ban'
import { allImageUrlsAllowed, storageHost } from '@/lib/security/image-url'
import { cleanDraftFields } from '@/lib/listings/draft-fields'

export const runtime = 'nodejs'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase
    .from('listings')
    .select('id, title, brand, category, department, subcategory, size, color, price_cents, images, possession_photo_url, description, condition_score, measurements, updated_at, created_at')
    .eq('seller_id', user.id)
    .eq('status', 'draft')
    .order('updated_at', { ascending: false })
  if (error) return NextResponse.json({ error: 'Failed to load drafts' }, { status: 500 })
  return NextResponse.json({ drafts: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await isBanned(createServiceClientRaw(), user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  let body: Record<string, unknown>
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const fields = cleanDraftFields(body)
  const host = storageHost()
  const urls = [...(fields.images ?? []), fields.possession_photo_url ?? ''].filter(Boolean)
  if (host && urls.length && !allImageUrlsAllowed(urls, host)) {
    return NextResponse.json({ error: 'Images must be uploaded to the platform.', code: 'invalid_image_url' }, { status: 400 })
  }

  // Cap open drafts so the catalog's DRAFTS tab stays sane.
  const { count } = await supabase.from('listings').select('id', { count: 'exact', head: true }).eq('seller_id', user.id).eq('status', 'draft')
  if ((count ?? 0) >= 20) return NextResponse.json({ error: 'You have 20 open drafts — publish or delete one first.' }, { status: 429 })

  const { data, error } = await supabase
    .from('listings')
    .insert({ seller_id: user.id, status: 'draft', ...fields })
    .select('id')
    .single()
  if (error) {
    console.error('[listings/drafts] insert error:', error)
    return NextResponse.json({ error: 'Could not save draft' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}
