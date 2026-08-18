/**
 * Seed the @live e2e fixture accounts (tests/e2e/checkout.spec.ts prerequisites).
 * DEV/STAGING ONLY — refuses to run in production, mirrors scripts/seed-founders.ts.
 *
 * Plain Node (no tsx needed) and SELF-LOADS .env.local (dotenv-style parse) —
 * no shell `source` required (zsh chokes on dotenv values containing & / ?).
 *
 *   node scripts/seed-e2e-fixtures.mjs
 *
 * Creates (or resets the password of) the fixture auth users + profile rows:
 *   TEST_BUYER_EMAIL / TEST_ADMIN_EMAIL — created if missing (fresh generated passwords)
 *   TEST_SELLER_EMAIL                   — MUST already exist (it owns the Stripe test
 *                                         Connect account + seed listings); password reset
 * then picks an ACTIVE listing owned by the seller as TEST_LISTING_ID and prints the
 * exact block to paste into .env.local. Idempotent: re-running rotates passwords.
 */
import { randomBytes } from 'node:crypto'
import { readFileSync } from 'node:fs'
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
const sellerEmail = process.env.TEST_SELLER_EMAIL

if (process.env.NODE_ENV === 'production') {
  console.error('Refusing to run against production (NODE_ENV=production).')
  process.exit(1)
}
if (!url || !serviceKey || !sellerEmail) {
  console.error('Missing in .env.local: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, TEST_SELLER_EMAIL.')
  process.exit(1)
}

const admin = createClient(url, serviceKey, { auth: { persistSession: false } })

const pw = () => randomBytes(9).toString('base64url') // 12 chars, printed once below

async function findUserByEmail(email) {
  // Dev-scale scan (admin API has no direct lookup-by-email in this client version).
  for (let page = 1; page <= 10; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw new Error(`listUsers failed: ${error.message}`)
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase())
    if (hit) return hit
    if (data.users.length < 200) return null
  }
  return null
}

/** Get-or-create an auth user with a fresh password; ensure a profile row exists. */
async function ensureUser(email, role) {
  const password = pw()
  let user = await findUserByEmail(email)
  if (user) {
    const { error } = await admin.auth.admin.updateUserById(user.id, { password })
    if (error) throw new Error(`password reset failed for ${email}: ${error.message}`)
  } else {
    const { data, error } = await admin.auth.admin.createUser({ email, password, email_confirm: true })
    if (error || !data.user) throw new Error(`createUser failed for ${email}: ${error?.message}`)
    user = data.user
  }
  // Profiles are app-created at onboarding; the fixture user needs one to pass /browse gates.
  const username = email.split('@')[0].replace(/[^a-z0-9_]/gi, '_').slice(0, 24) || `user_${user.id.slice(0, 8)}`
  const { data: existing } = await admin.from('profiles').select('id, role').eq('id', user.id).single()
  if (!existing) {
    const { error } = await admin.from('profiles').insert({ id: user.id, username, role })
    if (error) throw new Error(`profile insert failed for ${email}: ${error.message}`)
  } else if (role === 'admin' && existing.role !== 'admin') {
    await admin.from('profiles').update({ role: 'admin' }).eq('id', user.id)
  }
  return { id: user.id, password }
}

async function main() {
  const buyerEmail = process.env.TEST_BUYER_EMAIL || 'e2e-buyer@test.local'
  const adminEmail = process.env.TEST_ADMIN_EMAIL || 'e2e-admin@test.local'

  const seller = await findUserByEmail(sellerEmail)
  if (!seller) {
    console.error(`TEST_SELLER_EMAIL (${sellerEmail}) has no auth user — it must be the existing`)
    console.error('seeded seller (owns the Stripe test Connect account). Aborting, nothing changed.')
    process.exit(1)
  }
  const sellerPassword = pw()
  const { error: spErr } = await admin.auth.admin.updateUserById(seller.id, { password: sellerPassword })
  if (spErr) throw new Error(`seller password reset failed: ${spErr.message}`)

  const { data: sellerProfile } = await admin
    .from('profiles')
    .select('payouts_enabled, stripe_connect_account_id')
    .eq('id', seller.id)
    .single()
  if (!sellerProfile?.payouts_enabled || !sellerProfile?.stripe_connect_account_id) {
    console.warn('⚠ seller is not payout-ready (payouts_enabled/stripe_connect_account_id missing).')
    console.warn('  Checkout-API tests will 422 until the test seller completes Stripe Connect')
    console.warn('  onboarding once via /settings/payouts (test mode).')
  }

  const buyer = await ensureUser(buyerEmail, 'member')
  const adminUser = await ensureUser(adminEmail, 'admin')

  const { data: listing } = await admin
    .from('listings')
    .select('id, title')
    .eq('seller_id', seller.id)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(1)
    .single()
  if (!listing) {
    console.warn('⚠ no ACTIVE listing owned by the seller — start the dev server and run:')
    console.warn('  curl -X POST http://localhost:3000/api/dev/seed   then re-run this script.')
  }

  console.log('\nAppend/replace these lines in .env.local:\n')
  console.log(`TEST_BUYER_EMAIL=${buyerEmail}`)
  console.log(`TEST_BUYER_PASSWORD=${buyer.password}`)
  console.log(`TEST_SELLER_EMAIL=${sellerEmail}`)
  console.log(`TEST_SELLER_PASSWORD=${sellerPassword}`)
  console.log(`TEST_ADMIN_EMAIL=${adminEmail}`)
  console.log(`TEST_ADMIN_PASSWORD=${adminUser.password}`)
  if (listing) {
    console.log(`# TEST_LISTING_ID = "${listing.title}"`)
    console.log(`TEST_LISTING_ID=${listing.id}`)
  }
  console.log('\nThen (no source needed — playwright.config.ts now loads .env.local itself):')
  console.log('  RUN_LIVE_TESTS=1 pnpm exec playwright test tests/e2e/checkout.spec.ts')
}

main().catch((e) => { console.error(e); process.exit(1) })
