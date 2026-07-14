# HANDOFF.md
## Current state: HF4 COMPLETE — SAVED ITEMS + NAV PERFORMANCE

**Last updated:** 2026-07-14
**Next prompt:** PA (post-alpha) — see LAUNCH.md §8 for PA backlog

---

## HF4 — Saved Items page + navigation performance

### Issue 1: SAVED button was a dead link
The SAVED nav link pointed to `/browse?saved=1`, but nothing read a `saved` param.

**Fixed:**
- Built `/saved` route per `design-reference/saved-items-export/Saved Items.dc.html`
- Server component page (`app/saved/page.tsx`) + client component (`app/saved/saved-client.tsx`)
- Items tab: shows saved listings with "SAVED Xh AGO" labels, price-drop flags ("↓ $80 SINCE SAVED"), sold items with 85% white veil + "Find similar →" link
- Unsaving: × button on image + SAVED text toggle, optimistic removal with revert on error
- "Clear sold" bulk action removes all sold/removed saved items
- Empty state: EB Garamond italic "Nothing saved yet." + "Browse listings" CTA
- Tabs (Items/Searches/Sellers) — Items functional, Searches/Sellers stubbed with count 0
- Extracted `ListingCard` to `app/components/listing-card.tsx` — shared by browse + saved + (future) sellers
- SiteHeader + BrowseClient SAVED links updated to `/saved`

### Issue 2: Slow page-to-page navigation
Serial Supabase round-trips on every page load. Fixed by parallelizing independent queries.

**Performance — /browse Supabase round-trips:**
- **Before:** 7 sequential round-trips (getUser → listings → price_history → filter_counts → saves → profile → count)
- **After:** 3 sequential round-trips (getUser → [listings, count, filter_counts×2, profile] → [price_history, saves])
- Reduction: **57% fewer serial hops**

**Pages parallelized:**
- `app/browse/page.tsx` — 5 queries in first batch, 2 in second (7→3 sequential)
- `app/listings/[id]/page.tsx` — user+listing in parallel, then profile+save+price_history in parallel
- `app/sellers/[username]/page.tsx` — current_profile+seller in parallel, then orders+buyer_stats+listings in parallel
- `app/messages/page.tsx` — profile+searchParams in parallel

**Middleware optimization:**
- Added `x-gate-ok` httpOnly cookie (10-min TTL) to cache invite-gate result
- Skips the per-request `profiles` SELECT when cookie present (non-admin paths only)
- Admin paths always do a fresh role check — no bypass possible
- Cookie cleared on logout (`getUser()` returns null)
- `getUser()` still runs on every request — auth is never cached
- code-reviewer: **APPROVED** — 0 FAIL items, trade-off documented (10-min revocation window)

### Verify state (HF4)
```
pnpm build       ✓  0 errors, 34 routes
pnpm verify      ✓  133 unit tests, 0 warnings-as-errors
pnpm verify:ui   ✓  48 passed, 3 skipped (@live), 3 pre-existing auth test failures (not introduced by HF4)
code-reviewer    ✓  APPROVED (0 FAIL)
```

### Key files added
```
app/components/listing-card.tsx       — Shared ListingCard (extracted from browse-client)
app/saved/page.tsx                    — Saved items server page
app/saved/saved-client.tsx            — Saved items client component
tests/e2e/saved.spec.ts              — 11 e2e tests (6 gate regression + 5 saved page)
```

### Key files modified
```
app/browse/browse-client.tsx          — Import shared ListingCard, remove duplicate, fix SAVED href
app/browse/page.tsx                   — Parallelized queries (7→3 sequential round-trips)
app/components/site-header.tsx        — SAVED link → /saved
app/listings/[id]/page.tsx            — Parallelized user+listing, then profile+save+price
app/messages/page.tsx                 — Parallelized profile+searchParams
app/sellers/[username]/page.tsx       — Parallelized profile+seller, then orders+stats+listings
middleware.ts                         — Gate cookie caching (x-gate-ok, 10-min TTL)
docs/DESIGN_MAP.md                    — Added Saved Items row
docs/ROADMAP.md                       — Added HF1-HF4 entries
```

---

## Pre-existing test failures (NOT introduced by HF4)

3 auth e2e tests fail identically before and after HF4 changes:
- `Gate — unauthenticated › invalid format shows error`
- `Gate — unauthenticated › waitlist form submits email`
- `Gate — /enter page error states › code already used error shows in alert color`

These test the `/enter` page's code-entry error states and have been failing since at least HF2.

---

## Blockers

None.

---

## PA backlog (from B8 security review + HF4)

- Replace in-memory rate limiter with pg-based counter for multi-instance correctness
- Add nonce-based CSP to eliminate `'unsafe-inline'` in script-src
- Validate `images[]` URLs against storage domain allowlist
- Add UUID validation to admin path params (profileId, commentId)
- Carrier-scan webhook (auto-confirm delivery)
- ID verification provider (Stripe Identity or Persona)
- Fix `generate_member_codes` RPC: qualify `extensions.gen_random_bytes`
- Saved page: implement Searches and Sellers tabs (currently stubbed)
- See LAUNCH.md §8 for full PA backlog

---

## Session start ritual for PA

```
Read CLAUDE.md and docs/HANDOFF.md, then read docs/LAUNCH.md for launch checklist status.
```

---

## ALPHA BUILD COMPLETE

All B0–B8 milestones + HF1–HF4 complete. The codebase is ready for private alpha launch.
Follow `docs/LAUNCH.md` to deploy.
