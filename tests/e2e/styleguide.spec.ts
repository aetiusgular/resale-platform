import { test, expect } from '@playwright/test'

test.describe('Styleguide smoke', () => {
  test('renders and all three font families are applied', async ({ page }) => {
    await page.goto('/styleguide')

    // Page loads with correct title
    await expect(page).toHaveTitle(/Styleguide/)

    // Main heading is visible
    await expect(page.locator('h1')).toBeVisible()

    // Inter — check computed font-family on the explicit font specimen element
    const interFamily = await page
      .locator('[data-testid="font-inter"]')
      .evaluate((el) => window.getComputedStyle(el).fontFamily)
    expect(interFamily).toContain('Inter')

    // EB Garamond
    const garamondFamily = await page
      .locator('[data-testid="font-garamond"]')
      .evaluate((el) => window.getComputedStyle(el).fontFamily)
    expect(garamondFamily).toContain('EB Garamond')

    // Space Mono
    const monoFamily = await page
      .locator('[data-testid="font-mono"]')
      .evaluate((el) => window.getComputedStyle(el).fontFamily)
    expect(monoFamily).toContain('Space Mono')
  })

  test('color token swatches render', async ({ page }) => {
    await page.goto('/styleguide')

    // Six color swatches present (one per token)
    const swatches = page.locator('[aria-label^="#"]')
    await expect(swatches).toHaveCount(6)
  })

  test('listing card skeletons render', async ({ page }) => {
    await page.goto('/styleguide')

    const cards = page.locator('[aria-label="Listing card skeleton"]')
    await expect(cards).toHaveCount(3)
  })
})
