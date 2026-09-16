/**
 * Auth page frames (design 1A / 1E).
 *  - AuthSplit: full-height hero (wordmark, tagline, three points) + a form
 *    column — used by /enter and /onboarding/account.
 *  - AuthPage: slim bar (wordmark + one CTA) with the form centred — used by
 *    /enter/login, /enter/forgot, /reset-password.
 * Server components; forms passed as children may be client components.
 */
import Link from 'next/link'
import { BRAND_WORDMARK } from './brand'
import SiteFooter from './site-footer'

export const ENTRY_TAGLINE = 'A quieter market for the things worth keeping.'
export const ENTRY_POINTS: [string, string][] = [
  ['01', 'FREE TO JOIN'],
  ['02', 'EVERY SALE IN ESCROW'],
  ['03', 'CONDITION GRADED 1–10'],
]

function Brand() {
  return (
    <span className="header__brand">
      <span className="header__logo">{BRAND_WORDMARK}</span>
    </span>
  )
}

export function AuthSplit({ children }: { children: React.ReactNode }) {
  return (
    <div className="auth-split">
      <header className="auth-mobilebar"><Brand /></header>
      <div className="auth-hero">
        <Link href="/browse" title="Browse"><Brand /></Link>
        <div>
          <div className="auth-hero__word">{BRAND_WORDMARK}</div>
          <p className="auth-hero__sub">{ENTRY_TAGLINE} The peer-to-peer market for archive fashion. Every sale held in escrow, every piece condition-graded.</p>
          <div className="auth-hero__points">
            {ENTRY_POINTS.map(([n, t]) => (
              <div key={n} className="auth-hero__point"><span>{n}</span><span>{t}</span></div>
            ))}
          </div>
        </div>
        <div className="auth-hero__foot">
          <Link href="/terms">TERMS</Link>
          <Link href="/privacy">PRIVACY</Link>
          <Link href="/fees">FEES</Link>
          <span className="auth-hero__copy">© 2026</span>
        </div>
      </div>
      <div className="auth-side">
        <div className="auth-form">{children}</div>
      </div>
      <SiteFooter mobileOnly />
    </div>
  )
}

export function AuthPage({ cta, children, onboarding }: {
  cta?: { href: string; label: string }
  children: React.ReactNode
  /** Onboarding steps (mobile-web 22–24): the bar keeps its right-hand link at every width. */
  onboarding?: boolean
}) {
  return (
    <div className={`auth-page${onboarding ? ' auth-page--onb' : ''}`}>
      <header className="auth-page__bar">
        <Link href="/browse" title="Browse"><Brand /></Link>
        {cta && <Link className="auth-page__cta" href={cta.href}>{cta.label}</Link>}
      </header>
      <div className="auth-page__center">
        <div className="auth-form auth-form--narrow">{children}</div>
      </div>
      <div className="auth-page__foot">
        BY CONTINUING YOU AGREE TO THE&nbsp;<Link href="/terms" style={{ textDecoration: 'underline' }}>TERMS</Link>&nbsp;&amp;&nbsp;<Link href="/privacy" style={{ textDecoration: 'underline' }}>PRIVACY POLICY</Link>
      </div>
      <SiteFooter mobileOnly />
    </div>
  )
}
