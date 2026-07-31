/**
 * POST   /api/follows { following_id }  — follow a seller
 * DELETE /api/follows { following_id }  — unfollow
 *
 * Behind FOLLOWS_ENABLED. Follows are not gated like reviews, so RLS handles authz
 * directly (follows_insert_own / follows_delete_own — auth.uid() = follower_id). The
 * UNIQUE(follower_id, following_id) makes follow idempotent; a duplicate is treated as OK.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { FOLLOWS_ENABLED } from '@/lib/flags'

async function readTarget(req: NextRequest): Promise<string | null> {
  try {
    const body = await req.json()
    return typeof body?.following_id === 'string' ? body.following_id : null
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  if (!FOLLOWS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const followingId = await readTarget(req)
  if (!followingId) return NextResponse.json({ error: 'following_id (string) required' }, { status: 400 })
  if (followingId === user.id) return NextResponse.json({ error: 'cannot_follow_self' }, { status: 400 })

  const { error } = await supabase
    .from('follows')
    .insert({ follower_id: user.id, following_id: followingId })

  // 23505 = unique_violation → already following → idempotent success.
  if (error && error.code !== '23505') {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true, following: true })
}

export async function DELETE(req: NextRequest) {
  if (!FOLLOWS_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const followingId = await readTarget(req)
  if (!followingId) return NextResponse.json({ error: 'following_id (string) required' }, { status: 400 })

  const { error } = await supabase
    .from('follows')
    .delete()
    .eq('follower_id', user.id)
    .eq('following_id', followingId)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true, following: false })
}
