/**
 * PATCH  /api/settings/addresses/[id] { address?, is_default? } — EDIT / SET DEFAULT.
 * DELETE /api/settings/addresses/[id] — REMOVE (the trigger promotes a new default).
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cleanAddress } from '@/lib/addresses'

interface Ctx { params: Promise<{ id: string }> }

export async function PATCH(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { address?: unknown; is_default?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const patch: Record<string, unknown> = {}
  if (body.address !== undefined) {
    const cleaned = cleanAddress(body.address)
    if ('error' in cleaned) return NextResponse.json({ error: cleaned.error, code: 'incomplete' }, { status: 400 })
    Object.assign(patch, cleaned.address)
  }
  if (body.is_default === true) patch.is_default = true
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })

  const { data, error } = await supabase.from('addresses').update(patch).eq('id', id).eq('user_id', user.id).select('*')
  if (error) return NextResponse.json({ error: 'Could not update address' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ address: data[0] })
}

export async function DELETE(_request: NextRequest, { params }: Ctx) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('addresses').delete().eq('id', id).eq('user_id', user.id).select('id')
  if (error) return NextResponse.json({ error: 'Could not remove address' }, { status: 500 })
  if (!data || data.length === 0) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
