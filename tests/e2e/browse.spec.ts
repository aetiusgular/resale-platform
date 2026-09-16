import { test, expect } from '@playwright/test'

/**
 * B4 Browse non-@live specs.
 * Tests structural/routing behaviour without a real Supabase session.
 */

test.describe('Browse — public for guests', () => {
  test('/browse renders for an unauthenticated user (no redirect to /enter)', async ({ page }) => {
    await page.goto('/browse')
    await expect(page).toHaveURL(/\/browse/)
    // Guest header shows a Sign in button (also proves the auth-modal provider mounted).
    await expect(page.getByTestId('browse-signin')).toBeVisible()
  })

  test('/ routes an unauthenticated user to /browse', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/browse/)
  })

  test('empty browse offers the public prototype without touching gated routes', async ({ page }) => {
    await page.goto('/browse')
    await expect(page.getByTestId('browse-empty')).toBeVisible()
    await expect(page.getByTestId('open-prototype')).toHaveAttribute('href', '/styleguide/proto')
    await expect(page.getByTestId('browse-signin')).toBeVisible()
  })
})

test.describe('Browse — desktop sort dropdown', () => {
  test.use({ viewport: { width: 1280, height: 900 } })

  test('SORT opens a listbox and picking PRICE ↑ sets ?sort=price_asc', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForLoadState('networkidle')
    const btn = page.getByTestId('sort-dropdown-btn')
    await expect(btn).toContainText('SORT: NEWEST')
    await expect(btn).toHaveAttribute('aria-expanded', 'false')
    await btn.click()
    const menu = page.getByTestId('sort-menu')
    await expect(menu).toBeVisible()
    await expect(btn).toHaveAttribute('aria-expanded', 'true')
    await expect(menu).toContainText('LOW TO HIGH')
    await page.getByTestId('sort-option-price_asc').click()
    // The pick navigates (router.push, server render); dev under parallel workers can take a while.
    await expect(page).toHaveURL(/sort=price_asc/, { timeout: 15_000 })
    await expect(menu).toHaveCount(0)
    await expect(btn).toContainText('PRICE')
  })

  test('Escape closes the sort listbox without changing the sort', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForLoadState('networkidle')
    await page.getByTestId('sort-dropdown-btn').click()
    await expect(page.getByTestId('sort-menu')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('sort-menu')).toHaveCount(0)
    await expect(page).not.toHaveURL(/sort=/)
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
  // Mirrors the page: page 1 is public (native clients boot from it), deeper pages ask for an
  // account. Changed with the mobile API contract (docs/api/openapi.yaml, feat/mobile-api).
  test('GET page 1 without session returns 200 with facets', async ({ request }) => {
    const res = await request.get('/api/browse?include=facets')
    expect(res.status()).toBe(200)
    const body = await res.json()
    expect(Array.isArray(body.listings)).toBe(true)
    expect(body.savedIds).toEqual([])
    expect(body).toHaveProperty('filterCounts')
    expect(body).toHaveProperty('totalCount')
  })
  test('GET past page 1 without session returns 401 (auth_required)', async ({ request }) => {
    const res = await request.get('/api/browse?offset=24')
    expect(res.status()).toBe(401)
    expect((await res.json()).code).toBe('auth_required')
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
