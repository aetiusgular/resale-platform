import { readFileSync } from 'node:fs'
import { defineConfig, devices } from '@playwright/test'

// Load .env.local into the PLAYWRIGHT process (dotenv-style). The @live specs read
// NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / TEST_* here — only the Next
// webServer loads .env.local on its own, and shell `source .env.local` breaks in zsh
// on values containing & / ?. Already-set env always wins; missing file is fine (CI).
try {
  for (const line of readFileSync('.env.local', 'utf8').split('\n')) {
    if (line.trimStart().startsWith('#')) continue
    const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/)
    if (!m) continue
    const value = m[2].replace(/^(['"])(.*)\1$/, '$2')
    if (process.env[m[1]] === undefined) process.env[m[1]] = value
  }
} catch { /* no .env.local — non-@live runs don't need it */ }

export default defineConfig({
  testDir: './tests/e2e',
  // Skip @live specs unless RUN_LIVE_TESTS=1. @live specs require real Supabase credentials.
  grep: process.env.RUN_LIVE_TESTS ? undefined : /^(?!.*@live)/,
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  // @live specs share ONE fixture listing + one real (test-mode) Stripe account, so
  // parallel workers race each other over the listing lock (a checkout page mounting
  // while the tamper test holds pending_escrow gets a 409 → no payment form). Run
  // them serially; the fast structural specs keep parallelism in normal runs.
  workers: process.env.CI || process.env.RUN_LIVE_TESTS ? 1 : undefined,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],
  webServer: {
    command: 'pnpm dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
})
