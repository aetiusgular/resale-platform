import { test, expect } from '@playwright/test'

/**
 * Styleguide smoke — updated for the ARCHIVE design system (ui/archive-redesign):
 * two font families (Archivo + IBM Plex Mono) instead of three, and eleven
 * colour tokens (--bg … --alert) instead of six. Assertions are against the
 * resolved CSS custom properties, so a font that fails to load fails the test.
 */
test.describe('Styleguide smoke', () => {
  test('renders and both font families are applied', async ({ page }) => {
    await page.goto('/styleguide')

    // Page loads with correct title
    await expect(page).toHaveTitle(/Styleguide/)

    // Main heading is visible
    await expect(page.locator('h1')).toBeVisible()

    // Archivo — computed font-family on the --font-sans specimen
    const sansFamily = await page
      .locator('[data-testid="font-sans"]')
      .evaluate((el) => window.getComputedStyle(el).fontFamily)
    expect(sansFamily).toMatch(/Archivo/i)

    // IBM Plex Mono — computed font-family on the --font-mono specimen
    // (next/font emits the family as "__IBM_Plex_Mono_<hash>", hence the loose match)
    const monoFamily = await page
      .locator('[data-testid="font-mono"]')
      .evaluate((el) => window.getComputedStyle(el).fontFamily)
    expect(monoFamily).toMatch(/IBM.?Plex.?Mono/i)
  })

  test('color token swatches render', async ({ page }) => {
    await page.goto('/styleguide')

    // Eleven colour swatches present (one per token, labelled by its light hex)
    const swatches = page.locator('[aria-label^="#"]')
    await expect(swatches).toHaveCount(11)
  })

  test('theme toggle flips data-theme on <html>', async ({ page }) => {
    await page.goto('/styleguide')

    await page.locator('main').getByRole('radio', { name: 'DARK' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')

    await page.locator('main').getByRole('radio', { name: 'LIGHT' }).click()
    await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  })

  test('listing card skeletons render', async ({ page }) => {
    await page.goto('/styleguide')

    const cards = page.locator('[aria-label="Listing card skeleton"]')
    await expect(cards).toHaveCount(3)
  })

  test('index links to proto', async ({ page }) => {
    await page.goto('/styleguide')
    await expect(page.getByRole('link', { name: 'PROTO', exact: true })).toHaveAttribute('href', '/styleguide/proto')
  })

  // The tour screens used to carry a site-wide PROTOTYPE tape with a link per
  // screen. The index below is the only jump-off point now, so it has to be
  // complete — and the screens have to stay clean.
  test('the styleguide is the only proto index', async ({ page }) => {
    await page.goto('/styleguide')
    const rows = page.locator('.proto-index__row')
    await expect(rows).toHaveCount(9)
    await expect(rows.first()).toHaveAttribute('href', '/styleguide/proto')
    await expect(page.getByRole('link', { name: 'THREAD', exact: true })).toHaveAttribute('href', '/styleguide/proto/messages/t1')
  })

  for (const path of [
    '/styleguide/proto',
    '/styleguide/proto/proto-01',
    '/styleguide/proto/saved',
    '/styleguide/proto/messages',
    '/styleguide/proto/messages/t1',
    '/styleguide/proto/sell',
    '/styleguide/proto/sell/new',
    '/styleguide/proto/settings',
    '/styleguide/proto/settings/orders',
  ]) {
    test(`no prototype banner on ${path}`, async ({ page }) => {
      const res = await page.goto(path)
      expect(res?.status()).toBe(200)
      // The screen has to have actually drawn, or "the banner is absent" is vacuous.
      await expect(page.locator('header.header')).toBeVisible()
      await expect(page.getByTestId('proto-nav')).toHaveCount(0)
      await expect(page.getByText('PROTOTYPE — FIXTURE DATA')).toHaveCount(0)
    })
  }

  test('proto thread composes with a photo attach control', async ({ page }) => {
    await page.goto('/styleguide/proto/messages/t1')

    const send = page.locator('.btn-send')
    await expect(send).toBeDisabled()

    await page.getByTestId('proto-compose-input').fill('Is the lining intact?')
    await expect(send).toBeEnabled()

    // 44px target per the control-height rule; the picker is fixture-only.
    const attach = page.getByLabel('Attach a photo')
    await expect(attach).toBeVisible()
    const box = await attach.boundingBox()
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.height).toBeGreaterThanOrEqual(44)
  })

  test('proto browse mounts fixture catalog, not live browse', async ({ page }) => {
    await page.goto('/styleguide/proto')
    await expect(page.getByTestId('listings-grid')).toBeVisible()
    await expect(page.getByText('Prototype catalog — fixture listings, no live inventory.')).toBeVisible()
  })

  test('proto header tabs stay inside the tour when logged out', async ({ page }) => {
    await page.goto('/styleguide/proto')
    await expect(page.getByRole('link', { name: 'SELL', exact: true })).toHaveAttribute('href', '/styleguide/proto/sell')
    await expect(page.getByRole('link', { name: 'SAVED', exact: true })).toHaveAttribute('href', '/styleguide/proto/saved')
    await expect(page.locator('header a[href="/styleguide/proto/messages"]')).toBeVisible()
    await page.getByRole('link', { name: 'SAVED', exact: true }).click()
    await expect(page).toHaveURL(/\/styleguide\/proto\/saved$/)
    await expect(page.getByTestId('browse-signin')).toHaveCount(0)
  })
})
