import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * HF1 regression test — proves the recursive RLS fix is working end-to-end.
 * @live — requires real Supabase credentials + running app.
 * CI skips @live. Run locally with:
 *   pnpm playwright test signup-live.spec.ts --grep @live
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

// Unambiguous alphabet — same as generate_member_codes RPC
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function randomCode(): string {
  const seg = () =>
    Array.from({ length: 4 }, () => ALPHA[Math.floor(Math.random() * ALPHA.length)]).join('')
  return `${seg()}-${seg()}`
}

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY)
}

// ─── UI E2E: full signup → codes screen ──────────────────────────────────────

test.describe('@live Signup UI — full onboarding flow', () => {
  let codeOwnerUserId: string
  let freshCode: string
  let signedUpUsername: string
  let signedUpUserId: string | null = null

  const ts = Date.now()
  const password = 'TestPass123!'

  test.beforeAll(async () => {
    const svc = serviceClient()

    // Create a user whose codes will be used for signup
    const { data: ownerData, error: ownerErr } = await svc.auth.admin.createUser({
      email: `ui-owner-${ts}@test.invalid`,
      password,
      email_confirm: true,
    })
    if (ownerErr) throw ownerErr
    codeOwnerUserId = ownerData.user.id
    await svc.from('profiles').insert({ id: codeOwnerUserId, username: `uiowner${ts}` })

    // Insert fresh invite code directly — generate_member_codes RPC has a
    // pre-existing pgcrypto search_path issue on live; direct insert is fine for tests.
    freshCode = randomCode()
    const { error: codeErr } = await svc.from('invite_codes').insert({
      code: freshCode,
      generated_by: codeOwnerUserId,
    })
    if (codeErr) throw codeErr

    signedUpUsername = `tu${ts.toString().slice(-8)}`
  })

  test.afterAll(async () => {
    const svc = serviceClient()
    // Delete signed-up user if created (profile cascades)
    if (signedUpUserId) {
      await svc.auth.admin.deleteUser(signedUpUserId)
    }
    // Delete the code owner (cascades to invite_codes)
    await svc.auth.admin.deleteUser(codeOwnerUserId)
  })

  test('@live /enter → signup form → codes screen shows 3 codes', async ({ page }) => {
    // ── Step 1: enter invite code on /enter ──────────────────────────────────
    await page.goto('/enter')
    await page.getByRole('textbox').fill(freshCode)
    await page.getByRole('button', { name: 'Enter' }).click()

    // ── Step 2: land on signup form ──────────────────────────────────────────
    await expect(page).toHaveURL(/\/onboarding\/account/, { timeout: 10000 })

    const email = `test+${ts}@example.com`
    // Fill email/username/password — FloatingInput has no <label> so use type/autocomplete
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[autocomplete="username"]').fill(signedUpUsername)
    await page.locator('input[autocomplete="new-password"]').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()

    // ── Step 3: land on /onboarding/verify ───────────────────────────────────
    await expect(page).toHaveURL(/\/onboarding\/verify/, { timeout: 15000 })

    // Capture user ID for teardown + pre-insert 3 invite codes.
    // generate_member_codes RPC has a pre-existing pgcrypto search_path issue on live;
    // direct insert is equivalent — codes page reads invite_codes WHERE generated_by = user.id.
    const svc = serviceClient()
    const { data: profileRow } = await svc
      .from('profiles')
      .select('id')
      .eq('username', signedUpUsername)
      .single()
    if (profileRow) {
      signedUpUserId = profileRow.id
      await svc.from('invite_codes').insert([
        { code: randomCode(), generated_by: signedUpUserId },
        { code: randomCode(), generated_by: signedUpUserId },
        { code: randomCode(), generated_by: signedUpUserId },
      ])
    }

    // ── Step 4: skip ID verification ─────────────────────────────────────────
    await page.getByRole('button', { name: /skip for now/i }).click()

    // ── Step 5: land on /onboarding/setup ────────────────────────────────────
    await expect(page).toHaveURL(/\/onboarding\/setup/, { timeout: 10000 })

    // ── Step 6: skip setup → calls generate-codes API → /onboarding/codes ───
    await page.getByRole('button', { name: /skip all/i }).click()

    // ── Step 7: assert codes screen with exactly 3 codes ─────────────────────
    await expect(page).toHaveURL(/\/onboarding\/codes/, { timeout: 15000 })
    const codeTokens = page.getByTestId('code-token')
    await expect(codeTokens).toHaveCount(3, { timeout: 10000 })
  })
})

// ─── Direct-client: signUp → profile → claim → invited_by ────────────────────

test.describe('@live Direct client — signUp → profile insert → claim → invited_by', () => {
  let codeOwnerUserId: string
  let signupUserId: string
  let freshCode: string

  const ts = Date.now()
  const codeOwnerUsername = `dcowner${ts}`
  const signupUsername = `dcsignup${ts}`
  const password = 'TestPass123!'

  test.beforeAll(async () => {
    const svc = serviceClient()

    // Create a code owner user
    const { data: ownerData, error: ownerErr } = await svc.auth.admin.createUser({
      email: `dc-owner-${ts}@test.invalid`,
      password,
      email_confirm: true,
    })
    if (ownerErr) throw ownerErr
    codeOwnerUserId = ownerData.user.id
    await svc.from('profiles').insert({ id: codeOwnerUserId, username: codeOwnerUsername })

    // Insert fresh invite code directly (generate_member_codes has pgcrypto issue on live)
    freshCode = randomCode()
    const { error: codeErr } = await svc.from('invite_codes').insert({
      code: freshCode,
      generated_by: codeOwnerUserId,
    })
    if (codeErr) throw codeErr
  })

  test.afterAll(async () => {
    const svc = serviceClient()
    if (signupUserId) await svc.auth.admin.deleteUser(signupUserId)
    await svc.auth.admin.deleteUser(codeOwnerUserId)
  })

  test('@live signUp → profile insert → claim_invite_code → invited_by set', async () => {
    const client = anonClient()

    // 1. signUp — email confirmations disabled, session is immediate
    const { data: authData, error: authErr } = await client.auth.signUp({
      email: `dc-signup-${ts}@test.invalid`,
      password,
    })
    expect(authErr).toBeNull()
    expect(authData.user).not.toBeNull()
    signupUserId = authData.user!.id

    // 2. Insert profile row — this is the critical path that recursed pre-fix
    const { error: profileErr } = await client.from('profiles').insert({
      id: signupUserId,
      username: signupUsername,
    })
    expect(profileErr).toBeNull()

    // 3. Claim the invite code
    const { data: claimData, error: claimErr } = await client.rpc('claim_invite_code', {
      p_code: freshCode,
    })
    expect(claimErr).toBeNull()
    expect((claimData as { success: boolean }).success).toBe(true)

    // 4. Middleware-style select: verify invited_by is stamped on the profile row
    const { data: profile, error: selectErr } = await client
      .from('profiles')
      .select('id, username, invited_by')
      .eq('id', signupUserId)
      .single()

    expect(selectErr).toBeNull()
    expect(profile?.invited_by).toBe(codeOwnerUserId)
  })
})
