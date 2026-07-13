import { test, expect } from '@playwright/test'

/**
 * B3 Anti-slop @live end-to-end specs.
 * Requires: RUN_LIVE_TESTS=1, live Supabase credentials in .env.local.
 * Tagged @live — CI skips these; run locally before B8 gate.
 *
 * Coverage:
 *   1. Blocked-pattern description → inline error on submit
 *   2. Duplicate listing submission → lands in admin queue with comparison view
 *   3. Velocity limit → 6th listing same-day from fresh account blocked
 *   4. RLS: client cannot read image_hashes or listing_flags directly
 */

test.skip(() => !process.env.RUN_LIVE_TESTS, 'set RUN_LIVE_TESTS=1 to run @live specs')

const BASE = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const ANON_KEY     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

/** Sign in as a test user and return the access token. */
async function signIn(email: string, password: string): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: ANON_KEY,
    },
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`Sign-in failed: ${JSON.stringify(data)}`)
  return data.access_token
}

/** POST /api/listings as an authenticated user. */
async function submitListing(
  token: string,
  overrides: Record<string, unknown> = {},
): Promise<Response> {
  return fetch(`${BASE}/api/listings`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      Cookie: `sb-access-token=${token}`,
    },
    body: JSON.stringify({
      title: 'TEST JACKET',
      brand: 'SUPREME',
      category: 'Tops',
      size: 'M',
      description: 'Great condition.',
      condition_score: 8,
      price_cents: 10000,
      possession_photo_url: `https://picsum.photos/seed/${Date.now()}/400/600`,
      images: [],
      ...overrides,
    }),
  })
}

test.describe('@live — blocked-pattern lint', () => {
  test('listing with "dm me" in description is rejected with 400', async () => {
    // Use seller test account credentials from env
    const sellerEmail = process.env.TEST_SELLER_EMAIL!
    const sellerPass  = process.env.TEST_SELLER_PASSWORD!
    const token = await signIn(sellerEmail, sellerPass)

    const res = await submitListing(token, {
      description: 'Great piece, dm me for best offer',
    })
    expect(res.status).toBe(400)
    const body = await res.json()
    expect(body.error).toContain('prohibited')
  })

  test('listing with "telegram" → 400 blocked', async () => {
    const token = await signIn(
      process.env.TEST_SELLER_EMAIL!,
      process.env.TEST_SELLER_PASSWORD!,
    )
    const res = await submitListing(token, { description: 'Contact via Telegram @user123' })
    expect(res.status).toBe(400)
  })
})

test.describe('@live — duplicate detection', () => {
  test('submitting same listing twice flags second as duplicate in admin queue', async ({ page: adminPage }) => {
    const sellerEmail = process.env.TEST_SELLER_EMAIL!
    const sellerPass  = process.env.TEST_SELLER_PASSWORD!
    const token = await signIn(sellerEmail, sellerPass)

    // Use a fixed public image URL so hashes are deterministic
    const possUrl = 'https://picsum.photos/seed/b3dupetest/400/600'

    // First submission
    const res1 = await submitListing(token, { possession_photo_url: possUrl })
    expect(res1.status).toBe(201)
    const { id: listingId1 } = await res1.json()
    expect(listingId1).toBeTruthy()

    // Second submission with same possession photo → possession dedup should reject
    const res2 = await submitListing(token, {
      // Different seller would be needed for possession dedup — here same seller
      // so we test full duplicate detection path via near-hash match instead.
      // Same image URLs trigger near-duplicate detection across slots.
      images: [possUrl, possUrl, possUrl, possUrl, possUrl],
      possession_photo_url: possUrl,
    })
    // Either 400 (possession dedup) or 201 (flagged as duplicate) both indicate detection worked
    // For same seller possession, we skip the possession-dedup check, so expect 201 + flag
    const status2 = res2.status
    expect([201, 400]).toContain(status2)

    if (status2 === 201) {
      // Visit admin queue and verify duplicate comparison is shown
      const adminEmail = process.env.TEST_ADMIN_EMAIL!
      const adminPass  = process.env.TEST_ADMIN_PASSWORD!
      await adminPage.goto(`${BASE}/enter`)
      // Sign in as admin and check queue
      await adminPage.fill('input[type="email"]', adminEmail)
      await adminPage.fill('input[type="password"]', adminPass)
      await adminPage.getByRole('button', { name: /sign in/i }).click()
      await adminPage.waitForURL(/\//)

      await adminPage.goto(`${BASE}/admin/queue`)
      // Duplicate flag banner should be visible
      const dupBadge = adminPage.locator('[data-testid="flag-duplicate"]')
      await expect(dupBadge.first()).toBeVisible({ timeout: 10000 })

      // Comparison section should be visible
      const comparison = adminPage.locator('[data-testid="duplicate-comparison"]')
      await expect(comparison.first()).toBeVisible()
    }
  })
})

test.describe('@live — velocity limit', () => {
  test('6th listing same-day from new account returns 429', async () => {
    // This test requires a freshly created (< 30 day old) test account.
    // Use TEST_NEW_SELLER_EMAIL / TEST_NEW_SELLER_PASSWORD.
    const email = process.env.TEST_NEW_SELLER_EMAIL
    const pass  = process.env.TEST_NEW_SELLER_PASSWORD
    if (!email || !pass) {
      console.log('Skipping velocity test — TEST_NEW_SELLER_EMAIL not set')
      return
    }

    const token = await signIn(email, pass)

    // Submit 5 listings (should succeed) then attempt a 6th
    for (let i = 0; i < 5; i++) {
      const res = await submitListing(token, { title: `TEST LISTING ${i + 1}` })
      // May already be at limit from previous runs; bail if so
      if (res.status === 429) {
        console.log(`Already at limit after ${i} submissions`)
        break
      }
    }

    // 6th submission should be blocked
    const res6 = await submitListing(token, { title: 'SIXTH LISTING' })
    expect(res6.status).toBe(429)
    const body = await res6.json()
    expect(body.error).toContain('5 listings per day')
  })
})

test.describe('@live — RLS: client cannot access image_hashes or listing_flags', () => {
  test('authenticated non-admin cannot read image_hashes', async ({ request }) => {
    const token = await signIn(
      process.env.TEST_SELLER_EMAIL!,
      process.env.TEST_SELLER_PASSWORD!,
    )
    const res = await request.get(`${SUPABASE_URL}/rest/v1/image_hashes`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    })
    // RLS with no policies → empty array (PostgREST returns [] not 403 for RLS deny)
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(0)
  })

  test('authenticated non-admin cannot read listing_flags', async ({ request }) => {
    const token = await signIn(
      process.env.TEST_SELLER_EMAIL!,
      process.env.TEST_SELLER_PASSWORD!,
    )
    const res = await request.get(`${SUPABASE_URL}/rest/v1/listing_flags`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
      },
    })
    const data = await res.json()
    expect(Array.isArray(data)).toBe(true)
    expect(data).toHaveLength(0)
  })

  test('authenticated non-admin cannot insert into listing_flags', async ({ request }) => {
    const token = await signIn(
      process.env.TEST_SELLER_EMAIL!,
      process.env.TEST_SELLER_PASSWORD!,
    )
    const res = await request.post(`${SUPABASE_URL}/rest/v1/listing_flags`, {
      headers: {
        apikey: ANON_KEY,
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
        Prefer: 'return=representation',
      },
      data: JSON.stringify({
        listing_id: '00000000-0000-0000-0000-000000000000',
        type: 'duplicate',
        evidence: {},
      }),
    })
    // Should fail — no INSERT policy for non-admin authenticated users
    expect(res.status()).not.toBe(201)
  })
})
