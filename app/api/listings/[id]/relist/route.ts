/**
 * POST /api/listings/[id]/relist — RELIST a sold (or removed) listing: copies the
 * row into a new draft the wizard opens for review. Photos are reused by URL.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isBanned } from '@/lib/auth/ban'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  if (await isBanned(createServiceClientRaw(), user.id)) {
    return NextResponse.json({ error: 'Your account is suspended.', code: 'banned' }, { status: 403 })
  }

  const { data: src } = await supabase
    .from('listings')
    .select('seller_id, status, title, brand, category, department, subcategory, size, color, description, condition_score, condition_notes, price_cents, images, possession_photo_url, measurements, ships_from, intl_shipping')
    .eq('id', id)
    .single()
  if (!src || src.seller_id !== user.id) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (!['sold', 'removed'].includes(src.status)) return NextResponse.json({ error: 'Only sold or removed listings can be relisted' }, { status: 409 })

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: user.id, status: 'draft',
      title: src.title, brand: src.brand, category: src.category, department: src.department,
      subcategory: src.subcategory, size: src.size, color: src.color, description: src.description,
      condition_score: src.condition_score, condition_notes: src.condition_notes ?? {},
      price_cents: src.price_cents, images: src.images ?? [], possession_photo_url: src.possession_photo_url,
      measurements: src.measurements ?? {},
      // Shipping lanes carry over; the draft re-keys them if the seller has since moved.
      ships_from: src.ships_from ?? 'US', intl_shipping: src.intl_shipping ?? {},
    })
    .select('id')
    .single()
  if (error) {
    console.error('[listings/:id/relist] insert error:', error)
    return NextResponse.json({ error: 'Could not relist' }, { status: 500 })
  }
  return NextResponse.json({ id: data.id }, { status: 201 })
}
