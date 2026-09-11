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

  test('index links to proto and changes', async ({ page }) => {
    await page.goto('/styleguide')
    await expect(page.getByRole('link', { name: 'PROTO' })).toHaveAttribute('href', '/styleguide/proto')
    await expect(page.getByRole('link', { name: 'CHANGES' })).toHaveAttribute('href', '/styleguide/changes')
  })

  test('changes page maps the 2nd1 delta', async ({ page }) => {
    await page.goto('/styleguide/changes')
    await expect(page).toHaveTitle(/Since 2nd1 browse/)
    await expect(page.locator('h1')).toHaveText('Since 2nd1 browse.')
    await expect(page.getByRole('link', { name: '2nd1 /browse' })).toHaveAttribute(
      'href',
      'https://resale-platform-4mhuvf581-2nd1.vercel.app/browse',
    )
    await expect(page.locator('.delta')).toHaveCount(19)
  })

  test('proto chrome links to changes', async ({ page }) => {
    await page.goto('/styleguide/proto')
    await expect(page.getByTestId('proto-changes')).toHaveAttribute('href', '/styleguide/changes')
    await expect(page.getByText('Diff vs 2nd1 browse.')).toBeVisible()
  })
})
