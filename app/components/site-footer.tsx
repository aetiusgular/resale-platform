/**
 * Site footer — brand, info-page links, socials, copyright. Collapses to a
 * 2-col link grid on mobile. Server component.
 *
 * Mobile web (handoff 17): the footer ends EVERY page, in normal flow after the
 * content (the app shell is a min-height:100vh column, so it reaches the viewport
 * bottom on short pages; never fixed). Pages that have no footer on desktop
 * (messages, auth, onboarding) render it with `mobileOnly`.
 */
import PrefetchLink from './prefetch-link'
import { Wordmark } from './wordmark'
import { BRAND_FOOTER_LINE, BRAND_REGION_LINE } from './brand'

// Reference order: ABOUT · PRIVACY · HELP & FAQ · TERMS · TRUST (the fee schedule
// is reachable from Settings → VIEW FEE SCHEDULE → and the auth hero).
const FOOTER_LINKS: [string, string][] = [
  ['/about', 'ABOUT'],
  ['/privacy', 'PRIVACY'],
  ['/help', 'HELP & FAQ'],
  ['/terms', 'TERMS'],
  ['/trust', 'TRUST'],
]

export default function SiteFooter({ active, mobileOnly = false }: { active?: string; mobileOnly?: boolean }) {
  return (
    <footer className={`footer${mobileOnly ? ' footer--m' : ''}`}>
      <div className="footer__main">
        <Wordmark small />
        <nav className="footer__nav" aria-label="Info pages">
          {FOOTER_LINKS.map(([href, label]) => (
            <PrefetchLink key={href} className={`footer__link${active === href ? ' is-active' : ''}`} href={href}>
              {label}
            </PrefetchLink>
          ))}
        </nav>
        <span className="footer__divider" aria-hidden="true" />
        <span className="footer__social">
          <a href="https://instagram.com" target="_blank" rel="noreferrer" title="Instagram" aria-label="Instagram">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2.5" y="2.5" width="19" height="19" rx="5.5" /><circle cx="12" cy="12" r="4.3" /><circle cx="17.3" cy="6.7" r="1.2" fill="currentColor" stroke="none" /></svg>
          </a>
          <a href="https://tiktok.com" target="_blank" rel="noreferrer" title="TikTok" aria-label="TikTok">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="currentColor" stroke="none" aria-hidden="true"><path d="M16.5 3.2c.5 2.4 2.3 4 4.5 4.2v3.1a7.8 7.8 0 0 1-4.5-1.5v6.1a5.9 5.9 0 1 1-5.9-5.9c.35 0 .7.03 1 .09v3.2a2.85 2.85 0 1 0 2 2.72V3.2h2.9z" /></svg>
          </a>
        </span>
      </div>
      <div className="footer__sub">
        <span>{BRAND_FOOTER_LINE}</span>
        <span>{BRAND_REGION_LINE}</span>
      </div>
    </footer>
  )
}
