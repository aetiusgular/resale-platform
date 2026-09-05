/**
 * PATCH /api/settings/profile { username?, display_name?, avatar_url? }
 * Settings → 01 PROFILE. Username: 3–30 chars [a-z0-9_], unique, and changeable once
 * per 30 days — the DB trigger (migration 0045) is the authority; this route maps
 * its error. Avatar URLs must live on our storage host (avatars/{uid}/…).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { allImageUrlsAllowed, storageHost } from '@/lib/security/image-url'

const USERNAME_RE = /^[a-z0-9_]{3,30}$/

export async function PATCH(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { username?: unknown; display_name?: unknown; avatar_url?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.username !== undefined) {
    const u = String(body.username).trim().toLowerCase().replace(/^@/, '')
    if (!USERNAME_RE.test(u)) return NextResponse.json({ error: 'username: 3–30 characters, letters/numbers/underscores only', code: 'invalid_username' }, { status: 400 })
    patch.username = u
  }
  if (body.display_name !== undefined) {
    const d = String(body.display_name).trim().slice(0, 40)
    patch.display_name = d || null
  }
  if (body.avatar_url !== undefined) {
    if (body.avatar_url === null || body.avatar_url === '') patch.avatar_url = null
    else {
      const url = String(body.avatar_url)
      const host = storageHost()
      if (host && !allImageUrlsAllowed([url], host)) return NextResponse.json({ error: 'Avatar must be uploaded to the platform.' }, { status: 400 })
      patch.avatar_url = url
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (error) {
    if (error.message.includes('username_change_window')) {
      return NextResponse.json({ error: 'Username can change once every 30 days.', code: 'username_window' }, { status: 409 })
    }
    if (error.code === '23505') return NextResponse.json({ error: 'That username is taken.', code: 'username_taken' }, { status: 409 })
    console.error('[settings/profile] update error:', error)
    return NextResponse.json({ error: 'Could not save' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...patch })
}
