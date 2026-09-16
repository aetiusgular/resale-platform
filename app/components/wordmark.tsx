/**
 * Wordmark — the brand link in the header (and the small footer variant). No
 * server imports: the footer renders inside client-rendered auth frames too.
 * Links straight to /browse (the / route only redirects there), so the eager
 * prefetch caches the real page instead of a redirect.
 */
import PrefetchLink from './prefetch-link'
import { BRAND_WORDMARK } from './brand'

export function Wordmark({ href = '/browse', small, testId }: { href?: string; small?: boolean; testId?: string }) {
  return (
    <PrefetchLink className={small ? 'footer__brand' : 'header__brand'} href={href} title="Home" data-testid={testId} prefetch>
      <span className={small ? 'footer__logo' : 'header__logo'}>{BRAND_WORDMARK}</span>
    </PrefetchLink>
  )
}
