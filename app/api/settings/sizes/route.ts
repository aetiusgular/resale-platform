/**
 * PUT /api/settings/sizes { sizes, hide_not_my_size? } — save the caller's size
 * selections (dept-scoped keys, see lib/sizes) and the "Hide listings that aren't
 * my size" switch. RLS (profiles_owner_update) scopes the write to the caller.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { normalizeSizes } from '@/lib/sizes'

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { sizes?: unknown; hide_not_my_size?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const patch: Record<string, unknown> = {}
  if (body.sizes !== undefined) {
    if (!body.sizes || typeof body.sizes !== 'object') {
      return NextResponse.json({ error: 'Invalid sizes' }, { status: 400 })
    }
    patch.sizes = normalizeSizes(body.sizes)
  }
  if (typeof body.hide_not_my_size === 'boolean') patch.hide_not_my_size = body.hide_not_my_size
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to save' }, { status: 400 })

  const { error } = await supabase.from('profiles').update(patch).eq('id', user.id)
  if (error) {
    console.error('[settings/sizes] update error:', error)
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, ...patch })
}
