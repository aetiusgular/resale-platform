import { test, expect } from '@playwright/test'

/**
 * Card uniformity regression guard.
 * Root cause once fixed here: grid used `repeat(4, 1fr)`, whose implicit
 * `auto` minimum let a long nowrap title stretch its column; aspect-ratio
 * then turned the extra width into extra height. `minmax(0, 1fr)` pins it.
 * @live — needs a signed-in session + seeded listings.
 */
test.describe('@live browse card uniformity', () => {
  test('first row: identical image heights, aligned caption band', async ({ page }) => {
    await page.goto('/browse')
    const grid = page.getByTestId('listings-grid')
    await expect(grid).toBeVisible()

    const imgs = grid.locator('img')
    const n = Math.min(3, await imgs.count())
    expect(n).toBeGreaterThan(1)

    const boxes = []
    for (let i = 0; i < n; i++) boxes.push(await imgs.nth(i).boundingBox())

    // every image in the first row: same width AND same height (±1px)
    for (let i = 1; i < n; i++) {
      expect(Math.abs(boxes[i]!.height - boxes[0]!.height)).toBeLessThanOrEqual(1)
      expect(Math.abs(boxes[i]!.width - boxes[0]!.width)).toBeLessThanOrEqual(1)
    }

    // contained caption band — brand, title, price, facts aligned across row
    const brands = grid.getByTestId('card-brand')
    const titles = grid.getByTestId('card-title')
    const prices = grid.getByTestId('card-price')
    const facts = grid.getByTestId('card-facts')
    const by = []
    const ty = []
    const py = []
    const fy = []
    for (let i = 0; i < n; i++) {
      by.push((await brands.nth(i).boundingBox())!.y)
      ty.push((await titles.nth(i).boundingBox())!.y)
      py.push((await prices.nth(i).boundingBox())!.y)
      fy.push((await facts.nth(i).boundingBox())!.y)
    }
    for (let i = 1; i < n; i++) {
      expect(Math.abs(by[i] - by[0])).toBeLessThanOrEqual(1)
      expect(Math.abs(ty[i] - ty[0])).toBeLessThanOrEqual(1)
      expect(Math.abs(py[i] - py[0])).toBeLessThanOrEqual(1)
      expect(Math.abs(fy[i] - fy[0])).toBeLessThanOrEqual(1)
    }

    // vertical stack: brand → title → price → facts
    const b0 = (await brands.first().boundingBox())!
    const t0 = (await titles.first().boundingBox())!
    const p0 = (await prices.first().boundingBox())!
    const f0 = (await facts.first().boundingBox())!
    expect(t0.y).toBeGreaterThan(b0.y + b0.height - 1)
    expect(p0.y).toBeGreaterThan(t0.y + t0.height - 1)
    expect(f0.y).toBeGreaterThan(p0.y + p0.height - 1)

    // grid cards: no save overlay or trust signals on image/caption
    await expect(grid.locator('.card-save-overlay')).toHaveCount(0)
    await expect(grid.getByTestId('card-trust')).toHaveCount(0)
  })
})
