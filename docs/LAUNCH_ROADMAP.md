# LAUNCH_ROADMAP.md — path from current state to launch

Single source of truth for the remaining build program. Each phase is built the
same way: **one verified phase at a time, on a branch, through the gates** — never
a blind megachange. Ordered by launch priority. Founder-only items at the bottom.

## Conventions (every phase)

- **Branch:** `feat/<phase-id>` off `main`.
- **Flag:** new user-facing behavior ships behind a `lib/flags.ts` flag, default
  OFF, so partial work never affects production. Platform must stay fully
  functional with every new flag false.
- **Gates (run via the AI, not the shell — they are `.claude/agents/` subagents):**
  - `db-guard` — before pushing ANY migration.
  - `code-reviewer` — before committing ANY auth / money / RLS / webhook change.
  - `ui-verifier` — for user-facing screens (screenshot vs `design-reference/`).
- **Verify:** `pnpm verify` (tsc + eslint + vitest) green before commit;
  `pnpm build` green before merge. `pnpm verify` runs NATIVELY on the Mac — the
  cloud device bridge is a Linux VM and cannot run the Mac-native toolchain.
- **Money rule:** integer cents only; fee math from `lib/fees.ts` only; fee rate
  resolved server-side and snapshotted into the order — never recompute a
  historical order's fee.

## Phase index

| ID | Phase | Flag | Gates | Status |
|----|-------|------|-------|--------|
| F1 | Tiered fee math | — | code-reviewer | ✅ done (27 tests) |
| F2 | Fee resolver + indexes | — | db-guard, code-reviewer | ✅ built (this branch) |
| F3 | Wire tiered fees (checkout + display) | — | db-guard, code-reviewer, ui-verifier | money core done; displays next (Step 4) |
| G1 | recs-engine integration | `RECS_ENABLED` | code-reviewer | pending |
| G2 | Notifications (email + push) | `NOTIFICATIONS_ENABLED` | code-reviewer | pending |
| G3 | Shipping: carrier delivery webhook | `SHIPPING_LABELS_ENABLED` | db-guard, code-reviewer | PARTIAL — tracking capture built |
| G4 | ID-verification provider | `VERIFICATION_ENABLED` | db-guard, code-reviewer | pending |
| G5 | Authenticated badge + review flow | `AUTH_BADGE_ENABLED` | db-guard, code-reviewer | pending |
| G6 | Trust & safety / moderation ops | — | code-reviewer | pending |
| G7 | Bump / refresh listings | `BUMP_ENABLED` | db-guard, code-reviewer | pending |
| G8 | Saved-search alerts | `SAVED_SEARCH_ALERTS_ENABLED` | db-guard, code-reviewer | PARTIAL — storage/save built; needs G2 |
| G9 | Follows + seller reviews/ratings | `FOLLOWS_ENABLED`, `REVIEWS_ENABLED` | db-guard, code-reviewer | pending |

---

## Scope verification (2026-07-26, against live schema + routes)

- **G3 shipping — PARTIAL.** `orders.carrier`/`tracking_number`/`shipped_at` + `POST
  /api/orders/[id]/ship` (seller enters carrier+tracking) already exist. Remaining:
  carrier delivery webhook (shipped→delivered → feeds 3-day auto-release); optional label purchase.
- **G8 saved-search alerts — PARTIAL.** `saved_searches` table + `POST /api/saved-searches`
  exist (route notes "notifications are PA"); `price_history` table exists for price-drop
  detection. Remaining: matcher + alert dispatch (via G2).
