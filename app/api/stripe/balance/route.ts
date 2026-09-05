/**
 * GET /api/stripe/balance — Settings → PAYOUTS (option 2E): Stripe Express status,
 * bank on file, AVAILABLE / PENDING ESCROW / PAID OUT — ALL TIME and the last 90
 * days of payouts. Read-only. Stripe calls are scoped to the seller's connected
 * account; escrow figures come from our orders (money never leaves the ledger
 * here). Fail-soft: a Stripe outage returns the escrow numbers with stripe=null.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import stripe from '@/lib/stripe'

const HELD_STATES = ['paid_held', 'seller_confirmed', 'shipped', 'delivered']

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = createServiceClientRaw()
  const [{ data: profile }, { data: held }, { data: released }] = await Promise.all([
    service.from('profiles').select('stripe_connect_account_id, payouts_enabled').eq('id', user.id).single(),
    service.from('orders').select('transfer_cents').eq('seller_id', user.id).in('state', HELD_STATES),
    service.from('orders').select('transfer_cents, released_at, listing_id, id').eq('seller_id', user.id).eq('state', 'released'),
  ])
  const pendingEscrowCents = ((held ?? []) as Array<{ transfer_cents: number }>).reduce((s, o) => s + (o.transfer_cents ?? 0), 0)
  const releasedRows = (released ?? []) as Array<{ transfer_cents: number; released_at: string | null; listing_id: string; id: string }>
  const paidOutAllTimeCents = releasedRows.reduce((s, o) => s + (o.transfer_cents ?? 0), 0)

  const accountId = (profile as { stripe_connect_account_id?: string | null } | null)?.stripe_connect_account_id ?? null
  const payoutsEnabled = !!(profile as { payouts_enabled?: boolean } | null)?.payouts_enabled

  let stripeInfo: null | {
    availableCents: number
    pendingCents: number
    bank: { name: string | null; last4: string | null } | null
    payouts: Array<{ id: string; date: string; amountCents: number; status: string; description: string | null }>
  } = null

  if (accountId) {
    try {
      const opts = { stripeAccount: accountId }
      const since = Math.floor((Date.now() - 90 * 24 * 60 * 60 * 1000) / 1000)
      const [balance, account, payouts] = await Promise.all([
        stripe.balance.retrieve({}, opts),
        stripe.accounts.retrieve(accountId, { expand: ['external_accounts'] }),
        stripe.payouts.list({ limit: 20, created: { gte: since } }, opts),
      ])
      const usd = (arr: Array<{ currency: string; amount: number }>) => arr.filter((b) => b.currency === 'usd').reduce((s, b) => s + b.amount, 0)
      const ext = (account.external_accounts?.data ?? [])[0] as { object?: string; bank_name?: string; last4?: string; brand?: string } | undefined
      stripeInfo = {
        availableCents: usd(balance.available),
        pendingCents: usd(balance.pending),
        bank: ext ? { name: ext.bank_name ?? ext.brand ?? null, last4: ext.last4 ?? null } : null,
        payouts: payouts.data.map((p) => ({
          id: p.id,
          date: new Date((p.arrival_date ?? p.created) * 1000).toISOString(),
          amountCents: p.amount,
          status: p.status,
          description: p.description ?? null,
        })),
      }
    } catch (e) {
      console.warn('[stripe/balance] Stripe read failed (fail-soft):', e)
    }
  }

  return NextResponse.json({
    connected: !!accountId,
    payoutsEnabled,
    pendingEscrowCents,
    paidOutAllTimeCents,
    stripe: stripeInfo,
  })
}
