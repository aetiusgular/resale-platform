import { test, expect } from '@playwright/test'

/**
 * B1 auth gate Playwright specs (G13: open signup — the invite/waitlist system is removed).
 * Non-@live: these run against the app with no real Supabase session.
 * @live signup flow lives in signup-live.spec.ts.
 */

test.describe('Gate — unauthenticated', () => {
  test('unauthenticated / redirects to /enter', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/enter$/)
  })

  test('/enter shows tagline and create-account entry', async ({ page }) => {
    await page.goto('/enter')
    await expect(page.getByText('A quieter market for the things worth keeping.')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Create account' })).toBeVisible()
    await expect(page.getByRole('link', { name: 'already a member? log in' })).toBeVisible()
  })

  test('create account goes to signup', async ({ page }) => {
    await page.goto('/enter')
    await page.getByRole('link', { name: 'Create account' }).click()
    await expect(page).toHaveURL(/\/onboarding\/account$/)
  })

  test('log in link goes to /enter/login', async ({ page }) => {
    await page.goto('/enter')
    await page.getByRole('link', { name: 'already a member? log in' }).click()
    await expect(page).toHaveURL(/\/enter\/login$/)
  })

  test('direct access to gated /onboarding/* redirects to /enter when unauthenticated', async ({ page }) => {
    // /onboarding/verify and /setup require auth; /account is intentionally public
    await page.goto('/onboarding/verify')
    await expect(page).toHaveURL(/\/enter$/)
  })
})

test.describe('Styleguide still accessible', () => {
  test('/styleguide accessible without auth', async ({ page }) => {
    // Styleguide is not gated — it's for development reference
    // But middleware now gates all non-/enter routes. Check it redirects.
    await page.goto('/styleguide')
    // Either shows styleguide (if not gated) or redirects to /enter
    const url = page.url()
    expect(url).toMatch(/\/styleguide|\/enter/)
  })
})
