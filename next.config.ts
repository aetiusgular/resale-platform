import type { NextConfig } from 'next'
import path from 'path'
import { withSentryConfig } from '@sentry/nextjs'

const nextConfig: NextConfig = {
  // Silence the workspace root warning from multiple lockfiles
  outputFileTracingRoot: path.join(__dirname),

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
        ],
      },
    ]
  },
}

// Wrap with Sentry only if DSN is configured; otherwise export plain config.
// This avoids Sentry webpack transforms when DSN is absent (local dev without Sentry).
const hasSentryDsn = !!(process.env.SENTRY_DSN ?? process.env.NEXT_PUBLIC_SENTRY_DSN)

export default hasSentryDsn
  ? withSentryConfig(nextConfig, {
      org: process.env.SENTRY_ORG ?? '',
      project: process.env.SENTRY_PROJECT ?? 'resale-platform',
      // Suppress Sentry CLI output in CI
      silent: !process.env.CI,
      // Disable source map upload if no auth token
      sourcemaps: {
        disable: !process.env.SENTRY_AUTH_TOKEN,
      },
      // Tunnelling not needed at alpha scale
      tunnelRoute: undefined,
    })
  : nextConfig
