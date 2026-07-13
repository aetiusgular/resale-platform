# HANDOFF.md
## Current state: B4 COMPLETE

**Last updated:** 2026-07-13
**Next prompt:** B5 — Checkout + escrow + seller protection (M5 + M5b)

---

## What was done in B4

1. **`supabase/migrations/20240101000008_search_saves.sql`** — Schema additions:
   - `profiles.sizes JSONB` — per-user size preferences
   - `listings.department TEXT CHECK(IN('menswear','womenswear','unisex'))`, `listings.search_vector TSVECTOR GENERATED ALWAYS AS (setweight(…A) || setweight(…B) || setweight(…C)) STORED`, `listings.saves_count INT DEFAULT 0`, `listings.is_price_dropped BOOLEAN DEFAULT FALSE`
   - `price_history` table (listing_id FK, old_price_cents, new_price_cents) + AFTER UPDATE trigger `record_price_change()` (SECURITY DEFINER). Anon SELECT grant (price drops are public info).
   - `saves` table (user_id FK, listing_id FK, unique constraint) + AFTER INSERT/DELETE trigger `update_saves_count()` (SECURITY DEFINER, bumps `listings.saves_count`)
   - `saved_searches` table (user_id FK, query JSONB). Authenticated-only INSERT/SELECT.
   - All tables: RLS ON, explicit grants, FK indexes.

2. **`lib/analytics.ts`** — PostHog wrapper: no-op when `NEXT_PUBLIC_POSTHOG_KEY` absent or SSR. Events: `$pageview`, `product_clicked`, `filter_applied`, `search_performed`, `listing_saved`.

3. **`app/browse/page.tsx`** — Server Component. Reads `await searchParams`, applies all filters (q, dept, cat, size, brand, min/max price, cond, verified, dropped, sort), fetches first page + hasMore, filter counts, user saves, profile sizes, total count. Renders `<Suspense><BrowseClient/></Suspense>`. Full-text via `textSearch('search_vector', q, { type: 'websearch', config: 'english' })`. PAGE_SIZE=24.

4. **`app/browse/browse-client.tsx`** — `'use client'`. FilterRail (MY SIZES, DEPARTMENT, CATEGORY, SIZE, DESIGNER, PRICE, CONDITION, SELLER LOCATION, SHOW ONLY, FOLLOWED SEARCHES). 4-col desktop / 2-col mobile grid. Mobile full-screen drawer. Sort dropdown. URL-driven state via `useRouter().push()` + `useTransition()`. Optimistic save toggle. Load more via `/api/browse?offset=…`. Follow-search via `/api/saved-searches`. Empty state: EB Garamond italic.

5. **`app/api/browse/route.ts`** — GET handler for cursor/offset pagination. Auth check via `getUser()`. Returns `{ listings, hasMore, savedIds }`.

6. **`app/api/saves/route.ts`** — POST/DELETE. Auth check. POST handles `23505` unique_violation as success (idempotent).

7. **`app/api/saved-searches/route.ts`** — POST. Auth check. Validates query values are flat strings (no PII, no nested objects).

8. **`app/api/dev/seed/route.ts`** — Dev-only (403 in non-development NODE_ENV). Generates 30 fixture listings with sharp SVG→PNG placeholder images. Idempotent (checks for existing `[SEED]` titles). Inserts price_history row + sets `is_price_dropped=true` for "priceWas" fixtures.

9. **`app/page.tsx`** — Simplified: authenticated → redirect `/browse`, else redirect `/enter`.

10. **`app/listings/[id]/page.tsx`** — Added `saves_count`, `is_price_dropped`, `original_price_cents` (from price_history), `isSaved`. Enhanced `generateMetadata()` with OpenGraph + Twitter Card. Price-drop strikethrough. "LISTED X AGO · N SAVED" meta + `<SaveButton>`.

11. **`app/listings/[id]/save-button.tsx`** — `'use client'`. Optimistic SAVED/SAVE toggle. Calls `/api/saves`. Tracks `listing_saved` event.

12. **`tests/e2e/browse.spec.ts`** — Non-@live: redirect checks, API 401 checks, SSR listing title (skips without SEED_LISTING_ID).

13. **`tests/e2e/browse-live.spec.ts`** — @live: filter/search/sort, cond=7, dropped=1, price-drop badge, save toggle persists, follow-search row, RLS (saves/saved_searches not anon-readable), SSR HTML checks.

---

