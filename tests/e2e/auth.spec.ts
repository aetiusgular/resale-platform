import { test, expect } from '@playwright/test'

/**
 * B1 auth gate Playwright specs (G13: open signup — the invite/waitlist system is removed).
 * Non-@live: these run against the app with no real Supabase session.
 * @live signup flow lives in signup-live.spec.ts.
 */

test.describe('Gate — unauthenticated', () => {
  test('unauthenticated / routes to /browse (public)', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/browse$/)
  })

  test('/enter shows tagline and the signup form (email + password only)', async ({ page }) => {
    // ARCHIVE design review (signup 1A): /enter IS the signup form — no separate
    // username step; the username is derived from the email.
    await page.goto('/enter')
    await expect(page.getByText('A quieter market for the things worth keeping.')).toBeVisible()
    await expect(page.getByTestId('signup-form')).toBeVisible()
    await expect(page.locator('input[type="email"]')).toBeVisible()
    await expect(page.locator('input[autocomplete="new-password"]')).toBeVisible()
    await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0)
    await expect(page.getByRole('button', { name: 'Create account' })).toBeVisible()
    await expect(page.getByText('MIN 10 CHARACTERS · AT LEAST 1 NUMBER')).toBeVisible()
    await expect(page.getByRole('link', { name: 'Already a member? Sign in' })).toBeVisible()
  })

  test('signup form enforces the password rule before calling out', async ({ page }) => {
    await page.goto('/enter')
    await page.locator('input[type="email"]').fill('someone@example.com')
    await page.locator('input[autocomplete="new-password"]').fill('short1')
    await page.getByRole('button', { name: 'Create account' }).click()
    await expect(page.locator('.alert-line[role="alert"]')).toContainText('AT LEAST 10 CHARACTERS')
  })

  test('sign in link goes to /enter/login', async ({ page }) => {
    await page.goto('/enter')
    await page.getByRole('link', { name: 'Already a member? Sign in' }).click()
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
    // /styleguide is in middleware's PUBLIC_PATHS, so it must render for an anonymous
    // visitor. Asserting /styleguide|/enter would match both outcomes and could never
    // fail — if the route were ever dropped from PUBLIC_PATHS the styleguide smoke specs
    // would start rendering /enter and this test would stay green.
    await page.goto('/styleguide')
    await expect(page).toHaveURL(/\/styleguide$/)
  })
})
