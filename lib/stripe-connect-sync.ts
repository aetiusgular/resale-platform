/**
 * Stripe Connect account → profiles.payouts_enabled (+ G11 payout-bank identity locks).
 *
 * ONE implementation for the two places a connected account's state reaches us:
 *   1. the `account.updated` webhook (app/api/webhooks/stripe). For Express accounts this is
 *      a CONNECT event: Stripe delivers it only to an endpoint created with "Listen to events
 *      on Connected accounts", which has its own signing secret (STRIPE_CONNECT_WEBHOOK_SECRET).
 *   2. the onboarding return URL (app/api/stripe/connect/return), which retrieves the account
 *      by API after the seller comes back from Stripe-hosted onboarding. That makes a seller
 *      payout-ready even when the Connect endpoint is misconfigured or its event is late.
 *
 * Both callers pass a Stripe.Account object; this module never trusts client input.
 * Server-only (imports the Stripe secret client): route handlers and server code only.
 */
import type Stripe from 'stripe'
import stripe from '@/lib/stripe'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { COLLUSION_HOLD_ENABLED, IDENTITY_LOCKS_ENABLED } from '@/lib/flags'

type ServiceClient = ReturnType<typeof createServiceClientRaw>

export async function syncConnectAccount(account: Stripe.Account, service: ServiceClient): Promise<{ payoutsEnabled: boolean; bankBlocked: boolean }> {
  const { data: prof } = await service.from('profiles').select('id').eq('stripe_connect_account_id', account.id).single()
  const uid = (prof as { id?: string } | null)?.id

  // Fetch this account's payout-bank fingerprints once (used for both the G11 hard lock and
  // collusion accumulation). Only meaningful once Stripe reports the account payout-ready.
  const captureOn = COLLUSION_HOLD_ENABLED || IDENTITY_LOCKS_ENABLED
  let banks: Stripe.BankAccount[] = []
  if (uid && account.payouts_enabled && captureOn) {
    try {
      const ext = await stripe.accounts.listExternalAccounts(account.id, { object: 'bank_account', limit: 10 })
      banks = ext.data as Stripe.BankAccount[]
    } catch (e) { console.warn('[identity] bank fingerprint fetch failed (fail-open):', e) }
  }
  const bankFps = banks.map((b) => b.fingerprint).filter((f): f is string => !!f)

  // G11 bank HARD lock: a payout bank may bind to only ONE account. If any of this account's
  // banks already belongs to a DIFFERENT user, block payouts here (welcome-farming / ban
  // evasion). The partial unique index is the DB backstop; this is the app-level enforcement.
  let bankBlocked = false
  if (IDENTITY_LOCKS_ENABLED && uid && bankFps.length) {
    try {
      const { data: owners } = await service.from('payment_identities')
        .select('user_id').eq('kind', 'bank').in('fingerprint', bankFps)
      bankBlocked = (owners ?? []).some((o) => (o as { user_id: string }).user_id !== uid)
    } catch (e) { console.warn('[identity] bank lock check failed (fail-open):', e) }
  }

  // payouts_enabled = Stripe's value AND not bank-blocked (unchanged when locks are off).
  await service
    .from('profiles')
    .update({ payouts_enabled: (account.payouts_enabled ?? false) && !bankBlocked })
    .eq('stripe_connect_account_id', account.id)
  if (bankBlocked) {
    console.warn(`[identity] payouts blocked for ${account.id}: payout bank already bound to another account`)
  }

  // Accumulate this account's bank fingerprint(s) for future checks (bind to this user),
  // unless blocked (the bank belongs to someone else — never rebind it). Idempotent per user;
  // the partial unique index rejects a cross-account rebind at the DB as a final guard.
  if (uid && captureOn && !bankBlocked) {
    for (const bank of banks) {
      if (!bank.fingerprint) continue
      try {
        await service.from('payment_identities').upsert({
          user_id: uid, kind: 'bank', fingerprint: bank.fingerprint,
          billing_name: bank.account_holder_name ?? null, billing_zip: null,
        }, { onConflict: 'user_id,kind,fingerprint' })
      } catch (e) { console.warn('[identity] bank capture failed:', e) }
    }
  }

  return { payoutsEnabled: (account.payouts_enabled ?? false) && !bankBlocked, bankBlocked }
}
