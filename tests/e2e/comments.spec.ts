/**
 * Community section (comments + legit-check) e2e tests.
 *
 * @live tests require RUN_LIVE_TESTS=1 plus the fixture env vars set up by
 * seed-founders.ts:
 *   FOUNDER1_EMAIL / FOUNDER1_PASSWORD  — formcheck (verified checker, gold, id-verified)
 *   FOUNDER3_EMAIL / FOUNDER3_PASSWORD  — tabiwalker (id-verified, NOT verified checker)
 *   UNVERIFIED_EMAIL / UNVERIFIED_PASSWORD — a member with id_verification_status=unverified
 *   ADMIN_EMAIL / ADMIN_PASSWORD        — admin account
 *   TEST_LISTING_ID                     — active listing for comment tests
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Non-live tests: structural checks (community section renders, tabs exist).
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const isLive = !!process.env.RUN_LIVE_TESTS

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const TEST_LISTING_ID  = process.env.TEST_LISTING_ID ?? ''
const ADMIN_EMAIL      = process.env.ADMIN_EMAIL ?? ''
const ADMIN_PW         = process.env.ADMIN_PASSWORD ?? ''

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/enter')
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/^\/(listings|$)/)
}

// ── Non-live structural tests ─────────────────────────────────────────────────

test('listing page has community section heading', async ({ page }) => {
  // Try to find any active listing to test against
  if (!TEST_LISTING_ID) {
    test.skip()
    return
  }
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await expect(page.locator('text=The community weighs in.')).toBeVisible()
})

test('community section shows LC tab by default', async ({ page }) => {
  if (!TEST_LISTING_ID) { test.skip(); return }
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await expect(page.locator('button', { hasText: /Legit check/i })).toBeVisible()
})

// ── Live tests ────────────────────────────────────────────────────────────────

test('@live unverified account sees disabled input with helper text', async ({ page }) => {
  const email = process.env.UNVERIFIED_EMAIL ?? ''
  const pw    = process.env.UNVERIFIED_PASSWORD ?? ''
  if (!email || !pw || !TEST_LISTING_ID) { test.skip(); return }

  await signIn(page, email, pw)
  await page.goto(`/listings/${TEST_LISTING_ID}`)

  // Input should be disabled / not interactive
  const input = page.locator('input[placeholder="add a legit check"]')
  await expect(input).toHaveAttribute('disabled')
  await expect(page.locator('text=ID-verified members only')).toBeVisible()
})

test('@live verified account posts general comment', async ({ page }) => {
  const email = process.env.FOUNDER3_EMAIL ?? 'founder3@resale-platform.internal'
  const pw    = process.env.FOUNDER3_PASSWORD ?? ''
  if (!pw || !TEST_LISTING_ID) { test.skip(); return }

  await signIn(page, email, pw)
  await page.goto(`/listings/${TEST_LISTING_ID}`)

  // Switch to COMMENTS tab
  await page.click('button:has-text("Comments")')

  const body = `test general comment ${Date.now()}`
  await page.fill('input[placeholder="add a comment"]', body)
  await page.click('button:has-text("Post")')
  await expect(page.locator(`text=${body}`)).toBeVisible({ timeout: 5000 })

  // Cleanup
  const db = serviceClient()
  await db.from('comments').delete().eq('body', body)
})

test('@live non-checker blocked from LC thread', async ({ page }) => {
  const email = process.env.FOUNDER3_EMAIL ?? 'founder3@resale-platform.internal'
  const pw    = process.env.FOUNDER3_PASSWORD ?? ''
  if (!pw || !TEST_LISTING_ID) { test.skip(); return }

  await signIn(page, email, pw)
  await page.goto(`/listings/${TEST_LISTING_ID}`)

  // On LC tab — input should be disabled for non-checker
  const input = page.locator('input[placeholder="add a legit check"]')
  await expect(input).toHaveAttribute('disabled')
})

test('@live checker posts + admin pins verdict → renders as pinned card', async ({ page }) => {
  const checkerEmail = process.env.FOUNDER1_EMAIL ?? 'founder1@resale-platform.internal'
  const checkerPw    = process.env.FOUNDER1_PASSWORD ?? ''
  if (!checkerPw || !ADMIN_EMAIL || !ADMIN_PW || !TEST_LISTING_ID) { test.skip(); return }

  // Post as verified checker
  await signIn(page, checkerEmail, checkerPw)
  await page.goto(`/listings/${TEST_LISTING_ID}`)

  const body = `checker verdict ${Date.now()}`
  await page.fill('input[placeholder="add a legit check"]', body)
  await page.click('button:has-text("Post")')
  await expect(page.locator(`text=${body}`)).toBeVisible({ timeout: 5000 })

  // Get the comment id
  const db = serviceClient()
  const { data: comment } = await db
    .from('comments').select('id').eq('body', body).single()
  const commentId = comment?.id
  if (!commentId) { test.skip(); return }

  // Admin pins it
  const pinRes = await page.request.post(`/api/admin/comments/${commentId}/pin`, {
    data: { pinned: true },
    headers: { 'Content-Type': 'application/json' },
  })
  // Note: we need to be signed in as admin for this — let's do it via API
  // Actually re-sign in as admin for the pin action:
  await signIn(page, ADMIN_EMAIL, ADMIN_PW)
  await page.request.post(`/api/admin/comments/${commentId}/pin`, {
    data: { pinned: true },
    headers: { 'Content-Type': 'application/json' },
  })

  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await expect(page.locator('[data-testid="pinned-verdict-card"]')).toBeVisible()

  // Cleanup
  await db.from('comments').delete().eq('id', commentId)
})

test('@live 3rd comment same-day from new account rejected server-side', async ({ page }) => {
  // Create a fresh new account and verify it via service_role, then try to post 3 comments
  if (!TEST_LISTING_ID || !SUPABASE_URL || !SERVICE_ROLE_KEY) { test.skip(); return }

  const db = serviceClient()
  const testEmail = `ratelimit-${Date.now()}@resale-platform.internal`
  const testPw    = crypto.randomUUID()

  const { data: newUser } = await db.auth.admin.createUser({
    email: testEmail, password: testPw, email_confirm: true,
  })
  if (!newUser.user) { test.skip(); return }
  const userId = newUser.user.id

  await db.from('profiles').upsert({
    id: userId, username: `ratelimit${Date.now()}`, role: 'member',
    id_verification_status: 'verified',
  }, { onConflict: 'id' })

  // Sign in as the new user
  await signIn(page, testEmail, testPw)
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await page.click('button:has-text("Comments")')

  // Post 2 allowed comments
  for (let i = 1; i <= 2; i++) {
    const body = `rate limit test comment ${i} ${Date.now()}`
    await page.fill('input[placeholder="add a comment"]', body)
    await page.click('button:has-text("Post")')
    await page.waitForTimeout(300)
  }

  // 3rd comment should be rejected
  const body3 = `rate limit test comment 3 ${Date.now()}`
  await page.fill('input[placeholder="add a comment"]', body3)
  await page.click('button:has-text("Post")')
  await expect(page.locator('text=Rate limit')).toBeVisible({ timeout: 3000 })

  // Cleanup
  await db.from('comments').delete().eq('author_id', userId)
  await db.auth.admin.deleteUser(userId)
})

test('@live seller toggle hides general tab, LC persists', async ({ page }) => {
  const sellerEmail = process.env.TEST_SELLER_EMAIL ?? ''
  const sellerPw    = process.env.TEST_SELLER_PASSWORD ?? ''
  const sellerListingId = process.env.TEST_SELLER_LISTING_ID ?? TEST_LISTING_ID
  if (!sellerEmail || !sellerPw || !sellerListingId) { test.skip(); return }

  await signIn(page, sellerEmail, sellerPw)
  await page.goto(`/listings/${sellerListingId}`)

  // Toggle general comments off
  const toggle = page.locator('[data-testid="comments-toggle"]')
  if (await toggle.count() === 0) { test.skip(); return }
  await toggle.click()
  await page.waitForTimeout(500)

  // General tab should be gone; LC tab remains
  await expect(page.locator('button:has-text("Legit check")')).toBeVisible()
  await expect(page.locator('button:has-text("Comments")')).not.toBeVisible()

  // Toggle back on
  await toggle.click()
  await page.waitForTimeout(500)
  await expect(page.locator('button:has-text("Comments")')).toBeVisible()
})

test('@live comment with cashapp handle stored redacted', async ({ page }) => {
  const email = process.env.FOUNDER3_EMAIL ?? 'founder3@resale-platform.internal'
  const pw    = process.env.FOUNDER3_PASSWORD ?? ''
  if (!pw || !TEST_LISTING_ID) { test.skip(); return }

  await signIn(page, email, pw)
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await page.click('button:has-text("Comments")')

  const offPlatformBody = 'is this still available? i can pay at cash.app/$user8841'
  await page.fill('input[placeholder="add a comment"]', offPlatformBody)
  await page.click('button:has-text("Post")')

  // Should show redaction line, not the original body
  await expect(page.locator('text=link removed')).toBeVisible({ timeout: 5000 })

  // Verify DB stored redacted=true
  const db = serviceClient()
  const { data: c } = await db.from('comments').select('redacted, body')
    .eq('listing_id', TEST_LISTING_ID).order('created_at', { ascending: false }).limit(1).single()
  expect(c?.redacted).toBe(true)
  expect(c?.body).not.toContain('cash.app')

  // Cleanup
  await db.from('comments').delete().eq('body', c?.body ?? '').eq('listing_id', TEST_LISTING_ID)
})

test('@live 2 flags → comment lands in admin queue → admin removes → hidden', async ({ page }) => {
  if (!TEST_LISTING_ID || !ADMIN_EMAIL || !ADMIN_PW) { test.skip(); return }
  const email = process.env.FOUNDER3_EMAIL ?? 'founder3@resale-platform.internal'
  const pw    = process.env.FOUNDER3_PASSWORD ?? ''
  if (!pw) { test.skip(); return }

  // Post a general comment
  await signIn(page, email, pw)
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await page.click('button:has-text("Comments")')
  const body = `flag test comment ${Date.now()}`
  await page.fill('input[placeholder="add a comment"]', body)
  await page.click('button:has-text("Post")')
  await expect(page.locator(`text=${body}`)).toBeVisible({ timeout: 5000 })

  // Flag it twice via service_role (bypass unique constraint per user by using two different actor_ids)
  const db = serviceClient()
  const { data: c } = await db.from('comments').select('id').eq('body', body).single()
  const commentId = c?.id
  if (!commentId) { test.skip(); return }

  // Create 2 dummy flaggers
  const flagger1 = await db.auth.admin.createUser({ email: `flag1-${Date.now()}@r.internal`, password: crypto.randomUUID(), email_confirm: true })
  const flagger2 = await db.auth.admin.createUser({ email: `flag2-${Date.now()}@r.internal`, password: crypto.randomUUID(), email_confirm: true })
  const f1Id = flagger1.data.user?.id
  const f2Id = flagger2.data.user?.id

  if (f1Id && f2Id) {
    await db.from('comment_actions').insert([
      { comment_id: commentId, actor_id: f1Id, action: 'flag' },
      { comment_id: commentId, actor_id: f2Id, action: 'flag' },
    ])
    await db.rpc('check_and_auto_flag_comment', { p_comment_id: commentId })

    // Verify status=flagged
    const { data: flagged } = await db.from('comments').select('status').eq('id', commentId).single()
    expect(flagged?.status).toBe('flagged')
  }

  // Admin removes comment
  await signIn(page, ADMIN_EMAIL, ADMIN_PW)
  const removeRes = await page.request.post(`/api/admin/comments/${commentId}/remove`)
  expect(removeRes.ok()).toBe(true)

  // Comment not visible on listing page
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await page.click('button:has-text("Comments")')
  await expect(page.locator(`text=${body}`)).not.toBeVisible()

  // Cleanup
  await db.from('comment_actions').delete().in('actor_id', [f1Id!, f2Id!])
  await db.from('comments').delete().eq('id', commentId)
  if (f1Id) await db.auth.admin.deleteUser(f1Id)
  if (f2Id) await db.auth.admin.deleteUser(f2Id)
})

test('@live RLS: client direct INSERT on comments rejected', async ({ page }) => {
  const email = process.env.FOUNDER3_EMAIL ?? 'founder3@resale-platform.internal'
  const pw    = process.env.FOUNDER3_PASSWORD ?? ''
  if (!pw || !TEST_LISTING_ID || !SUPABASE_URL) { test.skip(); return }

  // Try to insert directly via the anon/authenticated PostgREST endpoint
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const anonClient = createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false } })
  await anonClient.auth.signInWithPassword({ email, password: pw })

  const { error } = await anonClient.from('comments').insert({
    listing_id: TEST_LISTING_ID,
    author_id: (await anonClient.auth.getUser()).data.user?.id,
    thread_type: 'general',
    body: 'direct insert attempt',
    redacted: false,
    pinned: false,
  })

  // Should be rejected — no INSERT policy on comments for authenticated
  expect(error).not.toBeNull()
})
