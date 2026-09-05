/**
 * Address book (Settings → ADDRESS, option 2B). Multiple US addresses, one default;
 * the default is mirrored into profiles.shipping_address by a DB trigger so checkout
 * and prepaid labels keep reading the same field.
 *
 * GET  /api/settings/addresses            → { addresses }
 * POST /api/settings/addresses { address, is_default? } → { address }
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { cleanAddress } from '@/lib/addresses'

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { data, error } = await supabase.from('addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false }).order('created_at', { ascending: true })
  if (error) return NextResponse.json({ error: 'Could not load addresses' }, { status: 500 })
  return NextResponse.json({ addresses: data ?? [] })
}

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { address?: unknown; is_default?: unknown }
  try { body = await request.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }
  const cleaned = cleanAddress(body.address)
  if ('error' in cleaned) return NextResponse.json({ error: cleaned.error, code: 'incomplete' }, { status: 400 })

  // Same address already in the book (checkout re-saves the typed address on every purchase):
  // reuse the row instead of inserting a duplicate, promoting it to default when asked.
  // The default is what the DB trigger mirrors into profiles.shipping_address.
  const a = cleaned.address
  const { data: existing } = await supabase
    .from('addresses')
    .select('*')
    .eq('user_id', user.id)
    .eq('name', a.name).eq('street1', a.street1).eq('city', a.city).eq('state', a.state).eq('zip', a.zip)
    .limit(5)
  const same = (existing ?? []).find((r) => ((r as { street2?: string | null }).street2 ?? '') === (a.street2 ?? ''))
  if (same) {
    if (body.is_default === true && !(same as { is_default?: boolean }).is_default) {
      const { data: promoted, error: promoteErr } = await supabase
        .from('addresses')
        .update({ is_default: true })
        .eq('id', (same as { id: string }).id)
        .eq('user_id', user.id)
        .select('*')
        .single()
      if (promoteErr) {
        console.error('[settings/addresses] promote error:', promoteErr)
        return NextResponse.json({ error: 'Could not save address' }, { status: 500 })
      }
      return NextResponse.json({ address: promoted })
    }
    return NextResponse.json({ address: same })
  }

  const { count } = await supabase.from('addresses').select('id', { count: 'exact', head: true }).eq('user_id', user.id)
  if ((count ?? 0) >= 10) return NextResponse.json({ error: 'Address book is full (10). Remove one in Settings → Address.' }, { status: 429 })
  // First address is always the default.
  const isDefault = (count ?? 0) === 0 ? true : body.is_default === true

  const { data, error } = await supabase
    .from('addresses')
    .insert({ user_id: user.id, ...cleaned.address, is_default: isDefault })
    .select('*')
    .single()
  if (error) {
    console.error('[settings/addresses] insert error:', error)
    return NextResponse.json({ error: 'Could not save address' }, { status: 500 })
  }
  return NextResponse.json({ address: data }, { status: 201 })
}
