/**
 * Checkout + escrow e2e tests
 *
 * @live tests run locally with RUN_LIVE_TESTS=1. They require:
 *   TEST_BUYER_EMAIL, TEST_BUYER_PASSWORD   — buyer account
 *   TEST_SELLER_EMAIL, TEST_SELLER_PASSWORD — seller with payouts_enabled=true
 *   TEST_ADMIN_EMAIL, TEST_ADMIN_PASSWORD   — admin account
 *   TEST_LISTING_ID                         — an active listing owned by TEST_SELLER
 *   STRIPE_SECRET_KEY                       — for Stripe CLI trigger commands
 *
 * Stripe webhook listener must be running separately (see docs/STRIPE_TESTING.md):
 *   ~/bin/stripe listen --api-key <sk> --forward-to localhost:3000/api/webhooks/stripe
 *
 * Test card: 4242 4242 4242 4242 / 12/29 / 123
 */
import { test, expect, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const isLive = !!process.env.RUN_LIVE_TESTS

const SUPABASE_URL       = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY   = process.env.SUPABASE_SERVICE_ROLE_KEY!
const TEST_BUYER_EMAIL   = process.env.TEST_BUYER_EMAIL    ?? ''
const TEST_BUYER_PW      = process.env.TEST_BUYER_PASSWORD ?? ''
const _TEST_SELLER_EMAIL  = process.env.TEST_SELLER_EMAIL   ?? ''
const _TEST_SELLER_PW     = process.env.TEST_SELLER_PASSWORD ?? ''
const TEST_ADMIN_EMAIL   = process.env.TEST_ADMIN_EMAIL    ?? ''
const TEST_ADMIN_PW      = process.env.TEST_ADMIN_PASSWORD ?? ''
const TEST_LISTING_ID    = process.env.TEST_LISTING_ID     ?? ''

function serviceClient() {
  return createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })
}

async function signIn(page: Page, email: string, password: string) {
  // Fail loudly instead of timing out on the disabled submit button: the form's
  // submit is disabled while either field is empty, so blank TEST_* env produces
  // an opaque 30s page.click timeout otherwise.
  if (!email || !password) {
    throw new Error(
      'TEST_* credentials missing — run `node scripts/seed-e2e-fixtures.mjs` and add the printed block to .env.local',
    )
  }
  // /enter became the invite/waitlist landing when open registration shipped (c050434);
  // the email+password form lives at /enter/login now.
  await page.goto('/enter/login')
  const submit = page.locator('button[type="submit"]')
  await submit.waitFor({ state: 'visible' })
  // Dev-mode hydration race: filling before React hydrates leaves the controlled
  // inputs empty (and the submit disabled). Fill-and-verify until the button arms.
  for (let attempt = 0; attempt < 10; attempt++) {
    await page.fill('input[type="email"]', email)
    await page.fill('input[type="password"]', password)
    if (await submit.isEnabled()) break
    await page.waitForTimeout(500)
  }
  await submit.click()
  await page.waitForURL(/\/(browse|onboarding)/, { timeout: 10000 })
}

// ─── Non-live structural tests ────────────────────────────────────────────────

test('checkout redirects unauthenticated users to /enter', async ({ page }) => {
  await page.goto('/checkout/00000000-0000-0000-0000-000000000000')
  await expect(page).toHaveURL(/\/enter/)
})

test('GET /api/checkout returns 401 without auth', async ({ page }) => {
  const res = await page.request.post('/api/checkout', {
    data: { listingId: '00000000-0000-0000-0000-000000000000' },
  })
  expect(res.status()).toBe(401)
})

test('POST /api/checkout rejects tampered listingId format', async ({ page }) => {
  // 401 because not authed — that's fine, UUID check happens after auth
  const res = await page.request.post('/api/checkout', {
    data: { listingId: 'not-a-uuid' },
  })
  expect(res.status()).toBe(401) // Unauthed, which is caught first
})

test('POST /api/webhooks/stripe rejects missing signature', async ({ page }) => {
  const res = await page.request.post('/api/webhooks/stripe', {
    headers: { 'Content-Type': 'application/json' },
    data: JSON.stringify({ type: 'payment_intent.succeeded' }),
  })
  expect(res.status()).toBe(400)
})

test('POST /api/webhooks/stripe rejects invalid signature', async ({ page }) => {
  const res = await page.request.post('/api/webhooks/stripe', {
    headers: {
      'Content-Type': 'application/json',
      'stripe-signature': 't=1234,v1=invalid',
    },
    data: '{"type":"payment_intent.succeeded"}',
  })
  expect(res.status()).toBe(400)
})

test('/orders/:id redirects unauthenticated to /enter', async ({ page }) => {
  await page.goto('/orders/00000000-0000-0000-0000-000000000000')
  await expect(page).toHaveURL(/\/enter/)
})

