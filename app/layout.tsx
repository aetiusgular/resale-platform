import type { Metadata } from 'next'
import { IBM_Plex_Sans, IBM_Plex_Mono } from 'next/font/google'
import './globals.css'
import { SEO_INDEXING_ENABLED } from '@/lib/flags'
import { baseUrl, SITE_NAME, SITE_TAGLINE } from '@/lib/seo'
import AuthModalProvider from '@/app/components/auth-modal-provider'
import StudioRoot from '@/app/components/studio-root'

const ibmPlexSans = IBM_Plex_Sans({
  subsets: ['latin'],
  variable: '--font-ibm-plex-sans',
  weight: ['300', '400', '500'],
  display: 'swap',
})

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ['latin'],
  variable: '--font-ibm-plex-mono',
  weight: ['300', '400', '500'],
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

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html
      lang="en"
      className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}
    >
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
          <StudioRoot>{children}</StudioRoot>
        </AuthModalProvider>
      </body>
    </html>
  )
}
