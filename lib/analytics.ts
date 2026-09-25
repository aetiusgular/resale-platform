/**
 * PostHog analytics wrapper — env-flagged (no-op when NEXT_PUBLIC_POSTHOG_KEY is absent).
 * Client-side only: guard against SSR with the typeof window check.
 * No PII in event payloads — listing IDs and filter names only.
 *
 * Event catalog (see also docs/ANALYTICS.md):
 *   Browse funnel:    product_clicked, filter_applied, search_performed, visual_search_performed, listing_saved
 *   Transaction:      checkout_started, checkout_completed, offer_made, offer_accepted
 *   Community:        comment_posted
 *   Navigation:       $pageview (auto-captured by PostHog snippet)
 */

export type AnalyticsEvent =
  | '$pageview'
  // Browse
  | 'product_clicked'
  | 'filter_applied'
  | 'search_performed'
  | 'visual_search_performed'
  | 'listing_saved'
  // Checkout funnel
  | 'checkout_started'
  | 'checkout_completed'
  // Offers
  | 'offer_made'
  | 'offer_accepted'
  // Community
  | 'comment_posted'

export function trackEvent(
  event: AnalyticsEvent,
  properties?: Record<string, string | number | boolean>,
): void {
  if (typeof window === 'undefined') return
  if (!process.env.NEXT_PUBLIC_POSTHOG_KEY) return

  // PostHog loaded via posthog-js or snippet — access via window.posthog
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const ph = (window as any).posthog
  if (ph?.capture) {
    ph.capture(event, properties ?? {})
  }
}
