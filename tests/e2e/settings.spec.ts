import { test, expect } from '@playwright/test'

/**
 * Settings UI — structural + responsive tests.
 * Non-@live: no real auth needed — unauthenticated redirects + static structure.
 */

test.describe('Settings — unauthenticated', () => {
  test('/settings redirects to /enter', async ({ page }) => {
    await page.goto('/settings')
    await expect(page).toHaveURL(/\/enter/)
  })

  test('/settings?section=my-sizes redirects to /enter', async ({ page }) => {
    await page.goto('/settings?section=my-sizes')
    await expect(page).toHaveURL(/\/enter/)
  })
})

test.describe('@live Settings — authenticated', () => {
  test.skip(() => !process.env.SEED_USERNAME, 'Set SEED_USERNAME to run live settings tests')

  test('settings page renders nav rail on desktop', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/settings')
    // Desktop rail should be visible
    await expect(page.locator('.settings-desktop')).toBeVisible()
    // Nav rail contains the section labels
    await expect(page.locator('.settings-desktop >> text=ACCOUNT')).toBeVisible()
    await expect(page.locator('.settings-desktop >> text=SELLING')).toBeVisible()
    await expect(page.locator('.settings-desktop >> text=TRUST')).toBeVisible()
    // Default pane (My sizes) should show
    await expect(page.locator('.settings-desktop >> text=My sizes')).toBeVisible()
  })

  test('settings page renders index on mobile', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 })
    await page.goto('/settings')
    // Mobile index should be visible
    await expect(page.locator('.settings-mobile')).toBeVisible()
    // Should show section headers
    await expect(page.locator('.settings-mobile >> text=ACCOUNT')).toBeVisible()
    // Should show nav items with chevrons
    await expect(page.locator('.settings-mobile >> text=My sizes')).toBeVisible()
    await expect(page.locator('.settings-mobile >> text=Payments')).toBeVisible()
  })

  test('my sizes pane has size chips and disabled save button', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/settings?section=my-sizes')
    // Size category labels
    await expect(page.locator('text=Tops')).toBeVisible()
    await expect(page.locator('text=Bottoms')).toBeVisible()
    await expect(page.locator('text=Footwear')).toBeVisible()
    // Save button exists and is disabled
    const saveBtn = page.getByTestId('sizes-save-btn')
    await expect(saveBtn).toBeVisible()
    await expect(saveBtn).toBeDisabled()
  })

  test('payments pane shows payout status', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 })
    await page.goto('/settings?section=payments')
    await expect(page.locator('text=Payments')).toBeVisible()
    await expect(page.locator('text=Payment methods')).toBeVisible()
    await expect(page.locator('text=Payouts')).toBeVisible()
  })
})
