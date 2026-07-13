import type { NextConfig } from 'next'
import path from 'path'
import { withSentryConfig } from '@sentry/nextjs'

// Content Security Policy — tightened in B8.
// img-src allows Supabase Storage, Stripe, and PostHog.
// script-src 'unsafe-eval' required for Next.js dev HMR; removed in production.
const CSP = [
  `default-src 'self'`,
  `script-src 'self' 'unsafe-inline' https://js.stripe.com https://app.posthog.com ${process.env.NODE_ENV === 'development' ? "'unsafe-eval'" : ''}`,
  `style-src 'self' 'unsafe-inline'`,
  `img-src 'self' data: blob: https://*.supabase.co https://*.supabase.in https://q.stripe.com https://b.stripecdn.com https://us.i.posthog.com`,
  `font-src 'self' https://fonts.gstatic.com`,
  `connect-src 'self' https://*.supabase.co https://*.supabase.in https://api.stripe.com https://app.posthog.com https://us.i.posthog.com https://*.sentry.io https://o*.ingest.sentry.io`,
  `frame-src https://js.stripe.com https://hooks.stripe.com`,
  `form-action 'self'`,
  `base-uri 'self'`,
].join('; ')

const nextConfig: NextConfig = {
  // Silence the workspace root warning from multiple lockfiles
  outputFileTracingRoot: path.join(__dirname),

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Content-Security-Policy',
            value: CSP,
          },
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
