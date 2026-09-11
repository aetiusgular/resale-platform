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
import { InstagramIcon, TikTokIcon } from './icons'
import { BRAND_FOOTER_LINE } from './brand'

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
            <InstagramIcon />
          </a>
          <a href="https://tiktok.com" target="_blank" rel="noreferrer" title="TikTok" aria-label="TikTok">
            <TikTokIcon />
          </a>
        </span>
      </div>
      <div className="footer__sub">
        <span>{BRAND_FOOTER_LINE}</span>
      </div>
    </footer>
  )
}
