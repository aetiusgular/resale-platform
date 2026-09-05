/**
 * POST /api/account/delete { confirm: "DELETE" } — Settings → DELETE ACCOUNT…
 *
 * Hard-deletes the auth user (profiles cascade) when nothing references the
 * account with ON DELETE RESTRICT. Accounts with orders, conversations or
 * messages keep their ledger rows and are anonymised instead: username →
 * deleted_<8 hex>, display name / avatar / phone / addresses cleared, the auth
 * email scrambled, and the profile banned so it can never act again. Either way
 * the session ends. The seller's live listings are removed first.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { randomBytes } from 'node:crypto'

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { confirm?: unknown } = {}
  try { body = await request.json() } catch { /* fallthrough */ }
  if (body.confirm !== 'DELETE') return NextResponse.json({ error: 'Type DELETE to confirm.' }, { status: 400 })

  const service = createServiceClientRaw()

  // Open money can't be abandoned: block while an escrow is in flight either side.
  const { count: openOrders } = await service
    .from('orders').select('id', { count: 'exact', head: true })
    .or(`buyer_id.eq.${user.id},seller_id.eq.${user.id}`)
    .in('state', ['paid_held', 'seller_confirmed', 'shipped', 'delivered', 'disputed'])
  if ((openOrders ?? 0) > 0) {
    return NextResponse.json({ error: 'You have an order in progress. Finish or resolve it before deleting your account.', code: 'open_orders' }, { status: 409 })
  }

  // Take live listings down first (drafts are cascaded / harmless).
  await service.from('listings').update({ status: 'removed', rejection_reason: 'Account deleted.' })
    .eq('seller_id', user.id).in('status', ['active', 'pending_review'])

  // Try the clean delete first.
  const { error: delErr } = await service.auth.admin.deleteUser(user.id)
  if (!delErr) {
    await supabase.auth.signOut()
    return NextResponse.json({ ok: true, mode: 'deleted' })
  }

  // RESTRICT FKs (orders / conversations / messages) → anonymise instead.
  const suffix = randomBytes(4).toString('hex')
  const { error: profErr } = await service.from('profiles').update({
    username: `deleted_${suffix}`,
    display_name: null,
    avatar_url: null,
    phone: null,
    phone_verified_at: null,
    shipping_address: null,
    ship_from_address: null,
    sizes: {},
    banned: true,
    banned_at: new Date().toISOString(),
    banned_reason: 'account_deleted',
  }).eq('id', user.id)
  if (profErr) {
    console.error('[account/delete] anonymise failed:', profErr)
    return NextResponse.json({ error: 'Could not delete account right now.' }, { status: 500 })
  }
  await service.from('addresses').delete().eq('user_id', user.id)
  await service.from('push_subscriptions').delete().eq('user_id', user.id)
  await service.auth.admin.updateUserById(user.id, {
    email: `deleted+${suffix}@archive.invalid`,
    password: randomBytes(24).toString('hex'),
    user_metadata: { deleted: true },
  })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true, mode: 'anonymised' })
}
