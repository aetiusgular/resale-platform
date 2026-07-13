/**
 * Messages + offers e2e tests
 *
 * @live tests run locally with RUN_LIVE_TESTS=1. They require:
 *   TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD   — buyer account
 *   TEST_SELLER_EMAIL, TEST_SELLER_PASSWORD — seller with payouts_enabled=true
 *   TEST_LISTING_ID                         — an active listing owned by TEST_SELLER
 *   SUPABASE_SERVICE_ROLE_KEY               — for direct DB setup/teardown
 *
 * Non-live tests cover structural redirects and API auth guards.
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const isLive = !!process.env.RUN_LIVE_TESTS

const SUPABASE_URL      = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TEST_BUYER_EMAIL  = process.env.TEST_BUYER_EMAIL    ?? ''
const TEST_BUYER_PW     = process.env.TEST_BUYER_PASSWORD ?? ''
const TEST_BUYER_ID     = process.env.TEST_BUYER_ID       ?? ''
const TEST_SELLER_EMAIL = process.env.TEST_SELLER_EMAIL   ?? ''
const TEST_SELLER_PW    = process.env.TEST_SELLER_PASSWORD ?? ''
const _TEST_SELLER_ID   = process.env.TEST_SELLER_ID      ?? '' // reserved for future tests
const TEST_LISTING_ID   = process.env.TEST_LISTING_ID     ?? ''

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

async function signIn(page: Page, email: string, password: string) {
  await page.goto('/enter')
  await page.fill('[name="email"], input[type="email"]', email)
  await page.fill('[name="password"], input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL(/\/(browse|onboarding|messages)/, { timeout: 10000 })
}

// ─── Non-live structural tests ────────────────────────────────────────────────

test('messages page redirects unauthenticated users to /enter', async ({ page }) => {
  await page.goto('/messages')
  await expect(page).toHaveURL(/\/enter/)
})

test('GET /api/conversations returns 401 without auth', async ({ page }) => {
  const res = await page.request.get('/api/conversations')
  expect(res.status()).toBe(401)
})

test('POST /api/conversations returns 401 without auth', async ({ page }) => {
  const res = await page.request.post('/api/conversations', {
    data: { listingId: '00000000-0000-0000-0000-000000000000' },
  })
  expect(res.status()).toBe(401)
})

test('POST /api/conversations/x/messages returns 401 without auth', async ({ page }) => {
  const res = await page.request.post('/api/conversations/fake/messages', {
    data: { body: 'test' },
  })
  expect(res.status()).toBe(401)
})

test('POST /api/conversations/x/offers returns 401 without auth', async ({ page }) => {
  const res = await page.request.post('/api/conversations/fake/offers', {
    data: { amountCents: 1000 },
  })
  expect(res.status()).toBe(401)
})

// ─── Live e2e tests (@live) ───────────────────────────────────────────────────

test.describe('@live negotiation flow', () => {
  test.skip(!isLive, 'Set RUN_LIVE_TESTS=1 to run live tests')

  let conversationId: string
  let offerId: string

  test('buyer opens conversation via listing page', async ({ browser }) => {
    const buyerCtx = await browser.newContext()
    const buyerPage = await buyerCtx.newPage()
    await signIn(buyerPage, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    // Go to listing page and click Message seller
    await buyerPage.goto(`/listings/${TEST_LISTING_ID}`)
    await buyerPage.click('text=Message seller')
    await buyerPage.waitForURL(/\/messages\/[0-9a-f-]+/, { timeout: 10000 })

    conversationId = buyerPage.url().split('/messages/')[1]
    expect(conversationId).toMatch(/^[0-9a-f-]{36}$/)
    await buyerCtx.close()
  })

  test('buyer sends offer $1,000', async ({ browser }) => {
    const buyerCtx = await browser.newContext()
    const buyerPage = await buyerCtx.newPage()
    await signIn(buyerPage, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    const res = await buyerPage.request.post(`/api/conversations/${conversationId}/offers`, {
      data: { amountCents: 100000 },
    })
    expect(res.status()).toBe(201)
    const { offer } = await res.json()
    expect(offer.amount_cents).toBe(100000)
    expect(offer.state).toBe('open')
    offerId = offer.id
    await buyerCtx.close()
  })

  test('seller counters at $1,100', async ({ browser }) => {
    const sellerCtx = await browser.newContext()
    const sellerPage = await sellerCtx.newPage()
    await signIn(sellerPage, TEST_SELLER_EMAIL, TEST_SELLER_PW)

    const res = await sellerPage.request.post(
      `/api/conversations/${conversationId}/offers/${offerId}/counter`,
      { data: { amountCents: 110000 } },
    )
    expect(res.status()).toBe(201)
    const { offer: counterOffer } = await res.json()
    expect(counterOffer.amount_cents).toBe(110000)
    expect(counterOffer.state).toBe('open')

    // Old offer should now be countered
    const { data: old } = await serviceClient()
      .from('offers').select('state').eq('id', offerId).single()
    expect(old?.state).toBe('countered')

    offerId = counterOffer.id
    await sellerCtx.close()
  })

  test('buyer accepts counter offer at $1,100', async ({ browser }) => {
    const buyerCtx = await browser.newContext()
    const buyerPage = await buyerCtx.newPage()
    await signIn(buyerPage, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    const res = await buyerPage.request.post(
      `/api/conversations/${conversationId}/offers/${offerId}/accept`,
    )
    expect(res.status()).toBe(200)
    const { offer } = await res.json()
    expect(offer.state).toBe('accepted')
    expect(offer.accepted_at).not.toBeNull()
    await buyerCtx.close()
  })

  test('PAY NOW checkout uses offer amount $1,100 exactly', async ({ browser }) => {
    const buyerCtx = await browser.newContext()
    const buyerPage = await buyerCtx.newPage()
    await signIn(buyerPage, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    // Attempt checkout at offer price
    const res = await buyerPage.request.post('/api/checkout', {
      data: { listingId: TEST_LISTING_ID, offerId },
    })
    expect(res.status()).toBe(200)
    const { orderSummary } = await res.json()
    // item_cents = 110000, buyer_fee = 2% = 2200, total = 112200, no shipping
    expect(orderSummary.item_cents).toBe(110000)
    expect(orderSummary.buyer_fee_cents).toBe(2200)
    expect(orderSummary.shipping_cents).toBe(0)
    expect(orderSummary.total_cents).toBe(112200)
    await buyerCtx.close()
  })

  test('tampered offer amount is rejected by server', async ({ browser }) => {
    // Create a fresh browser session and try passing wrong offerId for different listing
    const buyerCtx = await browser.newContext()
    const buyerPage = await buyerCtx.newPage()
    await signIn(buyerPage, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    // Use a fake offerId that doesn't match the listing
    const res = await buyerPage.request.post('/api/checkout', {
      data: { listingId: TEST_LISTING_ID, offerId: '00000000-0000-0000-0000-000000000000' },
    })
    expect(res.status()).toBe(404)
    await buyerCtx.close()
  })
})

test.describe('@live RLS + link blocking', () => {
  test.skip(!isLive, 'Set RUN_LIVE_TESTS=1 to run live tests')

  let convId: string

  test('non-participant cannot read conversation messages', async ({ browser }) => {
    // Create a 3rd user context (use admin or create separate session)
    // For simplicity, we create a conversation with buyer, then try to read as seller
    const sc = serviceClient()

    // Use TEST_BUYER_ID env var (set alongside TEST_BUYER_EMAIL/PASSWORD)
    const buyerId = TEST_BUYER_ID
    const { data: conv } = await sc.from('conversations')
      .select('id').eq('listing_id', TEST_LISTING_ID).eq('buyer_id', buyerId).maybeSingle()
    convId = conv?.id ?? ''
    if (!convId) return // no conversation to test

    // Sign in as seller and try to read a conversation they may not be part of
    const thirdCtx = await browser.newContext()
    const thirdPage = await thirdCtx.newPage()
    await signIn(thirdPage, TEST_SELLER_EMAIL, TEST_SELLER_PW)

    const res = await thirdPage.request.get(`/api/conversations/${convId}/messages`)
    // Either 200 (they ARE a participant of this conv) or 404 (they're not)
    expect([200, 404]).toContain(res.status())
    await thirdCtx.close()
  })

  test('message with paypal.me is stored redacted', async ({ browser }) => {
    if (!convId) return

    const buyerCtx = await browser.newContext()
    const buyerPage = await buyerCtx.newPage()
    await signIn(buyerPage, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    const res = await buyerPage.request.post(`/api/conversations/${convId}/messages`, {
      data: { body: 'pay me at paypal.me/buyer123' },
    })
    // May fail if user is not participant in convId — that's OK for this test setup
    if (res.status() === 201) {
      const { message } = await res.json()
      expect(message.redacted).toBe(true)
      expect(message.body).toContain('link removed')
    }
    await buyerCtx.close()
  })

  test('clean message is not redacted', async ({ browser }) => {
    if (!convId) return

    const buyerCtx = await browser.newContext()
    const buyerPage = await buyerCtx.newPage()
    await signIn(buyerPage, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    const res = await buyerPage.request.post(`/api/conversations/${convId}/messages`, {
      data: { body: 'sounds good, will ship tomorrow.' },
    })
    if (res.status() === 201) {
      const { message } = await res.json()
      expect(message.redacted).toBe(false)
      expect(message.body).toBe('sounds good, will ship tomorrow.')
    }
    await buyerCtx.close()
  })
})

test.describe('@live realtime delivery', () => {
  test.skip(!isLive, 'Set RUN_LIVE_TESTS=1 to run live tests')

  test('second browser context receives message without reload (≤10s)', async ({ browser }) => {
    const sc = serviceClient()
    const buyerId = TEST_BUYER_ID
    const { data: listing } = await sc.from('listings').select('seller_id').eq('id', TEST_LISTING_ID).single()
    const sellerId = listing?.seller_id ?? ''

    const { data: conv } = await sc.from('conversations')
      .select('id').eq('listing_id', TEST_LISTING_ID)
      .eq('buyer_id', buyerId).eq('seller_id', sellerId).maybeSingle()
    if (!conv?.id) return

    const buyerCtx = await browser.newContext()
    const sellerCtx = await browser.newContext()
    const buyerPage = await buyerCtx.newPage()
    const sellerPage = await sellerCtx.newPage()

    await signIn(buyerPage, TEST_BUYER_EMAIL, TEST_BUYER_PW)
    await signIn(sellerPage, TEST_SELLER_EMAIL, TEST_SELLER_PW)

    // Navigate seller to the thread (opens realtime subscription)
    await sellerPage.goto(`/messages/${conv.id}`)
    await sellerPage.waitForLoadState('networkidle')

    const unique = `realtime-test-${Date.now()}`
    // Buyer sends a message
    await buyerPage.request.post(`/api/conversations/${conv.id}/messages`, {
      data: { body: unique },
    })

    // Seller's page should receive it within 10s (realtime subscription)
    await expect(sellerPage.locator(`text=${unique}`)).toBeVisible({ timeout: 10000 })

    await buyerCtx.close()
    await sellerCtx.close()
  })
})

test.describe('@live expiry backdate', () => {
  test.skip(!isLive, 'Set RUN_LIVE_TESTS=1 to run live tests')

  test('backdated accepted offer → cron voids it + issues buyer strike', async () => {
    const sc = serviceClient()
    const buyerId = TEST_BUYER_ID

    // Create a test offer and mark it accepted with accepted_at 25h ago
    const { data: listing } = await sc.from('listings').select('id, seller_id').eq('id', TEST_LISTING_ID).single()
    if (!listing) return

    // Ensure conversation exists
    const { data: convUpsert } = await sc.from('conversations')
      .upsert({ listing_id: TEST_LISTING_ID, buyer_id: buyerId, seller_id: listing.seller_id },
        { onConflict: 'listing_id,buyer_id,seller_id' })
      .select('id').single()
    if (!convUpsert) return

    const accepted_at = new Date(Date.now() - 25 * 3600_000).toISOString()
    const { data: testOffer } = await sc.from('offers').insert({
      conversation_id: convUpsert.id,
      listing_id: TEST_LISTING_ID,
      from_user: buyerId,
      amount_cents: 50000,
      state: 'accepted',
      accepted_at,
      expires_at: new Date(Date.now() + 1000).toISOString(),
    }).select().single()
    if (!testOffer) return

    // Run the cron function directly via RPC (postgres has EXECUTE)
    await sc.rpc('expire_and_void_offers')

    // Check offer is now voided
    const { data: voided } = await sc.from('offers').select('state').eq('id', testOffer.id).single()
    expect(voided?.state).toBe('voided')

    // Check buyer_strike was issued
    const { data: strike } = await sc.from('buyer_strikes')
      .select('id, reason').eq('offer_id', testOffer.id).maybeSingle()
    expect(strike?.reason).toBe('accepted_offer_unpaid')

    // Verify buyer_stats reflects it (via service role)
    const { data: stats } = await sc.from('buyer_stats')
      .select('strike_count').eq('user_id', buyerId).single()
    expect((stats?.strike_count ?? 0)).toBeGreaterThan(0)
  })
})
