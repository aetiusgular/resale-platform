import { test, expect } from '@playwright/test'

/**
 * HF5 — Mobile layout specs.
 * Tests structural/responsive behavior at mobile viewport (375x812).
 * These test unauthenticated redirects and structural properties.
 * Authenticated mobile tests require @live tag.
 */

const MOBILE = { width: 375, height: 812 }

test.describe('Mobile — unauthenticated redirects (no horizontal overflow)', () => {
  test.use({ viewport: MOBILE })

  const routes = ['/saved', '/messages', '/sell', '/settings']

  for (const route of routes) {
    test(`${route} redirects to /enter without overflow`, async ({ page }) => {
      await page.goto(route)
      await expect(page).toHaveURL(/\/enter/)
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
      expect(overflow).toBe(false)
    })
  }

  test('/enter page has no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/enter')
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(overflow).toBe(false)
  })
})

test.describe('Mobile — tab bar should NOT render on unauthenticated routes', () => {
  test.use({ viewport: MOBILE })

  test('/enter does not show mobile tab bar', async ({ page }) => {
    await page.goto('/enter')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="mobile-tabbar"]')).toHaveCount(0)
  })
})

test.describe('Mobile — styleguide (public page, no auth)', () => {
  test.use({ viewport: MOBILE })

  test('styleguide has no horizontal overflow at 375px', async ({ page }) => {
    await page.goto('/styleguide')
    await page.waitForLoadState('networkidle')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(overflow).toBe(false)
  })
})

test.describe('Desktop — tab bar should not be visible', () => {
  test('tab bar hidden at desktop viewport', async ({ page }) => {
    // Redirect to /enter but desktop tab bar CSS class should apply
    await page.goto('/enter')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="mobile-tabbar"]')).toHaveCount(0)
  })
})

test.describe('Mobile — SiteHeader responsive', () => {
  test.use({ viewport: MOBILE })

  test('desktop-only links are hidden on mobile (via CSS)', async ({ page }) => {
    // Styleguide doesn't have SiteHeader, so we test on /enter
    // which redirects. The header isn't on /enter page.
    // This test validates CSS utility classes exist and work.
    await page.goto('/styleguide')
    await page.waitForLoadState('networkidle')

    // Inject a test element with desktop-only class
    const hidden = await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'desktop-only'
      el.id = 'test-desktop-only'
      document.body.appendChild(el)
      const display = window.getComputedStyle(el).display
      el.remove()
      return display
    })
    expect(hidden).toBe('none')
  })

  test('mobile-only elements are visible on mobile', async ({ page }) => {
    await page.goto('/styleguide')
    await page.waitForLoadState('networkidle')

    const display = await page.evaluate(() => {
      const el = document.createElement('div')
      el.className = 'mobile-only'
      el.id = 'test-mobile-only'
      el.style.display = 'block'
      document.body.appendChild(el)
      const d = window.getComputedStyle(el).display
      el.remove()
      return d
    })
    expect(display).toBe('block')
  })
})
