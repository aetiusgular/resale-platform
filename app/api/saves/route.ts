import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/saves { listing_id } — save a listing
// DELETE /api/saves { listing_id } — unsave a listing

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { listing_id } = body
  if (typeof listing_id !== 'string' || !listing_id.trim()) {
    return NextResponse.json({ error: 'listing_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('saves')
    .insert({ user_id: user.id, listing_id })

  if (error) {
    // 23505 = unique_violation (already saved — treat as success)
    if (error.code === '23505') {
      return NextResponse.json({ saved: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ saved: true })
}

export async function DELETE(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { listing_id } = body
  if (typeof listing_id !== 'string' || !listing_id.trim()) {
    return NextResponse.json({ error: 'listing_id required' }, { status: 400 })
  }

  const { error } = await supabase
    .from('saves')
    .delete()
    .eq('user_id', user.id)
    .eq('listing_id', listing_id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: false })
}
