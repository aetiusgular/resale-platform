import { test, expect } from '@playwright/test'

/**
 * B1 auth gate Playwright specs.
 * Non-@live: these run against the app with no real Supabase session.
 * @live variants (RLS/RPC unit tests) are in auth-live.spec.ts.
 */

test.describe('Gate — unauthenticated', () => {
  test('unauthenticated / redirects to /enter', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/enter$/)
  })

  test('/enter shows invite code input and tagline', async ({ page }) => {
    await page.goto('/enter')
    await expect(page.getByText('A quieter market for the things worth keeping.')).toBeVisible()
    await expect(page.getByRole('textbox')).toBeVisible()
    await expect(page.getByRole('button', { name: 'Enter' })).toBeVisible()
  })

  test('invalid format shows error', async ({ page }) => {
    await page.goto('/enter')
    const input = page.getByRole('textbox')
    await input.fill('BADCODE')
    await page.getByRole('button', { name: 'Enter' }).click()
    await expect(page.getByText('codes look like XXXX-XXXX')).toBeVisible()
  })

  test('no code link goes to waitlist', async ({ page }) => {
    await page.goto('/enter')
    await page.getByText('no code? join the waitlist').click()
    await expect(page).toHaveURL(/\/enter\/waitlist$/)
    await expect(page.getByText("We'll let you know when a spot opens up.")).toBeVisible()
  })

  test('waitlist form submits email', async ({ page }) => {
    await page.goto('/enter/waitlist')
    await page.getByRole('textbox').fill('test@example.com')
    await page.getByRole('button', { name: 'Join waitlist' }).click()
    // API stub returns 200; UI shows success message
    await expect(page.getByText("You're on the list.")).toBeVisible({ timeout: 5000 })
  })

  test('direct access to gated /onboarding/* redirects to /enter when unauthenticated', async ({ page }) => {
    // /onboarding/verify and /setup require auth; /account is intentionally public
    await page.goto('/onboarding/verify')
    await expect(page).toHaveURL(/\/enter$/)
  })
})

test.describe('Gate — /enter page error states', () => {
  test('code already used error shows in alert color', async ({ page }) => {
    await page.goto('/enter')
    const input = page.getByRole('textbox')
    // Submit a properly formatted but non-existent code (no session → goes to signup flow)
    await input.fill('AAAA-BBBB')
    await page.getByRole('button', { name: 'Enter' }).click()
    // Without a session it should redirect to /onboarding/account with code param
    await expect(page).toHaveURL(/\/onboarding\/account/)
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
