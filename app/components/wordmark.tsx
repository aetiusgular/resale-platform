/**
 * Wordmark — ARCHIVE, the brand link in the header (and the small footer variant).
 * No server imports: the footer renders inside client-rendered auth frames too.
 */
import PrefetchLink from './prefetch-link'
import { BRAND_WORDMARK } from './brand'

export function Wordmark({ href = '/', small, testId }: { href?: string; small?: boolean; testId?: string }) {
  return (
    <PrefetchLink className={small ? 'footer__brand' : 'header__brand'} href={href} title="Home" data-testid={testId}>
      <span className={small ? 'footer__logo' : 'header__logo'}>{BRAND_WORDMARK}</span>
    </PrefetchLink>
  )
}
