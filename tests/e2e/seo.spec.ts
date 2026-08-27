import { test, expect } from '@playwright/test'

/**
 * SEO1 non-@live specs: robots/sitemap routes, canonical + site-level JSON-LD
 * on /browse, and the tester-window noindex default (SEO_INDEXING_ENABLED is
 * unset in dev/CI). Listing Product JSON-LD runs when SEED_LISTING_ID is set
 * (same convention as browse.spec.ts).
 */

test.describe('robots + sitemap routes', () => {
  test('/robots.txt serves and disallows private surfaces', async ({ request }) => {
    const res = await request.get('/robots.txt')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('Disallow: /api/')
    expect(body).toContain('Disallow: /admin/')
    // Indexing gate off in dev/CI → sitemap reference withheld until cutover.
    expect(body).not.toContain('Sitemap:')
  })

  test('/sitemap.xml serves XML including the public statics', async ({ request }) => {
    const res = await request.get('/sitemap.xml')
    expect(res.status()).toBe(200)
    const body = await res.text()
    expect(body).toContain('<urlset')
    expect(body).toContain('/browse')
  })
})

test.describe('/browse head (effective homepage)', () => {
  test('canonical strips params; site JSON-LD present; noindex by default', async ({ page }) => {
    await page.goto('/browse?sort=newest&offset=24')
    await expect(page.locator('link[rel="canonical"]')).toHaveAttribute('href', /\/browse$/)
    // Tester-window gate: flag unset → meta robots noindex.
    await expect(page.locator('meta[name="robots"]')).toHaveAttribute('content', /noindex/)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const types = blocks.map((t) => JSON.parse(t)['@type'])
    expect(types).toContain('WebSite')
    expect(types).toContain('Organization')
  })
})

test.describe('listing Product JSON-LD (needs a seeded listing)', () => {
  test.skip(!process.env.SEED_LISTING_ID, 'SEED_LISTING_ID not set')

  test('active listing emits Product + BreadcrumbList with USD offer', async ({ page }) => {
    await page.goto(`/listings/${process.env.SEED_LISTING_ID}`)
    const blocks = await page.locator('script[type="application/ld+json"]').allTextContents()
    const parsed = blocks.map((t) => JSON.parse(t))
    const product = parsed.find((p) => p['@type'] === 'Product')
    expect(product).toBeTruthy()
    expect(product.offers.priceCurrency).toBe('USD')
    expect(Number(product.offers.price)).toBeGreaterThan(0)
    expect(product.image.length).toBeGreaterThan(0)
    expect(product.image.length).toBeLessThanOrEqual(5)
    expect(parsed.some((p) => p['@type'] === 'BreadcrumbList')).toBe(true)
  })
})
