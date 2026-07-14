import { test, expect } from '@playwright/test'

/**
 * Card uniformity regression guard.
 * Root cause once fixed here: grid used `repeat(4, 1fr)`, whose implicit
 * `auto` minimum let a long nowrap title stretch its column; aspect-ratio
 * then turned the extra width into extra height. `minmax(0, 1fr)` pins it.
 * @live — needs a signed-in session + seeded listings.
 */
test.describe('@live browse card uniformity', () => {
  test('first row: identical image heights, aligned titles, capped length', async ({ page }) => {
    await page.goto('/browse')
    const grid = page.getByTestId('listings-grid')
    await expect(grid).toBeVisible()

    const imgs = grid.locator('img')
    const n = Math.min(4, await imgs.count())
    expect(n).toBeGreaterThan(1)

    const boxes = []
    for (let i = 0; i < n; i++) boxes.push(await imgs.nth(i).boundingBox())

    // every image in the first row: same width AND same height (±1px)
    for (let i = 1; i < n; i++) {
      expect(Math.abs(boxes[i]!.height - boxes[0]!.height)).toBeLessThanOrEqual(1)
      expect(Math.abs(boxes[i]!.width - boxes[0]!.width)).toBeLessThanOrEqual(1)
    }

    // titles share a baseline → every text row below aligns too
    const titles = grid.getByTestId('card-title')
    const ty = []
    for (let i = 0; i < n; i++) ty.push((await titles.nth(i).boundingBox())!.y)
    for (let i = 1; i < n; i++) {
      expect(Math.abs(ty[i] - ty[0])).toBeLessThanOrEqual(1)
    }

    // no rendered title exceeds the hard character cap
    const texts = await titles.allInnerTexts()
    for (const t of texts) expect(t.length).toBeLessThanOrEqual(38)
  })
})