- **Reuse infra:** `price_history` (price-drop + bump's ≥10%-drop rule), `buyer_strikes` +
  `disputes` + `listing_flags` + admin queue (T&S / G6), `saves` (favorites).
- **Confirmed greenfield:** G1 recs, G2 notifications, G5 auth badge, G7 bump, G9 follows/reviews
  (no follows / reviews / notifications tables exist).

---

## F3 — Wire tiered fees into checkout + display  ▶ NEXT

**Scope.** Switch the live money path and every fee display from flat 2% to the
per-side tiered rate. Ship checkout + display together (never charge a rate the
UI didn't show).

**Files.**
- `app/api/checkout/route.ts` — resolve `feeBpsForUser(service, user.id, 'buyer')`
  and `feeBpsForUser(service, listing.seller_id, 'seller')`; call
  `orderAmountsAt(price, buyerBps, sellerBps, offerId ? 0 : undefined)`; add
  `buyer_fee_bps` / `seller_fee_bps` to Stripe metadata + `checkout_sessions`
  snapshot for audit (needs a small migration to add the two bps columns).
- `app/api/webhooks/stripe/route.ts` — persist the snapshotted bps onto the order.
- Migration `..._fee_bps_snapshot.sql` — add `buyer_fee_bps`/`seller_fee_bps INT`
  to `orders` + `checkout_sessions` (db-guard).
- Display sites (~20) — replace `buyerFee(price)` / `sellerFee(price)` /
  `orderAmounts(price)` with the `*At` variants, passing the VIEWER's resolved
  rate. Server components resolve via `feeBpsForUser`; pass rate as a prop into
  client components (`checkout-client.tsx`, `sell-form.tsx`, `listing-card.tsx`,
  order pages, etc.). Show "your fee: X% (tier)".
- Remove the legacy flat `sellerFee`/`buyerFee`/`orderAmounts` + `*_FEE_BPS`
  exports once all callers pass a rate; update `fees.test.ts`.
- Sell-form: show seller's live payout at their tier; add a "fees drop as you
  sell more" affordance linking to the tier table.

**Acceptance.** `pnpm verify` green; a tier-1 buyer sees/pays 2.5% and a base
seller sees/pays 5.5% on the same order; snapshot immutable post-payment;
fee shown == fee charged; ui-verifier passes on checkout + sell + listing.

**Kickoff prompt.**
> On branch `feat/tiered-fees`, wire the tiered fee model into the live path.
> Resolve buyer/seller rates with `feeBpsForUser` (lib/fee-tier.ts) in
> `app/api/checkout/route.ts` and use `orderAmountsAt`. Add `buyer_fee_bps`/
> `seller_fee_bps` columns to `orders` + `checkout_sessions` (new migration —
> run db-guard). Refactor all ~20 fee display call-sites to pass the viewer's
> resolved rate (server components resolve; client components receive it as a
> prop) and show the user their tier %. Remove the legacy flat fee fns once no
> caller needs them. `pnpm verify` green, run code-reviewer on the money diff and
> ui-verifier on checkout/sell/listing before committing. Ship checkout + display
> in ONE commit so displayed fee always equals charged fee.

---

## G1 — recs-engine integration  (`RECS_ENABLED`)

**Scope.** The original integration task: typed client, telemetry (HMAC-signed
server-side), listings sync, feed-driven discovery, cold-start aesthetics,
identity merge. Full contract + step list in the recs-engine task spec; source at
`~/Documents/Claude/Projects/agora/recs-engine/`. Requires running recs-engine
locally (docker: redis+qdrant, two uvicorn APIs) — do this in an on-computer
session so it can run + observe.

**Files.** `lib/recs/` (client + types), `app/api/recs/events/route.ts` (HMAC
proxy), telemetry batching hook, listings-sync on create/update/sold/delete,
discovery route → `GET /v1/feed`, aesthetic picker + seed, identity merge on
login. Two recs-engine adapters on a recs-engine branch (http photo loading;
`POST /v1/listings` webhook if missing).

**Acceptance.** With `RECS_ENABLED=false` platform unchanged. With it true against
a local recs-engine: telemetry lands (Redis `events:raw`), listings appear as
Qdrant points, feed renders in returned order with "because you like…" chips,
fail-soft to default order when recs-engine is down. Client unit tests + one
integration test round-trip.

**Kickoff prompt.**
> Run this ON YOUR COMPUTER (needs docker + local servers). Integrate recs-engine
> into resale-platform behind `RECS_ENABLED` per the full task spec. Start
> recs-engine in stub mode (redis+qdrant via docker, ingest:8000, feed:8001),
> verify the contract against its source, then build `lib/recs/` + the HMAC
> telemetry proxy + listings sync + feed discovery + cold-start + identity merge.
> Keep the HMAC secret and feed token server-side only. Test end-to-end through
> the UI and DB (Supabase → Qdrant points, telemetry → Redis, feed ordering,
> fail-soft). `pnpm verify` green; code-reviewer on the route handlers.

---

## G2 — Notifications: email + push  (`NOTIFICATIONS_ENABLED`)

**Scope.** Transactional notifications for the events that drive a marketplace:
new offer / offer accepted / sale / shipped / delivered / new message / dispute.
Email (transactional provider) + web push; user preferences.

**Files.** `lib/notify/` (provider adapters, templates, dispatch), migration for
`notification_prefs` + `notifications` (in-app inbox) with RLS, triggers/hooks at
each event (offer accept, order state transitions, message insert), a settings
pane, service-worker for push.

**Acceptance.** Off by default. On: each event delivers to opted-in channels;
prefs respected; no secrets client-side; unsub honored. db-guard on migration.

**Kickoff prompt.**
> Build notifications behind `NOTIFICATIONS_ENABLED`. Add `lib/notify/` with an
> email provider adapter + web-push, an in-app `notifications` table + prefs
> table (RLS, run db-guard), and dispatch hooks on offer-accept, order state
> transitions, and new message. Add a notification-settings pane. Provider keys
> server-side only. `pnpm verify` green; code-reviewer on the dispatch + webhook.

---

## G3 — Shipping labels + tracking  (`SHIPPING_LABELS_ENABLED`)

**Scope.** Seller buys/prints a label (or enters tracking); tracking number ties
into seller protection + order state. Grailed requires tracking for seller
protection — mirror that.

**Files.** `lib/shipping/` (provider adapter — e.g. EasyPost/Shippo), migration
adding `tracking_number`/`carrier`/`label_url` to `orders` (db-guard), UI on the
seller order page to buy/enter tracking, webhook to advance `shipped`→`delivered`
on carrier delivery events, tie into the 3-day auto-release.

**Acceptance.** Off by default. On: seller can attach tracking; delivery event
advances state; auto-release still correct. db-guard on migration.

**Kickoff prompt.**
> Build shipping/tracking behind `SHIPPING_LABELS_ENABLED`. Add `lib/shipping/`
> provider adapter, migration adding tracking/carrier/label columns to `orders`
> (db-guard), seller UI to purchase/enter a label, and a carrier webhook that
> advances order state to delivered (feeding the existing 3-day auto-release).
> Keys server-side only. `pnpm verify` green; code-reviewer on the state
> transitions + webhook.

---

## G4 — ID-verification provider  (`VERIFICATION_ENABLED`)

**Scope.** Wire a real IDV provider behind the existing verification gate (buy/
sell/comment already gated; provider currently stubbed off). Also satisfies
Stripe Connect KYC linkage.

**Files.** `lib/idv/` provider adapter + webhook, migration for
`verification_status`/`verified_at` on profiles + an events table (db-guard),
onboarding flow, gate enforcement already present via `VERIFICATION_ENABLED`.

**Acceptance.** Off by default. On: user completes IDV, status persists via
signed webhook, gates unlock only on verified. db-guard + code-reviewer (touches
auth gating).

**Kickoff prompt.**
> Wire a real ID-verification provider behind `VERIFICATION_ENABLED`. Add
> `lib/idv/` adapter + signed webhook, migration for verification status on
> profiles (db-guard), and the onboarding flow. Enforce the existing buy/sell/
> comment gate off verified status via a server-side DB check. Secrets server-
> side only. code-reviewer required (auth gating). `pnpm verify` green.

---

## G5 — Authenticated badge + review flow  (`AUTH_BADGE_ENABLED`)

**Scope.** A trust artifact for high-value grails: AI/heuristic pre-screen
(reuse `phash` + rules) + optional human review → "Authenticated" badge on the
listing. Buyers filter for it.

**Files.** Migration adding `authentication_status`/`authenticated_at` to
`listings` + a `listing_reviews` queue (db-guard), admin review queue UI (extend
`app/admin/queue`), badge component, listing-card + PDP badge display, filter.

**Acceptance.** Off by default. On: high-value/flagged listings enter the queue;
approved listings show the badge; filter works. db-guard on migration.

**Kickoff prompt.**
> Build the Authenticated badge + review flow behind `AUTH_BADGE_ENABLED`. Add an
> authentication status to `listings` + a review queue table (db-guard), an admin
> review UI (extend app/admin/queue), and badge display + filter on cards/PDP.
> Reuse phash + heuristics for auto-screening. `pnpm verify` green; ui-verifier on
> the badge; code-reviewer on the admin gate.

---

## G6 — Trust & safety / moderation ops

**Scope.** Operationalize what exists (phash, message/comment filters, listing
flags, LC checkers): a moderation dashboard, action tooling (remove/ban/refund),
prohibited-items rules, an appeals path, and audit logging. This is ops + tooling,
not one feature.

**Kickoff prompt.**
> Build a moderation console (extend app/admin) over the existing flags/filters:
> queues for flagged listings/messages/comments/users, one-click actions
> (remove, warn, ban, refund) all writing an audit log, prohibited-items ruleset,
> and an appeals inbox. code-reviewer on any action that touches money/auth/RLS.

---

## G7 — Bump / refresh listings  (`BUMP_ENABLED`)

**Scope.** Grailed-style free bump every 7 days (or ≥10% price drop to re-bump
after 30 days) that lifts a listing in browse/feed ordering.

**Files.** Migration adding `bumped_at` to `listings` + bump-eligibility (db-guard),
`POST /api/listings/[id]/bump` with the eligibility rule, browse/feed ordering
factors in `bumped_at`, seller UI button. When `RECS_ENABLED`, feed the bump as a
freshness signal rather than a hard sort.

**Kickoff prompt.**
> Build bump/refresh behind `BUMP_ENABLED`. Add `bumped_at` to `listings`
> (db-guard), a bump endpoint enforcing the 7-day / ≥10%-drop rule, browse/feed
> ordering by bump recency, and a seller button. `pnpm verify` green; code-reviewer
> on the endpoint (rate-limit it).

---

## G8 — Saved searches + alerts  (`SAVED_SEARCH_ALERTS_ENABLED`, needs G2)

**Scope.** Persist a search + filters; notify (via G2) when a new matching
listing is posted; price-drop alerts on saved items.

**Kickoff prompt.**
> Build saved-search alerts behind `SAVED_SEARCH_ALERTS_ENABLED` (depends on G2
> notifications). Extend the existing search-saves table with alert prefs
> (db-guard), match new/updated listings against saved searches on publish, and
> dispatch via lib/notify. Add price-drop alerts for saved listings. `pnpm verify`
> green; code-reviewer on the matcher.

---

## G9 — Follows + seller reviews/ratings  (`FOLLOWS_ENABLED`, `REVIEWS_ENABLED`)

**Scope.** Follow sellers (feeds their new listings); post-transaction buyer→seller
reviews + aggregate rating shown on profile/cards. (`seller_rating` already
referenced in the recs payload — confirm/複用.)

**Kickoff prompt.**
> Build follows + reviews behind `FOLLOWS_ENABLED` / `REVIEWS_ENABLED`. Add
> `follows` + `reviews` tables (RLS; reviews only from a completed order between
> the two parties — enforce in policy; db-guard), profile follow button + feed of
> followed sellers' listings, post-release review prompt, aggregate rating on
> profile/cards. `pnpm verify` green; code-reviewer on the review-eligibility gate.

---

## Founder-only (not agent-buildable)

- [ ] Pick final name + register domain (repo is `resale-platform`; never "Agora").
- [ ] Legal entity + Terms of Service + Privacy Policy (marketplace handling payments).
- [ ] Stripe LIVE cutover — live keys are HUMAN-ONLY per docs/LAUNCH.md. No real money moves until this.
- [ ] Seed the 24 founder invites from USER_FEEDBACK.md §6.
- [ ] Turn on the flags above, in order, once each phase is verified + reviewed.
