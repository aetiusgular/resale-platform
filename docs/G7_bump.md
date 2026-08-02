# G7 — Bump / refresh listings  (`BUMP_ENABLED`)

Grailed-style free bump every 7 days, plus an early bump on a real ≥10% markdown, that
lifts an active listing back up browse/feed ordering.

## Already built + verified (cloud, pure logic — on branch)

- `lib/bump/eligibility.ts` — `bumpEligibility(input)` / `canBump(input)` and
  `priceDropPct()`. Deterministic (caller passes `nowMs`). Rule:
  `first_bump` (never bumped) → ok; `cooldown_elapsed` (≥7d since last bump) → ok;
  `price_drop` (within cooldown but ≥10% below the last-bump price) → ok; else
  `cooldown_active` with `nextEligibleAtMs`. The price-drop path is **self-limiting** —
  the reference resets to the new lower price each bump, so re-bumping early needs a
  fresh 10% off the reduced price.
- `tests/unit/bump.test.ts` — 10 tests (boundaries, self-limiting markdown, price
  increase never qualifies, fail-safe `priceDropPct`).

> Interpretation flag: the roadmap said "≥10% price drop to re-bump after 30 days." I
> implemented the compounding-markdown model (no 30-day timer/column needed). If you'd
> rather the price-drop path open only for listings older than 30 days, that's a
> one-line age gate in the caller — tell me and I'll add it.

## On-computer build

### 1. Migration (db-guard)
- Add to `listings`: `bumped_at TIMESTAMPTZ` (nullable), `bumped_price_cents INT`
  (nullable, the price snapshot at last bump — feeds the price-drop path).
- Index for bump-aware ordering: `CREATE INDEX listings_status_bumped_idx ON listings
  (status, bumped_at DESC NULLS LAST, created_at DESC)`. Keep the existing
  `listings_status_created_idx` for the flag-off path.

### 2. Bump endpoint — `POST /api/listings/[id]/bump`
- `getUser()`; confirm the caller owns the listing and it's `status = 'active'`.
- Resolve `priceAtLastBumpCents` from `bumped_price_cents` (or `price_cents` on first
  bump), then call `bumpEligibility({ nowMs: Date.now(), bumpedAtMs, currentPriceCents:
  price_cents, priceAtLastBumpCents })`. On `ok`, set `bumped_at = now()` and
  `bumped_price_cents = price_cents`; on `!ok`, return 429/409 with `nextEligibleAtMs`.
- **Rate-limit it** (reuse `lib/rate-limit.ts`) — the eligibility rule is the policy,
  the limiter is the abuse backstop. code-reviewer on the endpoint.
- Write behind `BUMP_ENABLED`: when false, the route is a no-op/404 and ordering
  ignores `bumped_at`.

### 3. Ordering
- Browse/feed sort: `ORDER BY bumped_at DESC NULLS LAST, created_at DESC` for active
  listings (uses the new index). Platform must be unchanged with `BUMP_ENABLED=false`
  (fall back to `created_at DESC`).
- When `RECS_ENABLED`, don't hard-sort by bump — pass `bumped_at` as a freshness
  signal into the feed (per G1), so recs ordering stays authoritative.

### 4. Seller UI
- A "Bump" button on the seller's own active listing / listing-management view.
  Disabled with a tooltip when `!ok` ("Next free bump {relative time}, or drop the
  price 10% to bump now"). ui-verifier on the button states.

## Acceptance
- First bump works; a second within 7 days is refused unless price dropped ≥10% from
  the last-bump price; free bump returns after 7 days. Bumped listing sorts above
  non-bumped active listings. Endpoint rate-limited. `BUMP_ENABLED=false` → no behavior
  change. `pnpm verify` green; db-guard on the migration; code-reviewer on the endpoint.