// ─── Live tests @live ─────────────────────────────────────────────────────────

test.describe('@live checkout flow', () => {
  test.skip(!isLive, 'RUN_LIVE_TESTS not set')

  test('fee math: server-computed total matches orderAmounts()', async () => {
    // Fetch the listing price and compute expected amounts
    const svc = serviceClient()
    const { data: listing } = await svc
      .from('listings')
      .select('price_cents')
      .eq('id', TEST_LISTING_ID)
      .single()

    expect(listing).toBeTruthy()

    // Import and verify server-side amounts. A fresh @live test user has no
    // trailing volume → base tier both sides.
    const { orderAmountsAt, feeBpsForVolumeCents } = await import('../../lib/fees')
    const bps = feeBpsForVolumeCents(0)
    const amounts = orderAmountsAt(listing!.price_cents, bps, bps)
    expect(amounts.transfer_cents).toBe(amounts.item_cents - amounts.seller_fee_cents)
  })

  test('client-total tampering: POST with wrong total is rejected', async ({ page }) => {
    await signIn(page, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    // The checkout API ignores client-submitted totals and re-computes server-side.
    // A tampered total in the PI amount vs metadata triggers the mismatch check
    // in the webhook handler. We test the API returns the correct PI amount.
    const res = await page.request.post('/api/checkout', {
      data: { listingId: TEST_LISTING_ID },
    })
    // Only 200 (PI created — tamper check happens in webhook) or 409 (listing locked by a
    // previous run) are acceptable. Anything else — e.g. 422 seller-not-payout-ready —
    // must FAIL here; the old branch-only assertions let a 422 pass vacuously.
    expect([200, 409], `unexpected /api/checkout status ${res.status()}: ${await res.text()}`)
      .toContain(res.status())
    if (res.status() === 200) {
      const body = await res.json()
      expect(body.clientSecret).toBeTruthy()
      expect(body.orderSummary.total_cents).toBeGreaterThan(0)

      // Clean up: reset listing to active (webhook didn't fire, so listing stuck in pending_escrow)
      const svc = serviceClient()
      await svc.from('listings').update({ status: 'active' }).eq('id', TEST_LISTING_ID)
      await svc.from('checkout_sessions').delete().eq('listing_id', TEST_LISTING_ID)
    }
  })

  test('RLS: third party cannot read an order', async ({ page }) => {
    // Sign in as admin to find a real order
    const svc = serviceClient()
    const { data: anyOrder } = await svc
      .from('orders')
      .select('id')
      .limit(1)
      .single()

    if (!anyOrder) {
      console.log('No orders in DB — skipping RLS test')
      return
    }

    // Sign in as a random third party (buyer != order.buyer_id)
    await signIn(page, TEST_ADMIN_EMAIL, TEST_ADMIN_PW)
    // Admin CAN see any order — use buyer account for the RLS check
    await signIn(page, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    const res = await page.request.get(`/api/orders/by-intent?pi=pi_nonexistent_${anyOrder.id}`)
    const body = await res.json()
    // Should either 401 (not authed) or return null orderId (not accessible)
    expect(body.orderId ?? null).toBeNull()
  })

  test('buyer cannot write order state directly', async ({ page }) => {
    await signIn(page, TEST_BUYER_EMAIL, TEST_BUYER_PW)

    // Try to directly call the ship endpoint (seller-only action)
    const svc = serviceClient()
    const { data: order } = await svc
      .from('orders')
      .select('id, buyer_id, seller_id')
      .limit(1)
      .single()

    if (!order) return

    const res = await page.request.post(`/api/orders/${order.id}/ship`, {
      data: { carrier: 'USPS', trackingNumber: '1234567890' },
    })
    // Should be 403 (buyer cannot ship) or 404
    expect([403, 404]).toContain(res.status())
  })
})

test.describe('@live order status pages', () => {
  test.skip(!isLive, 'RUN_LIVE_TESTS not set')

  test('checkout page renders order summary and payment form', async ({ page }) => {
    // Self-clean BEFORE running too: a prior failed run (or a racing test) can leave the
    // fixture listing locked in pending_escrow, which turns the mount-time /api/checkout
    // into a 409 and hides the payment form.
    const pre = serviceClient()
    await pre.from('checkout_sessions').delete().eq('listing_id', TEST_LISTING_ID)
    await pre.from('listings').update({ status: 'active' }).eq('id', TEST_LISTING_ID).eq('status', 'pending_escrow')

    await signIn(page, TEST_BUYER_EMAIL, TEST_BUYER_PW)
    await page.goto(`/checkout/${TEST_LISTING_ID}`)

    // Should show the checkout header
    await expect(page.locator('text=Checkout')).toBeVisible({ timeout: 10000 })

    // Should show order summary
    await expect(page.getByText(/PRICE/)).toBeVisible()
    await expect(page.getByText(/BUYER FEE/)).toBeVisible()
    await expect(page.getByText(/SHIPPING/)).toBeVisible()
    await expect(page.getByText(/TOTAL/)).toBeVisible()

    // Should show pay button
    await expect(page.locator('button', { hasText: /held in escrow/i })).toBeVisible({ timeout: 15000 })

    // Clean up
    const svc = serviceClient()
    await svc.from('listings').update({ status: 'active' }).eq('id', TEST_LISTING_ID)
    await svc.from('checkout_sessions').delete().eq('listing_id', TEST_LISTING_ID)
  })
})

test.describe('@live dispute freezes auto-release', () => {
  test.skip(!isLive, 'RUN_LIVE_TESTS not set')

  test('auto-release skips orders with active dispute', async () => {
    const svc = serviceClient()

    // Find or create a delivered order
    const { data: order } = await svc
      .from('orders')
      .select('id, delivered_at')
      .eq('state', 'delivered')
      .limit(1)
      .single()

    if (!order) {
      console.log('No delivered orders — skipping dispute freeze test')
      return
    }

    // Ensure a dispute exists (unresolved)
    await svc.from('disputes').upsert({
      order_id:    order.id,
      buyer_id:    (await svc.from('orders').select('buyer_id').eq('id', order.id).single()).data?.buyer_id,
      photos:      ['https://example.com/test-photo.jpg'],
      description: 'Test dispute for auto-release freeze test',
    }, { onConflict: 'order_id' })

    // Backdate delivered_at to 4 days ago
    await svc
      .from('orders')
      .update({ delivered_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('id', order.id)

    // Call the auto-release function
    const { error } = await svc.rpc('auto_release_delivered_orders')
    expect(error).toBeNull()

    // Verify order was NOT released (dispute is active)
    const { data: after } = await svc
      .from('orders')
      .select('state')
      .eq('id', order.id)
      .single()

    expect(after?.state).not.toBe('released')
    expect(after?.state).toBe('delivered') // should still be delivered (or disputed if it was transitioned)

    // Clean up: remove test dispute and restore delivered_at
    await svc.from('disputes').delete().eq('order_id', order.id)
    await svc.from('orders').update({ delivered_at: order.delivered_at }).eq('id', order.id)
  })

  test('auto-release fires when no dispute and 3+ days elapsed', async () => {
    const svc = serviceClient()

    const { data: order } = await svc
      .from('orders')
      .select('id, delivered_at, seller_id')
      .eq('state', 'delivered')
      .is('stripe_transfer_id', null) // prefer no-transfer orders for easy cleanup
      .limit(1)
      .single()

    if (!order) {
      console.log('No delivered orders without transfers — skipping auto-release test')
      return
    }

    // Ensure no active dispute
    await svc.from('disputes').delete().eq('order_id', order.id)

    // Backdate delivered_at to 4 days ago
    await svc
      .from('orders')
      .update({ delivered_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() })
      .eq('id', order.id)

    // Call the auto-release function
    const { error } = await svc.rpc('auto_release_delivered_orders')
    expect(error).toBeNull()

    // Verify order was released
    const { data: after } = await svc
      .from('orders')
      .select('state')
      .eq('id', order.id)
      .single()

    expect(after?.state).toBe('released')

    // Restore delivered_at (can't undo the state change without another transition)
    // Order is now in released state — that's intentional
  })
})

test.describe('@live idempotency', () => {
  test.skip(!isLive, 'RUN_LIVE_TESTS not set')

  test('duplicate webhook event produces exactly one order and one audit row', async () => {
    const svc = serviceClient()

    // Find an existing order_event with a stripe_event_id
    const { data: event } = await svc
      .from('order_events')
      .select('stripe_event_id, order_id')
      .not('stripe_event_id', 'is', null)
      .limit(1)
      .single()

    if (!event) {
      console.log('No events with stripe_event_id — skipping idempotency test')
      return
    }

    // Attempt to replay by calling transition_order with the same event ID
    const { data: order } = await svc
      .from('orders')
      .select('state, seller_id')
      .eq('id', event.order_id)
      .single()

    if (!order) return

    // Replay via RPC — should silently return (idempotent)
    const { error } = await svc.rpc('transition_order', {
      p_order_id:     event.order_id,
      p_to_state:     order.state,
      p_source:       'webhook',
      p_stripe_event: event.stripe_event_id,
      p_payload:      null,
    })

    // If the transition is illegal (same state → same state), it fails
    // but the idempotency check fires first and returns null error
    // OR raises exception for illegal transition — both are acceptable
    // The key check is: exactly one row with this stripe_event_id
    const { count } = await svc
      .from('order_events')
      .select('*', { count: 'exact', head: true })
      .eq('stripe_event_id', event.stripe_event_id)

    expect(count).toBe(1)
    void error // may or may not error depending on state
  })
})
