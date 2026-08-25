import { test, expect } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

/**
 * HF1 regression + open-signup flow (G13: invite codes removed — signup is open).
 * Proves the recursive RLS fix is working end-to-end.
 * @live — requires real Supabase credentials + running app.
 * CI skips @live. Run locally with:
 *   pnpm playwright test signup-live.spec.ts --grep @live
 */

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } })
}

function anonClient() {
  return createClient(SUPABASE_URL, ANON_KEY)
}

// ─── UI E2E: full open signup → onboarding → browse ──────────────────────────

test.describe('@live Signup UI — full onboarding flow', () => {
  let signedUpUsername: string
  let signedUpUserId: string | null = null

  const ts = Date.now()
  const password = 'TestPass123!'

  test.beforeAll(() => {
    signedUpUsername = `tu${ts.toString().slice(-8)}`
  })

  test.afterAll(async () => {
    const svc = serviceClient()
    // Delete signed-up user if created (profile cascades)
    if (signedUpUserId) {
      await svc.auth.admin.deleteUser(signedUpUserId)
    }
  })

  test('@live /enter → signup form → onboarding → browse', async ({ page }) => {
    // ── Step 1: landing → create account ─────────────────────────────────────
    await page.goto('/enter')
    await page.getByRole('link', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/onboarding\/account$/, { timeout: 10000 })

    // ── Step 2: fill the signup form ─────────────────────────────────────────
    const email = `test+${ts}@example.com`
    // Fill email/username/password — FloatingInput has no <label> so use type/autocomplete
    await page.locator('input[type="email"]').fill(email)
    await page.locator('input[autocomplete="username"]').fill(signedUpUsername)
    await page.locator('input[autocomplete="new-password"]').fill(password)
    await page.getByRole('button', { name: 'Create account' }).click()

    // ── Step 3: land on /onboarding/verify ───────────────────────────────────
    await expect(page).toHaveURL(/\/onboarding\/verify/, { timeout: 15000 })

    // Capture user ID for teardown
    const svc = serviceClient()
    const { data: profileRow } = await svc
      .from('profiles')
      .select('id')
      .eq('username', signedUpUsername)
      .single()
    // Assert rather than guard: a null here means signup did NOT create the profile row,
    // which is the exact regression this spec exists to catch. Silently skipping left the
    // test green AND orphaned a real auth user in the live project on every run, because
    // afterAll then had no id to delete and the username is timestamp-derived (never retried).
    expect(profileRow, 'signup did not create a profile row').not.toBeNull()
    signedUpUserId = profileRow!.id

    // ── Step 4: skip ID verification ─────────────────────────────────────────
    await page.getByRole('button', { name: /skip for now/i }).click()

    // ── Step 5: land on /onboarding/setup ────────────────────────────────────
    await expect(page).toHaveURL(/\/onboarding\/setup/, { timeout: 10000 })

    // ── Step 6: skip setup → straight into the shop (G13: no codes screen) ───
    await page.getByRole('button', { name: /skip all/i }).click()
    await expect(page).toHaveURL(/\/browse/, { timeout: 15000 })
  })
})

// ─── Direct-client: signUp → profile insert (HF1 recursion regression) ───────

test.describe('@live Direct client — signUp → profile insert', () => {
  let signupUserId: string

  const ts = Date.now()
  const signupUsername = `dcsignup${ts}`
  const password = 'TestPass123!'

  test.afterAll(async () => {
    const svc = serviceClient()
    if (signupUserId) await svc.auth.admin.deleteUser(signupUserId)
  })

  test('@live signUp → profile insert → middleware-style select', async () => {
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

    // 3. Middleware-style select: profile row is readable by its owner
    const { data: profile, error: selectErr } = await client
      .from('profiles')
      .select('id, username, role')
      .eq('id', signupUserId)
      .single()

    expect(selectErr).toBeNull()
    expect(profile?.username).toBe(signupUsername)
  })
})
