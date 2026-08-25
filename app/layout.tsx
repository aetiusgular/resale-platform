import type { Metadata } from 'next'
import { Inter, EB_Garamond, Space_Mono } from 'next/font/google'
import './globals.css'
import SmoothScroll from '@/app/components/smooth-scroll'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
})

const ebGaramond = EB_Garamond({
  subsets: ['latin'],
  variable: '--font-eb-garamond',
  weight: ['400'],
  style: ['normal', 'italic'],
  display: 'swap',
})

const spaceMono = Space_Mono({
  subsets: ['latin'],
  variable: '--font-space-mono',
  weight: ['400', '700'],
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Resale Platform',
  description: 'Curated secondhand fashion marketplace',
}

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
      className={`${inter.variable} ${ebGaramond.variable} ${spaceMono.variable}`}
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
        <SmoothScroll>{children}</SmoothScroll>
      </body>
    </html>
  )
}
