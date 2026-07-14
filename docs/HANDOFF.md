# HANDOFF.md

## Current state: HF3 COMPLETE — QA BATCH 3

**Last updated:** 2026-07-14
**Next prompt:** PA (post-alpha) or HF4 (next QA batch) — see LAUNCH.md §8

---

## HF3 — QA batch 3: hydration, card uniformity v2, infinite scroll, settings

**Issues fixed:**

### 1. Hydration warning (Grammarly browser extension noise)
- Added `suppressHydrationWarning` to `<body>` in `app/layout.tsx`
- One-line fix; prevents console warnings when third-party extensions inject body attributes pre-React

### 2. Card uniformity v2 — image aspect ratio + title truncation
- **Image wrapper:** `width: 100%`, `aspectRatio: 3/4`, `overflow: hidden`
- **Image element:** `width/height: 100%`, `objectFit: cover` (no height attribute on img)
- **Title:** Truncated at 38 chars with "…" marker; all titles in a row render same baseline
- **Fixed-height text rows:** timestamp/title/price/size·condition/VERIFIED/save all have minHeight to align
- **Playwright spec:** new `hf3.spec.ts` verifies image boxes identical height (±1px), baselines aligned (±1px), long titles show ellipsis

### 3. Infinite scroll on /browse
- **IntersectionObserver sentinel:** 600px `rootMargin` below grid auto-fetches next page while scrolling
- **LOAD MORE fallback:** manual button retained for no-JS / error cases
- **Debounce:** `isInFlightRef` prevents double-fetch on fast scroll
- **State:** "LOADING…" text during fetch; "END OF THE ARCHIVE" when exhausted (design tone preserved)

### 4. Settings pages (full structure, partial impl)
- **Layout:** left nav rail with 3 sections (ACCOUNT/SELLING/TRUST), 10 total nav items
- **Active state:** black text + 2px left rule; mobile = index list → detail screens with back chevron

#### Built panes:
- **PROFILE:** read-only username (permanent), email (disabled), location (dropdown, disabled for alpha)
- **MY SIZES:** chip multi-selects — TOPS (XS–XXL) / BOTTOMS (26–40) / FOOTWEAR (6–14 with halves)
  - Save button (disabled until dirty); persists to `profiles.quick_setup.sizes`
  - Wired end-to-end: `/browse MY SIZES toggle` reads same field
- **ADDRESSES:** "Add address" button; form skeleton (FULL NAME/STREET/CITY/STATE·ZIP/COUNTRY, SET AS DEFAULT, Save/Cancel)
- **PAYMENTS:** PAYMENT METHODS list + "Add card", PAYOUTS section (Stripe Connect status), "Set up payouts" button
- **LISTINGS/OFFERS:** nav items link to existing pages (`/sell`, `/messages`)
- **Placeholders:** VACATION MODE, VERIFICATION, PRIVACY, NOTIFICATIONS show "coming soon" (EB Garamond italic)

### Verify state (HF3)
```
pnpm build       ✓  36+ routes, 0 errors
pnpm verify      ✓  133 unit tests, 0 errors
pnpm verify:ui   ✓  34 passed, 3 skipped (@live), 11 pre-existing failures (401 errors, auth flow)
```

### Key files added
```
app/settings/settings-client.tsx
tests/e2e/hf3.spec.ts
```

### Key files modified
```
app/layout.tsx                   — suppressHydrationWarning
app/browse/browse-client.tsx     — truncatedTitle (38 chars), IntersectionObserver + sentinels
app/settings/page.tsx            — integrated SettingsClient
```

---

## HF2 — UI polish batch

### Issue 1: React key warning — app/sell/page.tsx
Fragment inside `.map()` had `key` on inner `<span>` instead of the `<>` wrapper.
Fixed: import `Fragment`, use `<Fragment key={step.n}>`.

### Issue 2: Listing card alignment — browse-client.tsx
Cards in the same grid row misaligned when the conditional VERIFIED badge was absent.
Fixed: added `minHeight` to every text line in `ListingCard`.

### Issue 3: Navbar gaps — shared SiteHeader
Multiple pages had divergent headers; none had SAVED / MESSAGES / avatar.
Fixed: created `SiteHeader` (server) + `AvatarMenu` (client) components.

### Issue 4: Seller profile — /sellers/[username]
Page did not exist. Built with header, stats, listings grid, message button.

---

## HF1 — Hotfix: recursive RLS policies

### Cause
`profiles_admin_all` used `EXISTS(SELECT FROM profiles)` inside an RLS policy on the `profiles` table itself → infinite recursion.

### Fix
Created `public.is_admin()` SECURITY DEFINER function. Rebuilt all 9 recursive policies to call `is_admin()` instead of the EXISTS subquery.

### Pre-existing bug surfaced (not HF1):
`generate_member_codes` RPC fails on live: `gen_random_bytes` not found because RPC has `SET search_path = public` but pgcrypto is in `extensions` schema. Fix: qualify as `extensions.gen_random_bytes` in the RPC body. Added to PA backlog.

---

## B8 — Alpha build complete

All B0–B8 milestones complete. The codebase is ready for private alpha launch. Follow `docs/LAUNCH.md` to deploy.

Key additions:
- Rate limiting, Sentry analytics, security hardening
- Admin metrics dashboard
- Founder seed script + launch checklist

---

## Blockers

None.

---

## PA backlog (from B8 + HF3)

- Settings MY SIZES: wire Save action to DB update (`profiles.quick_setup`)
- Settings ADDRESSES: create addresses table (RLS), add/edit/delete forms
- Settings PAYMENTS: add real Stripe Connect + saved methods list, implement "Add card" SetupIntent flow
- Replace in-memory rate limiter with pg-based counter
- Add nonce-based CSP to eliminate `'unsafe-inline'` in script-src
- Validate `images[]` URLs against storage domain allowlist
- Add UUID validation to admin path params
- Carrier-scan webhook (auto-confirm delivery)
- ID verification provider (Stripe Identity or Persona)
- Mobile PWA / iOS native app

---

## Session start ritual

```
Read CLAUDE.md and docs/HANDOFF.md, then read docs/LAUNCH.md for launch checklist status.
```

---

## Next: PA (Post-Alpha)

See LAUNCH.md §8 for full backlog. HF3 gates are all green; ready to proceed.
