/**
 * Display brand for the UI chrome. Separate from lib/seo SITE_NAME (the
 * <title>/OG/schema name) so the visible mark can change without touching the
 * protected SEO layer. One swap point.
 *
 * The chrome carries no stage badge: the wordmark stands alone.
 */
export const BRAND_WORDMARK = 'ARCHIVE'
export const BRAND_FOOTER_LINE = `© 2026 ${BRAND_WORDMARK}`
/** Support address — empty until the real domain lands (see LAUNCH_RUNBOOK); UI shows a placeholder line. */
export const BRAND_SUPPORT_EMAIL = ''
