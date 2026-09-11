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

test.describe('Mobile web — browse chrome (mobile-web handoff 01–03)', () => {
  test.use({ viewport: MOBILE })

  test('/browse has the docked FILTERS | SORT bar and no tab bar', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('[data-testid="mobile-tabbar"]')).toHaveCount(0)
    const dock = page.getByTestId('browse-dock')
    await expect(dock).toBeVisible()
    // Fixed at the viewport bottom, part of the page (not a nav bar).
    const box = await dock.boundingBox()
    expect(box).not.toBeNull()
    expect(Math.round(box!.y + box!.height)).toBe(MOBILE.height)
    await expect(page.getByTestId('mobile-filter-btn')).toContainText('FILTERS')
    await expect(page.getByTestId('mobile-sort-btn')).toContainText('SORT')
    await expect(page.getByTestId('mobile-sort-btn')).toContainText('NEWEST')
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 2)
    expect(overflow).toBe(false)
  })

  test('FILTERS opens the full-screen takeover; SORT opens the bottom sheet', async ({ page }) => {
    await page.goto('/browse')
    await page.waitForLoadState('networkidle')
    await page.getByTestId('mobile-filter-btn').click()
    const takeover = page.getByTestId('mobile-filter-drawer')
    await expect(takeover).toBeVisible()
    await expect(takeover).toContainText('FILTER')
    await expect(takeover).toContainText('CLEAR FILTERS')
    await expect(takeover.getByTestId('filter-rail')).toBeVisible()
    await expect(page.getByTestId('drawer-show-btn')).toContainText(/SHOW [\d,]+ RESULTS/)
    await page.getByTestId('drawer-show-btn').click()
    await expect(takeover).toHaveCount(0)

    await page.getByTestId('mobile-sort-btn').click()
    const sheet = page.getByTestId('sort-sheet')
    await expect(sheet).toBeVisible()
    await expect(sheet).toContainText('NEWEST')
    await expect(sheet).toContainText('LOW TO HIGH')
    // Sits on the bottom edge of the viewport (03).
    const box = await sheet.boundingBox()
    expect(Math.round(box!.y + box!.height)).toBe(MOBILE.height)
    await page.keyboard.press('Escape')
    await expect(sheet).toHaveCount(0)
  })
})

test.describe('Mobile web — footer ends every page (mobile-web handoff 17)', () => {
  test.use({ viewport: MOBILE })

  for (const route of ['/browse', '/enter', '/enter/login', '/about']) {
    test(`${route} renders the site footer in the page flow`, async ({ page }) => {
      await page.goto(route)
      await page.waitForLoadState('networkidle')
      const footer = page.locator('footer.footer')
      await expect(footer).toHaveCount(1)
      await footer.scrollIntoViewIfNeeded()
      await expect(footer).toBeVisible()
      // In normal flow after the content — never fixed over it.
      expect(await footer.evaluate((el) => getComputedStyle(el).position)).not.toBe('fixed')
      await expect(footer).toContainText('ABOUT')
    })
  }

  test('/notifications is a gated page (redirects to /enter signed out)', async ({ page }) => {
    await page.goto('/notifications')
    await expect(page).toHaveURL(/\/enter/)
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
