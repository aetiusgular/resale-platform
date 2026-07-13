import { test, expect } from '@playwright/test'

/**
 * B4 Browse non-@live specs.
 * Tests structural/routing behaviour without a real Supabase session.
 */

test.describe('Browse — requires auth', () => {
  test('/browse redirects unauthenticated user to /enter', async ({ page }) => {
    await page.goto('/browse')
    await expect(page).toHaveURL(/\/enter/)
  })

  test('/ redirects unauthenticated user to /enter (home now routes to /browse)', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/enter/)
  })
})

test.describe('API /api/saves — unauthenticated', () => {
  test('POST without session returns 401', async ({ request }) => {
    const res = await request.post('/api/saves', {
      data: { listing_id: '00000000-0000-0000-0000-000000000001' },
    })
    expect(res.status()).toBe(401)
  })

  test('DELETE without session returns 401', async ({ request }) => {
    const res = await request.delete('/api/saves', {
      data: { listing_id: '00000000-0000-0000-0000-000000000001' },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('API /api/saved-searches — unauthenticated', () => {
  test('POST without session returns 401', async ({ request }) => {
    const res = await request.post('/api/saved-searches', {
      data: { query: { q: 'jacket' } },
    })
    expect(res.status()).toBe(401)
  })
})

test.describe('API /api/browse — unauthenticated', () => {
  test('GET without session returns 401', async ({ request }) => {
    const res = await request.get('/api/browse')
    expect(res.status()).toBe(401)
  })
})

// Note: /api/dev/seed returns 403 in production. Dev guard tested manually.

test.describe('SSR listing title in HTML (no JS)', () => {
  // Verify the listing page title appears in server-rendered HTML.
  // This uses the public listing URL — unauthenticated users can read active listings.
  // The test only runs if SEED_LISTING_ID is set.
  test.skip(
    () => !process.env.SEED_LISTING_ID,
    'Set SEED_LISTING_ID to a known active listing ID to run SSR checks',
  )

  test('/listings/[id] title in SSR HTML', async ({ page }) => {
    const id = process.env.SEED_LISTING_ID!
    // Disable JS to simulate crawler / curl
    await page.context().newPage()
    const noJsPage = await page.context().newPage()
    await noJsPage.route('**/*.js', route => route.abort())
    await noJsPage.goto(`/listings/${id}`)
    const html = await noJsPage.content()
    // Title should appear in initial HTML (h1 or meta)
    expect(html).toContain('[SEED]')
  })
})
