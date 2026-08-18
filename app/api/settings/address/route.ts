/**
 * POST /api/settings/address — save the signed-in user's shipping (buyer) or ship-from
 * (seller return) address. G12: these feed prepaid-label purchase. Validates completeness
 * (a label needs name + street + city/state/zip). Body: { kind:'shipping'|'ship_from', address }.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { isCompleteAddress, type LabelAddress } from '@/lib/shipping-labels'

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

  const a = (body.address ?? {}) as Partial<LabelAddress>
  const address = {
    name:    String(a.name ?? '').trim().slice(0, 100),
    street1: String(a.street1 ?? '').trim().slice(0, 200),
    street2: (String(a.street2 ?? '').trim().slice(0, 200)) || null,
    city:    String(a.city ?? '').trim().slice(0, 100),
    state:   String(a.state ?? '').trim().toUpperCase().slice(0, 50),
    zip:     String(a.zip ?? '').trim().slice(0, 20),
    country: 'US',
  }
  if (!isCompleteAddress(address)) {
    return NextResponse.json({ error: 'Please fill in name, street, city, state, and ZIP.', code: 'incomplete' }, { status: 400 })
  }

  const col = kind === 'shipping' ? 'shipping_address' : 'ship_from_address'
  const service = createServiceClientRaw()
  const { error } = await service.from('profiles').update({ [col]: address }).eq('id', user.id)
  if (error) {
    console.error('[settings/address] update error:', error)
    return NextResponse.json({ error: 'Could not save address' }, { status: 500 })
  }
  return NextResponse.json({ ok: true, address })
}
