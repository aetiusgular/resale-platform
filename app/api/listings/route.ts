import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: NextRequest) {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  const {
    title,
    brand,
    category,
    size,
    description,
    condition_score,
    condition_notes,
    price_cents,
    images,
    possession_photo_url,
  } = body

  // Basic validation
  if (
    typeof title !== 'string' || !title.trim() ||
    typeof brand !== 'string' || !brand.trim() ||
    typeof category !== 'string' || !category.trim() ||
    typeof size !== 'string' || !size.trim() ||
    typeof condition_score !== 'number' ||
    condition_score < 1 || condition_score > 10 ||
    typeof price_cents !== 'number' || price_cents <= 0 ||
    !Number.isInteger(price_cents) ||
    typeof possession_photo_url !== 'string' || !possession_photo_url.trim()
  ) {
    return NextResponse.json({ error: 'Invalid listing data' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('listings')
    .insert({
      seller_id: user.id,
      title: title.trim().toUpperCase(),
      brand: brand.trim().toUpperCase(),
      category: category.trim(),
      size: size.trim().toUpperCase(),
      description: (description ?? '').trim(),
      condition_score,
      condition_notes: condition_notes ?? {},
      price_cents,
      images: Array.isArray(images) ? images : [],
      possession_photo_url: possession_photo_url.trim(),
      status: 'pending_review',
    })
    .select('id, status')
    .single()

  if (error) {
    console.error('[api/listings] insert error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
