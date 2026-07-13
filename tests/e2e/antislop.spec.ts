import { test, expect } from '@playwright/test'

/**
 * B3 Anti-slop Playwright specs — non-@live.
 * Tests page structure and redirect behaviour without a real Supabase session.
 * @live behaviour (duplicate flag in queue, velocity block, blocked pattern reject)
 * lives in antislop-live.spec.ts.
 */

test.describe('Admin queue — still requires auth after B3', () => {
  test('/admin/queue redirects unauthenticated user to /enter', async ({ page }) => {
    await page.goto('/admin/queue')
    await expect(page).toHaveURL(/\/enter$/)
  })
})

test.describe('Sell page — still requires auth after B3', () => {
  test('/sell redirects unauthenticated user to /enter', async ({ page }) => {
    await page.goto('/sell')
    await expect(page).toHaveURL(/\/enter$/)
  })
})

test.describe('API /api/listings — unauthenticated', () => {
  test('POST without session returns 401 regardless of body content', async ({ request }) => {
    // Even a blocked-pattern body gets 401 before lint runs (auth check first)
    const res = await request.post('/api/listings', {
      data: {
        title: 'JACKET',
        description: 'dm me for discount',
        brand: 'SUPREME',
        category: 'Tops',
        size: 'M',
        condition_score: 8,
        price_cents: 10000,
        possession_photo_url: 'https://example.com/photo.jpg',
        images: [],
      },
    })
    expect(res.status()).toBe(401)
  })
})
