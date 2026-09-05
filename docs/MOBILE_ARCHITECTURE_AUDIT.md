# MOBILE_ARCHITECTURE_AUDIT.md — what the web app is, seen from a native client

Audited 2026-09-05 against `main` at `459b1c0` (PR #3 mobile-web merged). Purpose: decide what
the backend must expose so a native iOS (and later Android) client keeps 100% of the browser's
functionality. Companion: `docs/MOBILE_PLAN.md` (decisions + phases), `docs/prompts/M1_*.md`
(build prompt).

## 1. Shape of the web app

Next.js 15 App Router, React 19, TypeScript strict. Supabase Postgres with RLS on every table,
Stripe Connect (separate charges and transfers), EasyPost labels, Twilio Verify, Stripe Identity,
web-push. 39 pages, 79 API route files, 46 migrations, 31 tables, 1 view, 14 RPCs.

Three access patterns, and they matter for a native port:

1. **Mutations already go through HTTP.** There are no server actions. Every write the browser
   performs is a `fetch('/api/...')` to one of the 79 route files. A native client can call all
   of them today, subject to auth (see §3).
2. **Reads happen inside React Server Components.** Pages call Supabase directly during render:
   the cookie-scoped client for RLS-protected rows, and the service-role client for anything RLS
   hides (own profile PII after migration 0044, seller stats, `buyer_stats`, sold listings a buyer
   may no longer see, tier resolution). Fifteen page files use the service-role client. None of
   these reads is reachable from outside the page render.
3. **Three browser-only side channels.** The browser uses Supabase directly for auth (email +
   password, Google/Apple PKCE, password reset), for one Realtime channel (`messages` INSERT per
   conversation), and for Storage uploads to `product-images` (listing photos, avatars, dispute
   evidence, review photos). Stripe.js runs card Elements + `confirmCardPayment` against a
   PaymentIntent client secret.

## 2. Inventory of user-facing screens and their data

| Route | Auth | Server reads (client → tables/RPCs) | Browser calls |
|---|---|---|---|
| `/browse` | public, page 1 only for guests | cookie: `listings` rows + exact count + full facet scan + sold count, `price_history`, `saves`, `profiles(sizes, hide_not_my_size)`; recs feed (fail-soft), boost hoist | `GET /api/browse` (members only), `POST/DELETE /api/saves`, `POST /api/listings/{id}/bump`, `POST /api/saved-searches`, `POST /api/recs/events`, `PUT /api/settings/sizes` |
| `/listings/[id]` | public (active + sold) | cookie: `listings` (+seller join), viewer `profiles`, `saves`, `price_history`, `follows`, `comments` LC tally; **service**: `getSellerStats` → `orders`, `reviews`, `listings` | `POST /api/listings/{id}/view`, saves, `POST /api/conversations`, bump, `GET/POST /api/listings/{id}/comments`, agree/flag, `POST/DELETE /api/follows` |
| `/sellers/[username]` | public | **service** for everything about the seller: `profiles`, `orders`, `buyer_stats`, `listings`, `reviews`, `moderator_recommendations`; cookie for viewer + `follows` | saves, follows, `POST /api/moderators/recommend` |
| `/saved` | session | cookie: `saves`+`listings`+seller, `saved_searches` (+10 count queries for "n NEW"), `follows`+`profiles`, `price_history`, `listings` new-this-week per seller; **service**: seller stats | `POST /api/saves/visit`, `DELETE /api/saves`, `PATCH/DELETE /api/saved-searches/{id}`, follows |
| `/messages` | session | cookie: `conversations` (+listing, buyer, seller), RPC `unread_conversation_counts`, `messages` preview sweep; `?listing=` creates a conversation **during render** with the service client | none |
| `/messages/[id]` | session | cookie: `conversations`, `messages`, `offers`, RPC `mark_conversation_read`; **service**: `listings`, both `profiles`, `buyer_stats`, latest `orders`, seller stats | Realtime `messages` INSERT; `POST .../messages`, `POST .../offers`, accept/decline/counter, `PATCH .../consent`, `POST .../report`, `POST .../read` |
| `/notifications` | session | `getViewer()` | `GET /api/notifications`, `POST /api/notifications/read` |
| `/sell` | session | cookie: `profiles`, own `listings` (200), open `offers`; **service**: sold `orders` payouts, `resolveEffectiveBps` | bump, `POST /api/listings/{id}/relist`, `DELETE /api/listings/{id}` |
| `/sell/new` | session | **service**: ID-verification gate (`sellerMustVerify`), `resolveEffectiveBps`; cookie: `profiles`, one `listings` row for `?edit=`/`?draft=` | Storage upload `listings/{uid}/{listingId}/{slot}.jpg`; `POST /api/listings/drafts`, `PATCH /api/listings/{id}`, `POST /api/listings` |
| `/checkout/[listingId]` | session | cookie: `listings`, `profiles(shipping_address)`; **service**: seller bps; fee preview via `orderAmountsAt` | `POST /api/checkout` on mount → `{clientSecret, orderSummary}`; Stripe.js `confirmCardPayment`; then `GET /api/orders/by-intent` |
| `/orders/[id]` | session, party or admin | cookie: `orders`, viewer + seller `profiles`; **service**: `reviews`, `listings`, `buyer_stats` | `POST /api/orders/{id}/confirm|ship|deliver`, `POST /api/reviews` |
| `/orders/[id]/dispute` | session | cookie `profiles` | Storage upload dispute evidence; `POST /api/orders/{id}/dispute` |
| `/boost/[listingId]` | session, flag | cookie: own `listings`, `profiles`; bump eligibility | `POST /api/boosts` → `{clientSecret}`; Stripe.js |
| `/settings/*` (one shell) | session | **service**: own `profiles` row (PII columns), `getTierDashboard`; cookie: `notification_prefs`, `orders` (badge + lists), `addresses`, `reviews`, counterparties | `PATCH /api/settings/profile`, avatar upload, `POST /api/account/delete`, addresses CRUD, `PUT /api/settings/sizes`, `PUT /api/notifications/prefs`, `GET /api/stripe/balance`, `GET /api/stripe/connect` (302), `POST /api/reviews`, `POST /api/phone/start|verify` |
| `/onboarding/account` | public | client page | browser `auth.getUser()`, `profiles` select + **client-side insert** |
| `/onboarding/setup` | session | client page | `profiles.update(quick_setup)`, `PUT /api/settings/sizes`, `GET /api/recs/aesthetics`, `POST /api/recs/seed` |
| `/onboarding/verify` | session | cookie `profiles(id_verification_status)` | `GET /api/idv/start` (302 to Stripe Identity) |
| `/enter`, `/enter/login`, `/enter/forgot`, `/reset-password` | public | none | browser `auth.signUp` (+ client-side `profiles.insert`), `signInWithPassword`, `signInWithOAuth`, `resetPasswordForEmail`, `updateUser` |
| `/about /help /trust /fees /terms /privacy` | public | static content + `lib/fees`, `lib/boosts`, `lib/shipping` constants | none |
| `/admin/*` | admin | service-role queues | admin POST routes |

Shared chrome: `header-actions.tsx` calls `GET /api/notifications` on mount and
`GET /api/conversations/unread` on every navigation; `push-subscribe.tsx` registers a web-push
subscription; theme lives in `localStorage['archive-theme']`.

## 3. Authentication model

Sessions are minted in the browser by `@supabase/ssr`, stored in chunked
`sb-<ref>-auth-token` cookies, and refreshed by the middleware. Every protected route repeats the
same prologue: `createClient()` (cookie client) → `getUser()` (server round trip) → 401. There
is no shared helper. Additional layers per route: RLS through the caller's client, SECURITY
DEFINER RPCs with their own checks, service-role escalation after an explicit ownership check,
`isBanned()` on 11 write routes, hand-rolled admin role checks on 17 admin routes.

**No route accepts `Authorization: Bearer <token>`.** The only inbound bearer checks are the
three cron routes comparing against `CRON_SECRET`. The middleware early-returns for `/api/*`, so
API routes get no session refresh, no CSP, and no ban redirect; each defends itself. A native
client sending a Supabase access token gets 401 on every authenticated route today.

Onboarding enforces exactly one thing: a `profiles` row must exist (the browser creates it after
signup). Sizes, aesthetics, phone, and ID verification are optional until the sell gate
(`POST /api/listings`) and the payout gate (`/api/stripe/connect`) require verification for
risk-flagged or ≥$5k trailing-volume sellers.

## 4. Payments, identity, shipping, push

- **Checkout** is PaymentIntent-based: `POST /api/checkout {listingId, offerId?, shippingAddress?}`
  locks the listing (`pending_escrow`, 30-minute sweep) and returns `{clientSecret, orderSummary}`.
  The browser confirms with card Elements. The webhook creates the order and never trusts the
  client. Stripe's iOS PaymentSheet consumes the same client secret unchanged. The web calls
  `/api/checkout` on mount, which locks the listing before the buyer commits; a native client
  should defer that call to the moment of payment.
- **Boosts**: `POST /api/boosts {listingId, package}` → `{clientSecret, amountCents}`. Same pattern.
- **Stripe Connect onboarding** and **Stripe Identity** are 302 redirects to hosted URLs
  (`GET /api/stripe/connect`, `GET /api/idv/start`) with return URLs pointing at web pages. A
  native client needs JSON variants and return URLs it can intercept.
- **Shipping labels** are bought server-side on seller confirm (EasyPost, fail-soft). The seller
  never buys a label from the client. `POST /api/orders/{id}/ship` accepts `{}` when a label exists.
- **Push** is web-push only: `push_subscriptions(endpoint, p256dh, auth)` + VAPID. APNs needs a
  device-token table and a sender. The 17 notification kinds and their deep-link URLs are already
  defined in `lib/notify/types.ts` + `templates.ts`; the app maps those URLs to screens.
- **Phone**: Twilio Verify via `POST /api/phone/start|verify` (flag-gated).

## 5. Data-layer facts that constrain the client

- Rows open to all authenticated users: `profiles` (column-restricted, PII revoked in 0044),
  `listings` (active + sold), `price_history`, `comments`, `comment_actions`, `follows`, `reviews`.
  Everything else is owner/participant/admin scoped. `buyer_stats` is service-role only.
- Money is integer cents everywhere. Buyers pay no platform fee (Fee Model v3). Seller tiers
  350/550/700/800 bps with a 10-sale welcome ramp at 0%. Rates are resolved server-side and
  snapshotted at PaymentIntent creation; clients display only what the server returns.
- Order state machine: `paid_held → seller_confirmed → shipped → delivered → released`, with
  `disputed` (72h window) and `refunded`/`cancelled` terminals, all driven by `transition_order()`.
  Offers: 24h expiry, recipient-only accept/decline/counter, one open offer per user per thread.
- `lib/supabase/types.ts` is stale (pre-0043/0045): missing `addresses`, `conversation_reads`,
  `reports`, four RPCs. Regenerate before generating any client model from it.
- Storage: one public bucket `product-images`, 10 MB, jpeg/png/webp, write prefixes
  `listings/{uid}/…` and `avatars/{uid}/…`.
- Feature flags (`lib/flags.ts`, all default off) turn whole routes into 404s. The client must
  treat 404 on a flagged route as "feature off", not "not found".

## 6. Gaps: reads a native client cannot perform today

Twenty RSC reads have no API equivalent. Grouped by the screen they serve:

1. Browse page 1 with facets, exact count, sold count, MY SIZES resolution, boost/recs ordering
   (`GET /api/browse` is members-only and returns only `{listings, hasMore, savedIds}`).
2. Listing detail bundle (no `GET /api/listings/[id]`).
3. Seller profile (no API).
4. Saved hub: items, searches with "n NEW", followed sellers (no API).
5. Inbox rows with unread counts and previews (`GET /api/conversations` returns raw rows).
6. Thread bundle: conversation, listing snapshot, counterparty, offers list, order timeline
   (only `GET .../messages` exists; no offers GET).
7. Conversation-by-listing redirect contract (`/messages?listing=`); `/messages?seller=` is
   unhandled on web too.
8. Order detail (no `GET /api/orders/[id]`).
9. Settings bundle: own profile incl. PII columns, prefs, active-order count, tiers, orders lists,
   review eligibility (no `GET /api/settings/profile`).
10. Seller catalog with offers and payouts (`GET /api/listings/drafts` covers drafts only).
11. New/edit listing prefill and the seller verification gate.
12. Checkout preview without creating a PaymentIntent.
13. Boost state and free-bump eligibility.
14. Verification status (`/api/idv/start` only redirects).
15. Ban reason.
16. Viewer identity for app chrome (`username`, `display_name`, `avatar_url`).
17–19. Admin queue, moderation console, metrics (web-only by decision, see MOBILE_PLAN §6).
20. Sitemap feed (not needed by the app).

Plus three contract mismatches: profile creation happens client-side after signup; Connect and
Identity return 302s; push is web-push only.

## 7. What this means

The backend is already an API for writes and a page renderer for reads. Native parity does not
require a second backend. It requires (a) bearer-token auth on the existing routes, (b) the RSC
read paths extracted into loaders that both the pages and new GET routes call, so parity holds by
construction, (c) JSON variants of the two redirect endpoints plus interceptable return URLs,
(d) an APNs device registry and sender beside web-push, and (e) a written contract
(`docs/api/openapi.yaml`) the iOS and Android clients are built against.