## Verify state (as of B4 close)

```
pnpm verify      ✓  54 tests (unchanged unit tests) + 0 ESLint errors
pnpm build       ✓  22 routes, 0 errors
pnpm verify:ui   ✓  25 Playwright tests passed, 1 skipped (SSR listing title — needs SEED_LISTING_ID)
Migration 000008 ✓  pushed to remote
db-guard         ✓  APPROVED — department CHECK, SECURITY DEFINER triggers, deny-all price_history write
code-reviewer    ✓  SAFE TO COMMIT — 0 HIGH, 2 MEDIUM (tracked below), 5 LOW (tracked below)
```

---

## Blockers

None.

---

## Session start ritual for B5

```
Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.
```

---

## File inventory (key files added/modified in B4)

```
supabase/migrations/
  20240101000008_search_saves.sql     tsvector, price_history, saves, saved_searches, triggers
lib/
  analytics.ts                        PostHog wrapper (no-op when key absent)
app/
  page.tsx                            Simplified: auth check → /browse or /enter
  browse/page.tsx                     Server Component with all filter logic
  browse/browse-client.tsx            Client Component: filter rail, grid, drawer, save toggle
  api/browse/route.ts                 GET pagination endpoint
  api/saves/route.ts                  POST/DELETE save toggle
  api/saved-searches/route.ts         POST follow-search
  api/dev/seed/route.ts               Dev-only fixture seed (30 listings)
  listings/[id]/page.tsx              Updated: saves_count, price-drop, OG meta, SaveButton
  listings/[id]/save-button.tsx       Client save toggle button
tests/
  e2e/browse.spec.ts                  Non-@live structural + auth tests
  e2e/browse-live.spec.ts             @live: filters, saves, RLS, SSR
```

---

## Known issues / deferred

- **[MEDIUM] code-reviewer B4**: `verified` filter in browse uses `.eq('profiles.id_verification_status', 'verified')` on a joined relation — PostgREST silently ignores this, all listings returned regardless. Fix: use subquery `.in('seller_id', verifiedSellerIds)` or DB-side RPC. Track for B8 hardening.
- **[MEDIUM] code-reviewer B4**: Seed route guard is `NODE_ENV !== 'development'` only — not a secret-header gate. Acceptable for alpha. Harden before beta.
- **[LOW] code-reviewer B4**: `listing_id` UUID format not validated in `/api/saves` — invalid UUIDs will hit DB and return 400 from Postgres. Add `uuid` regex guard in B8.
- **[LOW] code-reviewer B4**: `listUsers` in seed has no pagination (returns first 1000). Acceptable for dev seed.
- **[LOW] code-reviewer B4**: No `img-src` CSP header covering Supabase storage domain. Add in B8.
- **[LOW] code-reviewer B4**: Saved-search query JSONB has no size cap — large payloads accepted. Add 1KB cap in B8.
- **[LOW] code-reviewer B4**: `verified` filter also absent from load-more API `/api/browse`. Same fix as above.
- **[MEDIUM] B3 carry-forward**: `profiles_public_read_username` policy exposes full row (role, id_verified) to anon. Restrict in B8.
- **[LOW] B3 carry-forward**: Possession dedup uses exact-hash (not Hamming) — slight re-encode bypasses hard-reject. Tighten in B8.
- **[LOW] B3 carry-forward**: Near-duplicate scan `.limit(5000)` cap. DB nearest-neighbour function needed before beta. Track for B8.
- **[LOW] B2 carry-forward**: `images[]` URL validation incomplete (host-locked but no path prefix check). Full validation in B8.
- **[LOW] B2 carry-forward**: `listings_seller_update` WITH CHECK allows `status='removed'` — tighten in B5 when `sold` status arrives.
- **[LOW → CONFIRMED SAFE] code-reviewer B4**: `profiles.role` self-promotion risk — `GRANT UPDATE` on `profiles` to `authenticated` is column-level and explicitly excludes `role` (migrations 000000:66 + 000001:28). Users cannot escalate their own role via the API.
- `@live` e2e specs require `RUN_LIVE_TESTS=1`, `TEST_SELLER_EMAIL`, `TEST_SELLER_PASSWORD`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_NEW_SELLER_EMAIL`. Run locally before B8.
- Seller tier hardcoded `Bronze` stub — B7.
- BUY/OFFER buttons disabled — B5.
- Message seller disabled — B6.
- Community section placeholder — B7.
