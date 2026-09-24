/**
 * POST /api/settings/address — save the signed-in user's shipping (buyer) or ship-from
 * (seller return) address. G12: these feed prepaid-label purchase. Validates with
 * cleanAddress (lib/addresses). Body: { kind:'shipping'|'ship_from', address }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { cleanAddress } from '@/lib/addresses'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { kind?: unknown; address?: unknown }
  try { body = await req.json() } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }) }

  const kind = body.kind
  if (kind !== 'shipping' && kind !== 'ship_from') {
    return NextResponse.json({ error: "kind must be 'shipping' or 'ship_from'" }, { status: 400 })
  }

  // Same validation as the address book (lib/addresses): any supported country, strict
  // state / postal checks where the country has them.
  const cleaned = cleanAddress(body.address)
  if ('error' in cleaned) {
    return NextResponse.json({ error: cleaned.error, code: 'incomplete' }, { status: 400 })
  }
  const address = cleaned.address

  const col = kind === 'shipping' ? 'shipping_address' : 'ship_from_address'
  const service = createServiceClientRaw()
  const { error } = await service.from('profiles').update({ [col]: address }).eq('id', user.id)
  if (error) {
    console.error('[settings/address] update error:', error)
    return NextResponse.json({ error: 'Could not save address' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, address })
}
