# Bucket-1 build plan — features that need zero external infra

Everything here is build + `pnpm verify` + gate-subagent verifiable with **nothing live**.
Each item follows the same loop: **plan → prompt (execute on-computer) → acceptance tests
(prove the build matches the spec)**. All new user-facing behavior ships behind its
existing `lib/flags.ts` flag, default OFF, so partial work never affects production.

Gates (run via the AI subagents, not the shell): **db-guard** before any migration,
**code-reviewer** before committing any auth/money/RLS/webhook change, **ui-verifier**
for user-facing screens. `pnpm verify` (tsc + eslint + vitest) green before commit.

## Sequence (dependency-ordered) + rough effort

| # | Item | Flag | Why here | Gates | Rough effort* |
|---|------|------|----------|-------|--------------|
| 1 | G7 bump wiring | `BUMP_ENABLED` | Independent; core done; quick warm-up | db-guard, code-reviewer | 2–4 h |
| 2 | G9 follows + reviews | `FOLLOWS_ENABLED`, `REVIEWS_ENABLED` | Independent; **unblocks the ratings half of the risk trigger** | db-guard, code-reviewer | 4–6 h |
| 3 | G6 moderation console + audit | — | Independent; **unblocks the complaint half of the risk trigger** | db-guard, code-reviewer | 4–6 h |
| 4 | Risk → verification gate | `VERIFICATION_ENABLED` | Both signal sources (2 + 3) now exist | code-reviewer | 1–2 h |
| 5 | G5 authenticated badge | `AUTH_BADGE_ENABLED` | Independent trust feature | db-guard, code-reviewer, ui-verifier | 3–5 h |
| 6 | G8 saved-search matcher | `SAVED_SEARCH_ALERTS_ENABLED` | Pure matcher now; **dispatch deferred to G2** (needs email/push) | db-guard, code-reviewer | 2–4 h (core now, ~1 h) |
| 7 | G1 wiring steps 1–5 | `RECS_ENABLED` | Biggest; fail-soft; independent of the rest | code-reviewer | 6–10 h |

*Effort = focused AI-assisted on-computer time including the verify + gate loop and
fixes — not calendar time. **Total ≈ 22–37 h**, realistically spread over several
sessions. Variance drivers: UI polish + ui-verifier rounds (G5, G1 feed), RLS review on
the money-adjacent paths (G6 refund, G9 review-eligibility), and how much of G1's
telemetry hook you want (dwell tracking is the fiddly part).

Note: items 1, 3, 5, 6-core, and 7 are fully independent — parallelizable across
sessions. Only item 4 truly depends on 2 + 3 landing first.

---

## 1. G7 bump wiring  (spec: `docs/G7_bump.md`)
**Plan.** Turn the done `lib/bump/eligibility.ts` core into a live feature.
**Prompt.** Execute `docs/G7_bump.md`: `bumped_at` + `bumped_price_cents` migration
(db-guard) + ordering index; rate-limited `POST /api/listings/[id]/bump` (code-reviewer);
browse/feed `ORDER BY bumped_at DESC NULLS LAST, created_at DESC`; seller button; all
behind `BUMP_ENABLED`.
**Acceptance tests.** Endpoint returns 202 + sets `bumped_at` when eligible, 409/429 with
`nextEligibleAtMs` when not; a bumped active listing sorts above non-bumped; rate-limit
trips; `BUMP_ENABLED=false` ⇒ route no-ops and ordering ignores `bumped_at`. Unit-test the
route's eligibility branch against `bumpEligibility`.

## 2. G9 follows + reviews
**Plan.** Persist follows + post-transaction reviews; show aggregate rating (cores
`lib/reviews/{rating,eligibility}.ts` already done + tested).
**Prompt.** Add migrations (db-guard): `follows(follower_id, seller_id, created_at, UNIQUE)`
and `reviews(id, order_id, reviewer_id, subject_id, direction, stars 1..5, body, created_at,
UNIQUE(order_id, direction))` with RLS — a review may be inserted **only** by a party to a
`released` order, enforced in policy **and** re-checked server-side with `canLeaveReview`.
`POST /api/reviews` (validate stars + eligibility via `lib/reviews/eligibility`), profile
follow button + `POST /api/follows`, a feed of followed sellers' new listings, a
post-release review prompt, and aggregate rating (`aggregateRating`) on profile + cards.
code-reviewer on the review-eligibility gate.
**Acceptance tests.** Only a `released`-order party can review, once per direction (RLS +
handler both reject otherwise); rating aggregate matches `aggregateRating`; follow is
idempotent (UNIQUE); `REVIEWS_ENABLED=false` hides the prompt. Reuse the existing
`reviews.test.ts` for the pure layer; add a route test for the eligibility rejection.

