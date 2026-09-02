import Link from 'next/link'
import type { Metadata } from 'next'
import { SITE_TAGLINE } from '@/lib/seo'

/**
 * /enter — public landing. Open signup (G13): create an account or log in.
 */
export const metadata: Metadata = {
  title: 'Sign in',
  description: SITE_TAGLINE,
  alternates: { canonical: '/enter' },
}

export default function EnterPage() {
  return (
    <div
      style={{
        background: 'var(--color-bg)',
        minHeight: '100svh',
        display: 'flex',
        flexDirection: 'column',
        padding: '0 32px',
      }}
    >
      {/* Main content */}
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 0,
          textAlign: 'center',
        }}
      >
        <span
          style={{
            font: '500 15px var(--font-ui)',
            letterSpacing: 0,
            color: 'var(--color-ink)',
          }}
        >
          archive
        </span>

        {/* Tagline */}
        <p
          style={{
            margin: '24px 0 0',
            fontFamily: 'var(--font-ui)',
            fontWeight: 300,
            fontSize: '28px',
            lineHeight: 1.35,
            letterSpacing: '-0.01em',
            color: 'var(--color-ink)',
            maxWidth: '400px',
          }}
        >
          A quieter market for the things worth keeping.
        </p>

        {/* Create account */}
        <Link
          href="/onboarding/account"
          style={{
            marginTop: '48px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            height: '44px',
            width: '100%',
            maxWidth: '360px',
            background: 'var(--color-ink)',
            color: 'var(--color-bg)',
            border: '1px solid var(--color-ink)',
            borderRadius: '2px',
            font: '500 14px var(--font-ui)',
            letterSpacing: '-0.01em',
            textDecoration: 'none',
            boxSizing: 'border-box',
          }}
        >
          Create account
        </Link>

        <Link
          href="/enter/login"
          style={{
            marginTop: '20px',
            fontSize: '13px',
            color: 'var(--color-ink-soft)',
          }}
        >
          already a member? log in
        </Link>
      </div>

      {/* Footer */}
      <div
        style={{
          padding: '24px 0 28px',
          display: 'flex',
          justifyContent: 'center',
          gap: '24px',
        }}
      >
        {[
          { label: 'Terms', href: '/terms' },
          { label: 'Privacy', href: '/privacy' },
          { label: 'Fees', href: '/fees' },
        ].map(({ label, href }) => (
          <Link
            key={label}
            href={href}
            style={{
              font: '500 11px var(--font-ui)',
              letterSpacing: '0.08em',
              textTransform: 'uppercase',
              color: 'var(--color-ink-soft)',
              textDecoration: 'none',
            }}
          >
            {label}
          </Link>
        ))}
      </div>
    </div>
  )
}
