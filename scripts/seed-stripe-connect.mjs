/**
 * Make the e2e test seller payout-ready in Stripe TEST MODE — programmatically, no
 * hosted-onboarding browser flow. DEV/TEST ONLY: refuses to run unless
 * STRIPE_SECRET_KEY is an sk_test_ key.
 *
 *   node scripts/seed-stripe-connect.mjs
 *
 * Creates a Connect CUSTOM account with the transfers capability using Stripe's
 * documented test values (address_full_match, ssn_last_4 0000, test routing
 * 110000000 / account 000123456789, tos_acceptance) — in test mode these clear the
 * requirements immediately. Polls until payouts_enabled, then stamps the seller's
 * profile (stripe_connect_account_id + payouts_enabled=true, mirroring what the
 * account.updated webhook does in the real flow). Idempotent: exits early if the
 * profile is already payout-ready.
 *
 * Note: the app's REAL sellers onboard via Express + hosted flow (/settings/payouts);
 * this custom account exists purely so the @live suite can create PaymentIntents and
 * receive test transfers without a manual browser step.
 */
import { readFileSync } from 'node:fs'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

// Dotenv-style load of .env.local (already-set env wins; quotes stripped).
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    if (line.trimStart().startsWith('#')) continue
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
} catch {
  console.error('Run from the repo root (no .env.local found).')
  process.exit(1)
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
const stripeKey = process.env.STRIPE_SECRET_KEY
const sellerEmail = process.env.TEST_SELLER_EMAIL

if (!url || !serviceKey || !stripeKey || !sellerEmail) {
  console.error('Missing in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, STRIPE_SECRET_KEY, TEST_SELLER_EMAIL.')
  process.exit(1)
}
if (!stripeKey.startsWith('sk_test_')) {
  console.error('Refusing: STRIPE_SECRET_KEY is not an sk_test_ key. This script is TEST MODE ONLY.')
  process.exit(1)
}

const stripe = new Stripe(stripeKey)
const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

async function findUserByEmail(email) {
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

async function main() {
  const seller = await findUserByEmail(sellerEmail)
  if (!seller) {
    console.error(`No auth user for TEST_SELLER_EMAIL (${sellerEmail}) — run seed-e2e-fixtures first.`)
    process.exit(1)
  }
  const { data: profile } = await admin
    .from('profiles')
    .select('payouts_enabled, stripe_connect_account_id')
    .eq('id', seller.id)
    .single()
  if (profile?.payouts_enabled && profile?.stripe_connect_account_id) {
    console.log(`Seller already payout-ready (${profile.stripe_connect_account_id}). Nothing to do.`)
    return
  }

  console.log('Creating test-mode Connect custom account…')
  const account = await stripe.accounts.create({
    type: 'custom',
    country: 'US',
    email: sellerEmail,
    capabilities: { transfers: { requested: true } },
    business_type: 'individual',
    // accessible.stripe.com = Stripe's documented test token for successful URL
    // validation (example.com is rejected with url_invalid on current API versions).
    business_profile: { mcc: '5691', url: 'https://accessible.stripe.com', product_description: 'e2e test seller' },
    individual: {
      first_name: 'Test',
      last_name: 'Seller',
      email: sellerEmail,
      phone: '0000000000', // documented test token: successful phone validation
      dob: { day: 1, month: 1, year: 1990 },
      ssn_last_4: '0000',
      address: { line1: 'address_full_match', city: 'San Francisco', state: 'CA', postal_code: '94103', country: 'US' },
    },
    tos_acceptance: { date: Math.floor(Date.now() / 1000), ip: '127.0.0.1' },
    external_account: {
      object: 'bank_account', country: 'US', currency: 'usd',
      routing_number: '110000000', account_number: '000123456789',
    },
  })

  // Test-mode requirements clear near-instantly; poll briefly for payouts_enabled.
  let ready = account
  for (let i = 0; i < 15 && !(ready.payouts_enabled && ready.capabilities?.transfers === 'active'); i++) {
    await new Promise((r) => setTimeout(r, 2000))
    ready = await stripe.accounts.retrieve(account.id)
  }
  if (!ready.payouts_enabled) {
    console.error(`Account ${account.id} not payouts_enabled after 30s.`)
    console.error('Outstanding requirements:', JSON.stringify(ready.requirements?.currently_due ?? []))
    process.exit(1)
  }

  const { error } = await admin
    .from('profiles')
    .update({ stripe_connect_account_id: account.id, payouts_enabled: true })
    .eq('id', seller.id)
  if (error) throw new Error(`profile update failed: ${error.message}`)

  console.log(`✓ seller payout-ready: ${account.id} (transfers=${ready.capabilities?.transfers}, payouts_enabled=${ready.payouts_enabled})`)
  console.log('Re-run:  RUN_LIVE_TESTS=1 pnpm exec playwright test tests/e2e/checkout.spec.ts')
}

main().catch((e) => { console.error(e); process.exit(1) })
