# ANALYTICS.md — PostHog event catalog and dashboard definitions

## Event inventory (lib/analytics.ts)

All events fire client-side via `trackEvent()`. No PII in payloads — only
listing IDs, filter names, and boolean/numeric values.

| Event | When fired | Key properties |
|---|---|---|
| `$pageview` | Auto-captured by PostHog snippet on every navigation | `$current_url`, `$pathname` |
| `product_clicked` | Listing card tapped in browse feed | `listing_id`, `position` (int), `source` (browse/search/saved) |
| `filter_applied` | User applies a browse filter | `filter_type` (dept/cat/size/brand/min_price/max_price/cond/dropped/verified), `filter_value` |
| `search_performed` | User submits a search query | `query_length` (int, not raw query text) |
| `visual_search_performed` | Search by image completed (paste / drop / camera / picker, optional text) | `mode` (image \| image+text), `has_text`, `category`, `category_source` (explicit \| guess), `listed`, `exact`/`match`/`close` counts, `engine` (ok \| unavailable). Never the image or the text. |
| `listing_saved` | User saves (hearts) a listing | `listing_id` |
| `checkout_started` | POST /api/checkout called successfully (clientSecret returned) | `listing_id`, `total_cents`, `is_offer_based` (bool) |
| `checkout_completed` | Stripe `payment_intent.succeeded` webhook fires | `listing_id`, `total_cents`, `offer_id` (if applicable) |
| `offer_made` | Buyer submits an offer | `listing_id`, `amount_cents` |
| `offer_accepted` | Seller accepts an offer | `listing_id`, `amount_cents` |
| `comment_posted` | User posts a comment (LC or general) | `listing_id`, `thread_type` (lc/general), `redacted` (bool) |

## Planned dashboards

### Funnel: browse → listing → offer/buy

```
Step 1: $pageview where $pathname = '/browse'
Step 2: product_clicked
Step 3: $pageview where $pathname starts with '/listings/'
Step 4: offer_made OR checkout_started
Step 5: checkout_completed OR offer_accepted
```

Conversion questions to answer:
- What % of browse sessions result in a product click?
- What % of listing views convert to an offer or buy?
- Where does checkout drop off (started vs completed)?

### Listing CTR

Metric: `product_clicked / $pageview` (on browse page)
Segment by: filter state (dept, cat, sort)
Goal: identify which listing categories get most attention.

### Checkout abandonment

Metric: `checkout_completed / checkout_started`
Filter: is_offer_based = false, is_offer_based = true
Goal: identify whether offer-based checkout has higher completion rate.

### Time on listing

PostHog Page Leave event (or session replay) for `/listings/[id]` pages.
Correlate with `listing_saved` and `offer_made` to understand engagement.

## Where to fire missing events

The following events are NOT yet fired in the client components:
- `checkout_started` — fire in `app/checkout/page.tsx` after `POST /api/checkout` succeeds
- `checkout_completed` — fire server-side in webhook handler (or via PostHog server SDK)
- `offer_made` — fire in `ConversationView` after offer POST succeeds
- `offer_accepted` — fire in the accept offer handler
- `comment_posted` — fire in `CommunitySection` after comment POST succeeds

## PostHog setup checklist

1. Create project in PostHog (us.posthog.com)
2. Set `NEXT_PUBLIC_POSTHOG_KEY` and `NEXT_PUBLIC_POSTHOG_HOST` in Vercel env
3. Paste the PostHog JS snippet in `app/layout.tsx` (or use posthog-js npm)
4. Enable Session Replay in PostHog project settings
5. Create the funnels above in PostHog's Funnel insight builder
6. Set up Cohorts: buyers (offer_made at least once), sellers (listing_saved)