## 3. G6 moderation console + audit  (spec: `docs/G6_trust_safety.md`)
**Plan.** Operationalize the done trust cores (`lib/trust/*`) into an admin console.
**Prompt.** Execute `docs/G6_trust_safety.md`: `moderation_actions` audit table
(append-only, service-role writes, admin SELECT — mirror `listing_flags`; db-guard);
one endpoint per verb (remove/restore/warn/ban/unban/refund/uphold_complaint/dismiss),
each writing one audit row; **refund flows the existing Stripe/order path, never mutates
amounts** (code-reviewer); run `scanListing` on publish; console UI over the queues.
`uphold_complaint` increments the seller's upheld-complaint count that feeds the risk eval.
**Acceptance tests.** Every action writes exactly one `moderation_actions` row; a
`prohibited-items` block hides the listing on publish while `review` queues it; refund
lands the order in the correct state via the money path; admin-only RLS denies non-admins.

## 4. Risk → verification gate
**Plan.** Wire `sellerRiskFlagged` (from `lib/trust/risk-signal.ts`) + the $5k volume
path into the actual sell/payout gate, now that G9 supplies ratings and G6 supplies the
upheld-complaint count.
**Prompt.** Where a seller lists / requests payout, resolve signals (trailing ratings via
`lib/reviews`, upheld-complaint count from G6, trailing sales via `lib/fee-tier`) and call
`sellerRequiresIdVerification(service, sellerId, { riskFlagged: sellerRiskFlagged(sig) })`.
On true, hold selling/payout pending Persona (the Persona webhook itself is bucket-2).
Behind `VERIFICATION_ENABLED`; code-reviewer (auth gating).
**Acceptance tests.** ≥$5k trailing sales OR risk flag ⇒ gate returns true; clean seller
⇒ false; a malicious buyer's un-upheld disputes never trip it; `VERIFICATION_ENABLED=false`
⇒ no gating. Unit-test the signal resolver assembly (mock the DB reads).

## 5. G5 authenticated badge + review flow  (spec: `docs/LAUNCH_ROADMAP.md` §G5)
**Plan.** AI/heuristic pre-screen (reuse phash + rules) → optional human review →
"Authenticated" badge; buyers filter for it.
**Prompt.** Migration (db-guard): `authentication_status`/`authenticated_at` on `listings`
+ a `listing_reviews` queue; extend `app/admin/queue` with an authentication review UI;
badge component on card + PDP; a browse filter. Auto-screen high-value/flagged listings
into the queue. Behind `AUTH_BADGE_ENABLED`. ui-verifier on the badge; code-reviewer on
the admin gate.
**Acceptance tests.** High-value/flagged listing enters the queue; approved listing shows
the badge; filter returns only authenticated; `AUTH_BADGE_ENABLED=false` hides it all.

## 6. G8 saved-search matcher  (core buildable now; dispatch → G2)
**Plan.** Pure `matchesSavedSearch(listing, query)` — does a newly published/updated
listing match a saved search's filter JSON? This is the cloud-verifiable core; alert
**dispatch** waits on G2 notifications.
**Prompt (core, now).** `lib/search/match.ts`: given a listing row + a saved-search
`query` (`{ q?, dept?, cat?, size?, brand?, min_price?, max_price?, cond?, verified?,
dropped? }`), return whether it matches — case-insensitive brand/category/size equality,
price range on `price_cents`, `dropped` ⇒ `is_price_dropped`, `verified` ⇒ auth badge,
`q` ⇒ substring over title/brand. **Prompt (wiring, after G2).** On listing
publish/update, match against `saved_searches` and dispatch via `lib/notify`; price-drop
alerts on saved listings.
**Acceptance tests.** Exact-match query matches; each filter narrows correctly; empty
query matches everything active; price bounds inclusive; unit table of (listing, query) →
expected. (I can build + verify this core in the cloud now — say the word.)

## 7. G1 wiring steps 1–5  (spec: `docs/prompts/G1_wiring.md`)
**Plan.** Wire the recs client into the app, all fail-soft behind `RECS_ENABLED`.
**Prompt.** Execute `docs/prompts/G1_wiring.md`: (1) listings sync via `lib/recs/listing-map`
on create/update/sold/delete; (2) telemetry batching hook → `/api/recs/events`; (3) feed
discovery route with default-order fallback; (4) cold-start aesthetic picker + seed;
(5) identity merge on login. code-reviewer on the `/api/recs/*` + feed handlers.
**Acceptance tests.** `RECS_ENABLED=false` ⇒ byte-identical to today (default order,
telemetry 202s empty, no feed calls); the mapper emits the right change per transition
(reuse `recs-listing-map.test.ts`); telemetry buffer flushes on size/timer/unload with one
device_id; feed falls back to default order on null. Live round-trip is the separate
one-time host check (bucket 2), not part of this.

---

## How I'll run this from the cloud
For each item I produce the **plan** (above) and the **acceptance tests**, and build any
**pure core** end-to-end here (cloud-verified: tsc + vitest) — like the bump/reviews/trust
cores already done. The **on-computer execution** (migrations, routes, UI) runs where
`pnpm verify` + the gate subagents live; I hand off the prompt + pre-written pure tests and
verify the returned diffs against this spec. Next cloud-buildable core on deck: **G8's
`matchesSavedSearch`** (item 6).
