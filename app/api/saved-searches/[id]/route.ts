/**
 * PATCH  /api/saved-searches/[id] { alerts_enabled?, seen? } — ALERTS ON/OFF toggle;
 *        `seen: true` moves the "n NEW" cursor to now (after VIEW →).
 * DELETE /api/saved-searches/[id] — remove a saved search.
 * RLS (saved_searches_owner_*) scopes everything to the caller.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { alerts_enabled?: unknown; seen?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const patch: Record<string, unknown> = {}
  if (typeof body.alerts_enabled === 'boolean') patch.alerts_enabled = body.alerts_enabled
  if (body.seen === true) patch.last_seen_at = new Date().toISOString()
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase.from('saved_searches').update(patch).eq('id', id).eq('user_id', user.id).select('id')
  if (error) return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true, ...patch })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('saved_searches').delete().eq('id', id).eq('user_id', user.id).select('id')
  if (error) return NextResponse.json({ error: 'Could not delete' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
