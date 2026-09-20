/**
 * Community section (Legit Check) e2e tests — G10.
 *
 * General comments were removed. LC posting is moderators-only; auto-auth system verdicts
 * arrive as source='auto'. @live tests require RUN_LIVE_TESTS=1 plus fixture env vars from
 * seed-founders.ts:
 *   MODERATOR_EMAIL / MODERATOR_PASSWORD      — a moderator, id-verified
 *     (falls back to FOUNDER1_* — the ex-"verified checker" seeded as a moderator by 0036)
 *   NONMOD_EMAIL / NONMOD_PASSWORD            — id-verified member who is NOT a moderator
 *     (falls back to FOUNDER3_*)
 *   ADMIN_EMAIL / ADMIN_PASSWORD              — admin account
 *   TEST_LISTING_ID                           — an active listing
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Non-live tests: structural checks only.
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const TEST_LISTING_ID  = process.env.TEST_LISTING_ID ?? ''
const ADMIN_EMAIL      = process.env.ADMIN_EMAIL ?? ''
const ADMIN_PW         = process.env.ADMIN_PASSWORD ?? ''
const MOD_EMAIL        = process.env.MODERATOR_EMAIL ?? process.env.FOUNDER1_EMAIL ?? 'founder1@resale-platform.internal'
const MOD_PW           = process.env.MODERATOR_PASSWORD ?? process.env.FOUNDER1_PASSWORD ?? ''
const NONMOD_EMAIL     = process.env.NONMOD_EMAIL ?? process.env.FOUNDER3_EMAIL ?? 'founder3@resale-platform.internal'
const NONMOD_PW        = process.env.NONMOD_PASSWORD ?? process.env.FOUNDER3_PASSWORD ?? ''

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
  if (!TEST_LISTING_ID) { test.skip(); return }
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await expect(page.getByRole('heading', { name: 'Legit check' })).toBeVisible()
})

test('community section shows the Legit Check strip and input (general comments removed)', async ({ page }) => {
  if (!TEST_LISTING_ID) { test.skip(); return }
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  // The tally is type in the head: "n legit · n flagged". The vote buttons still read LEGIT / FLAG.
  const section = page.locator('#lc-thread')
  await expect(section).toContainText(/\d+ legit/)
  await expect(section).toContainText(/\d+ flagged/)
  await expect(page.getByTestId('lc-input')).toBeVisible()
  // General comments are gone — no "Comments" tab.
  await expect(page.locator('button:has-text("Comments")')).toHaveCount(0)
})

// ── Live tests ────────────────────────────────────────────────────────────────

test('@live non-moderator sees a disabled LC input with the moderator helper text', async ({ page }) => {
  if (!NONMOD_PW || !TEST_LISTING_ID) { test.skip(); return }
  await signIn(page, NONMOD_EMAIL, NONMOD_PW)
  await page.goto(`/listings/${TEST_LISTING_ID}`)

  const input = page.locator('input[placeholder="add a legit check"]')
  // Disabled for non-moderators: the enabled <input> is replaced by a static div.
  await expect(input).toHaveCount(0)
  await expect(page.locator('text=posted by verified moderators')).toBeVisible()
})

test('@live moderator posts a legit check', async ({ page }) => {
  if (!MOD_PW || !TEST_LISTING_ID) { test.skip(); return }
  await signIn(page, MOD_EMAIL, MOD_PW)
  await page.goto(`/listings/${TEST_LISTING_ID}`)

  const body = `mod legit check ${Date.now()}`
  await page.fill('input[placeholder="add a legit check"]', body)
  await page.click('button:has-text("Post")')
  await expect(page.locator(`text=${body}`)).toBeVisible({ timeout: 5000 })

  const db = serviceClient()
  await db.from('comments').delete().eq('body', body)
})

test('@live moderator posts + admin pins verdict → renders as pinned card', async ({ page }) => {
  if (!MOD_PW || !ADMIN_EMAIL || !ADMIN_PW || !TEST_LISTING_ID) { test.skip(); return }

  await signIn(page, MOD_EMAIL, MOD_PW)
  await page.goto(`/listings/${TEST_LISTING_ID}`)

  const body = `mod verdict ${Date.now()}`
  await page.fill('input[placeholder="add a legit check"]', body)
  await page.click('button:has-text("Post")')
  await expect(page.locator(`text=${body}`)).toBeVisible({ timeout: 5000 })

  const db = serviceClient()
  const { data: comment } = await db.from('comments').select('id').eq('body', body).single()
  const commentId = comment?.id
  if (!commentId) { test.skip(); return }

  await signIn(page, ADMIN_EMAIL, ADMIN_PW)
  await page.request.post(`/api/admin/comments/${commentId}/pin`, {
    data: { pinned: true },
    headers: { 'Content-Type': 'application/json' },
  })

  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await expect(page.locator('[data-testid="pinned-verdict-card"]')).toBeVisible()

  await db.from('comments').delete().eq('id', commentId)
})

test('@live moderator LC comment with cashapp handle stored redacted', async ({ page }) => {
  if (!MOD_PW || !TEST_LISTING_ID) { test.skip(); return }
  await signIn(page, MOD_EMAIL, MOD_PW)
  await page.goto(`/listings/${TEST_LISTING_ID}`)

  const offPlatformBody = 'legit, but dont pay at cash.app/$user8841'
  await page.fill('input[placeholder="add a legit check"]', offPlatformBody)
  await page.click('button:has-text("Post")')
  await expect(page.locator('text=link removed')).toBeVisible({ timeout: 5000 })

  const db = serviceClient()
  const { data: c } = await db.from('comments').select('redacted, body')
    .eq('listing_id', TEST_LISTING_ID).order('created_at', { ascending: false }).limit(1).single()
  expect(c?.redacted).toBe(true)
  expect(c?.body).not.toContain('cash.app')

  await db.from('comments').delete().eq('body', c?.body ?? '').eq('listing_id', TEST_LISTING_ID)
})

test('@live RLS: client direct INSERT on comments rejected', async () => {
  if (!MOD_PW || !TEST_LISTING_ID || !SUPABASE_URL) { test.skip(); return }

  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
  const anonClient = createClient(SUPABASE_URL, anonKey, { auth: { persistSession: false } })
  await anonClient.auth.signInWithPassword({ email: MOD_EMAIL, password: MOD_PW })

  const { error } = await anonClient.from('comments').insert({
    listing_id: TEST_LISTING_ID,
    author_id: (await anonClient.auth.getUser()).data.user?.id,
    thread_type: 'lc',
    body: 'direct insert attempt',
    redacted: false,
    pinned: false,
  })

  // No INSERT policy on comments for authenticated — post_comment() RPC is the only path.
  expect(error).not.toBeNull()
})

test('@live 2 flags → comment flagged → admin removes → hidden', async ({ page }) => {
  if (!TEST_LISTING_ID || !ADMIN_EMAIL || !ADMIN_PW || !MOD_PW) { test.skip(); return }

  await signIn(page, MOD_EMAIL, MOD_PW)
  await page.goto(`/listings/${TEST_LISTING_ID}`)
  const body = `flag test lc ${Date.now()}`
  await page.fill('input[placeholder="add a legit check"]', body)
  await page.click('button:has-text("Post")')
  await expect(page.locator(`text=${body}`)).toBeVisible({ timeout: 5000 })

  const db = serviceClient()
  const { data: c } = await db.from('comments').select('id').eq('body', body).single()
  const commentId = c?.id
  if (!commentId) { test.skip(); return }

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
    const { data: flagged } = await db.from('comments').select('status').eq('id', commentId).single()
    expect(flagged?.status).toBe('flagged')
  }

  await signIn(page, ADMIN_EMAIL, ADMIN_PW)
  const removeRes = await page.request.post(`/api/admin/comments/${commentId}/remove`)
  expect(removeRes.ok()).toBe(true)

  await page.goto(`/listings/${TEST_LISTING_ID}`)
  await expect(page.locator(`text=${body}`)).not.toBeVisible()

  await db.from('comment_actions').delete().in('actor_id', [f1Id!, f2Id!])
  await db.from('comments').delete().eq('id', commentId)
  if (f1Id) await db.auth.admin.deleteUser(f1Id)
  if (f2Id) await db.auth.admin.deleteUser(f2Id)
})
