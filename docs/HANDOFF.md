# HANDOFF.md
## Current state: B3 COMPLETE

**Last updated:** 2026-07-12
**Next prompt:** B4 — Browse + search (M4)

---

## What was done in B3

1. **`lib/phash.ts`** — Pure-JS 16×16 blockhash: `blockhash16(pixels: Uint8Array) → string` (64-char hex, 256-bit), `hammingDistance(a, b) → number`. No external deps. Unit tested for determinism, near-duplicate detection (perturbation ≤ 8 bits), distinct-image separation.

2. **`lib/antislop-config.ts`** — Centralised thresholds: `DUPLICATE_DISTANCE_THRESHOLD=8`, `DUPLICATE_MIN_SLOT_MATCHES=2`, `BRAND_TITLE_MAX=2`, `BRAND_DESC_MAX=4`, `VELOCITY_WINDOW_DAYS=30`, `VELOCITY_DAILY_LIMIT=5`. ~43 brand names. 10 blocked-pattern regexes. TODO(B8/PA) stub for stock-photo detection.

3. **`lib/antislop-lint.ts`** — `lintListing(title, description) → LintViolation[]`. Blocked patterns → severity='reject'. Brand stuffing → severity='warn'. 17 unit tests covering pass/warn/reject cases.

4. **`lib/image-hash.ts`** — Server-side sharp-based hash computation. `hashImageUrl(url)` with SSRF guard (HTTPS-only + Supabase host-lock). `hashAllSlots(images, possessionUrl)` returns per-slot hash map.

5. **`supabase/migrations/20240101000006_image_hashes.sql`** — `image_hashes` table (listing_id FK, slot TEXT, hash TEXT, unique constraint). RLS ON, **zero policies** → deny all client access. Indexes on listing_id and (slot, hash). Service role only.

6. **`supabase/migrations/20240101000007_listing_flags.sql`** — `listing_flags` table (listing_id FK, type CHECK('duplicate'|'keyword_stuffing'), evidence JSONB). RLS ON, admin SELECT policy. No client write policies — service role only for INSERT.

7. **Updated `app/api/listings/route.ts`** — Enhanced POST handler:
   - `export const runtime = 'nodejs'` (sharp requires Node runtime)
   - Lint check → blocked patterns hard-reject (400) before any DB ops
   - Velocity check: accounts < 30 days limited to 5 listings/day (429). Missing profile → 500.
   - `hashAllSlots()` computed server-side (SSRF-safe URLs only)
   - Possession-photo dedup: exact-hash match from different seller → 400 hard-reject
   - Insert listing (unchanged flow)
   - Store `image_hashes` via service client
   - Near-duplicate scan: Hamming ≤ 8 on ≥ 2 slots from another seller → `listing_flags` row type='duplicate', evidence contains matched_listing_ids + per_slot_distances. Row cap: .limit(5000)
   - Keyword-stuffing lint warns → `listing_flags` row type='keyword_stuffing', evidence contains violations array

8. **Updated `app/admin/queue/page.tsx`** — Fetches `listing_flags` via join. Displays DUPLICATE SUSPECT and KEYWORD STUFFING badges (design-token colours only). Lint violation detail strip. For duplicate flags: side-by-side photo comparison grid with `data-testid="duplicate-comparison"`. Fetches matched listing images via service client. Per-slot distance chips.

9. **`tests/unit/phash.test.ts`** — 15 tests: blockhash correctness, determinism, near-duplicate tolerance, large-distance discrimination.

10. **`tests/unit/antislop-lint.test.ts`** — 17 tests: all blocked patterns, brand stuffing, clean listings.

11. **`tests/e2e/antislop.spec.ts`** — 3 non-@live tests: admin queue redirect, sell redirect, 401 on unauthenticated POST.

12. **`tests/e2e/antislop-live.spec.ts`** — @live tests: blocked-pattern reject, duplicate detection + queue flag, velocity limit, RLS (image_hashes and listing_flags not client-readable).

---

## Verify state (as of B3 close)

```
pnpm verify      ✓  54 tests (15 phash + 17 antislop-lint + 11 invite-codes + 10 fees + 1 placeholder)
pnpm build       ✓  17 routes, 0 errors
pnpm verify:ui   ✓  19 Playwright tests (non-@live)
Migrations       ✓  000006 + 000007 pushed to remote
db-guard         ✓  via code-reviewer review (image_hashes no-policy deny-all; listing_flags admin-read-only; service role bypasses RLS for writes)
code-reviewer    ✓  SAFE TO COMMIT — HIGH (SSRF) fixed; LOW fixes applied
```

---

## Blockers

None.

---

## Session start ritual for B4

```
Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.
```

---

## File inventory (key files added/modified in B3)

```
lib/
  phash.ts                              16x16 blockhash + hammingDistance (pure JS)
  antislop-config.ts                    Thresholds, brand list, blocked patterns, stock-photo TODO
  antislop-lint.ts                      Brand-stuffing + blocked-pattern lint
  image-hash.ts                         Server-side sharp hash (SSRF-guarded)
supabase/migrations/
  20240101000006_image_hashes.sql       image_hashes table + RLS (deny-all)
  20240101000007_listing_flags.sql      listing_flags table + admin SELECT policy
app/
  api/listings/route.ts                 Updated: velocity + dedup + lint + hash store + flags
  admin/queue/page.tsx                  Updated: flag badges + duplicate comparison view
tests/
  unit/phash.test.ts                    15 phash unit tests
  unit/antislop-lint.test.ts            17 lint unit tests
  e2e/antislop.spec.ts                  3 non-@live structural tests
  e2e/antislop-live.spec.ts             @live: dedup, velocity, blocked-pattern, RLS
```

---

## Known issues / deferred

- **[HIGH → FIXED]** code-reviewer: SSRF via user-supplied image URLs — fixed with HTTPS + Supabase host-lock in `lib/image-hash.ts:isSafeImageUrl()`.
- **[MEDIUM] code-reviewer**: `profiles` table `profiles_public_read_username` policy exposes full row (role, id_verified) to anon — pre-existing from B0. Restrict to username-only view before beta. Track for B8 hardening.
- **[LOW] code-reviewer**: Possession dedup uses exact-hash equality (not Hamming distance) — slight crop/re-encode bypasses the hard-reject but lands in the duplicate-flag path. Documented as known limitation. Tighten in B8.
- **[LOW] code-reviewer**: Near-duplicate scan has `.limit(5000)` cap — at >833 active listings scan is incomplete. DB-side nearest-neighbour function needed before beta. Track for B8.
- **[LOW] B2 carry-forward**: `images[]` array in POST not validated against storage bucket prefix — partially mitigated by SSRF guard (Supabase host-lock). Full URL validation in B8.
- **[LOW] B2 carry-forward**: `listings_seller_update` WITH CHECK allows seller to set `status='removed'` — tighten to `IN ('draft','pending_review')` in B5 when `sold` status arrives.
- `@live` e2e specs require `RUN_LIVE_TESTS=1`, `TEST_SELLER_EMAIL`, `TEST_SELLER_PASSWORD`, `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD`, `TEST_NEW_SELLER_EMAIL`. Run locally before B8.
- Seller tier hardcoded `Bronze` stub — B4/B7.
- BUY/OFFER buttons disabled — B5.
- Message seller disabled — B6.
- Community section placeholder — B7.
