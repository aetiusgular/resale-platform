import type { Metadata, Viewport } from 'next'
import { headers } from 'next/headers'
import { Archivo, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { SEO_INDEXING_ENABLED } from '@/lib/flags'
import { baseUrl, SITE_NAME, SITE_TAGLINE } from '@/lib/seo'
import AuthModalProvider from '@/app/components/auth-modal-provider'
import { THEME_BOOTSTRAP_SCRIPT } from '@/app/components/theme-bootstrap'

// Two families (design review): Archivo for chrome + copy, IBM Plex Mono for
// every piece of data. Self-hosted through next/font, so the CSP font-src 'self'
// covers them.
const archivo = Archivo({
  subsets: ['latin'],
  variable: '--font-archivo',
  weight: ['300', '400', '500'],
  display: 'swap',
})

const plexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-plex-mono',
  weight: ['300', '400'],
  display: 'swap',
})

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl()),
  title: {
    default: SITE_NAME,
    template: `%s — ${SITE_NAME}`,
  },
  description: SITE_TAGLINE,
  applicationName: SITE_NAME,
  openGraph: {
    siteName: SITE_NAME,
    type: 'website',
    locale: 'en_US',
    url: '/',
  },
  twitter: {
    card: 'summary',
  },
  // Deindex gate for the vercel.app tester window. robots.txt deliberately
  // still ALLOWS crawling in this state — a crawler must be able to fetch a
  // page to see this noindex (a disallow-all robots.txt would strand URL-only
  // index entries). Flip SEO_INDEXING_ENABLED at real-domain cutover.
  robots: SEO_INDEXING_ENABLED
    ? { index: true, follow: true }
    : { index: false, follow: false },
}

// Browser chrome colour follows the resolved theme (tokens --bg light / dark).
export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f5f5f3' },
    { media: '(prefers-color-scheme: dark)', color: '#131312' },
  ],
}

// Force dynamic rendering app-wide. REQUIRED by the per-request CSP nonce in
// middleware.ts: Next can only inject the nonce into inline <script> tags during
// server rendering, so statically-generated pages (/enter, /terms, /privacy,
// /fees, /onboarding/*, checkout/success) shipped nonce-less HTML that the
// runtime CSP then blocked — a blank page in production. Setting this on the root
// layout opts every route into dynamic rendering so the nonce always applies.
// (Next docs: "Using nonces in a CSP mandates that all pages be dynamically rendered.")
export const dynamic = 'force-dynamic'

// Supabase origin (listing images + auth/API) — preconnect so the first image
// fetch after a navigation skips DNS + TLS setup. React 19 hoists these <link>
// tags into <head>.
const supabaseOrigin = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '').origin
  } catch {
    return null
  }
})()

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // Per-request CSP nonce (middleware.ts) so the theme bootstrap inline script
  // is allowed to run before first paint.
  const nonce = (await headers()).get('x-nonce') ?? undefined

  return (
    // suppressHydrationWarning on <html>: the theme bootstrap sets data-theme
    // before React hydrates, which is an intentional server/client attribute diff.
    <html
      lang="en"
      className={`${archivo.variable} ${plexMono.variable}`}
      suppressHydrationWarning
    >
      <head>
        {/* suppressHydrationWarning: React strips the CSP nonce from client hydration
            for security, so the server's nonce attribute vs the empty client one is an
            intentional, unavoidable diff, not a real mismatch. */}
        <script nonce={nonce} dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP_SCRIPT }} suppressHydrationWarning />
      </head>
      {/* suppressHydrationWarning: browser extensions (Grammarly et al.) inject
          attributes into <body> before React hydrates — not a real mismatch. */}
      <body suppressHydrationWarning>
        {supabaseOrigin && (
          <>
            <link rel="preconnect" href={supabaseOrigin} />
            <link rel="dns-prefetch" href={supabaseOrigin} />
          </>
        )}
        <AuthModalProvider>
          {children}
        </AuthModalProvider>
      </body>
    </html>
  )
}
