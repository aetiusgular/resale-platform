# HANDOFF.md
## Current state: B2 COMPLETE

**Last updated:** 2026-07-12
**Next prompt:** B3 — Anti-slop layer (M3)

---

## What was done in B2

1. **Listings migration** (`20240101000004_listings.sql`) — `listing_status` enum (draft/pending_review/active/removed), `listings` table with all required columns (id, seller_id, title, brand, category, size, condition_score 1–10, condition_notes JSONB, price_cents INT, images TEXT[] 6 slots, possession_photo_url, status, rejection_reason, timestamps). Full RLS: anon/auth read active only; seller CRUD own (status→active blocked by WITH CHECK); admin all via service role. Indexes on seller_id, status, created_at. `set_updated_at` trigger.

2. **Storage migration** (`20240101000005_storage.sql`) — `product-images` bucket (public read, 10MB, jpeg/png/webp). Storage RLS: public SELECT, authenticated INSERT/UPDATE/DELETE restricted to `listings/{auth.uid()}/` path prefix.

3. **`lib/fees.ts`** — `SELLER_FEE_BPS=200`, `BUYER_FEE_BPS=200`, `sellerFee`, `buyerFee`, `sellerPayout`, `buyerTotal`, `formatCents`. All math in integer cents with `Math.round()`.

4. **`lib/condition.ts`** — `CONDITION_DEFINITIONS` (1–10 rubric), `PHOTO_SLOTS` (FRONT/BACK/TAG/DETAIL/FLAW/POSSESSION), `DAMAGE_FLAGS`.

5. **API routes**:
   - `POST /api/listings` — auth required, inserts with `status=pending_review`
   - `POST /api/admin/listings/[id]/approve` — admin gate + service role client → `status=active`
   - `POST /api/admin/listings/[id]/reject` — admin gate + service role client → `status=removed` + `rejection_reason`

6. **`middleware.ts`** — Added `/listings` to PUBLIC_PATHS; added admin gate (ADMIN_PATHS=['/admin'], checks `profile.role='admin'`, redirects to `/`).

7. **Sell flow** (`/sell`) — Server component (auth gate) + `sell-form.tsx` (client): 4 sections PHOTOS→DETAILS→CONDITION→PRICE. Client-side canvas resize to 2000px JPEG. Upload path `listings/{userId}/{draftId}/{slot}.jpg`. Live fee math. Submitted state with "In the queue" + SELLER PROTECTION card.

8. **Admin queue** (`/admin/queue`) — Server component (admin gate). Pending listings with 6-photo grid + seller username. `AdminActions` client component (approve/reject with reason input).

9. **Listing detail** (`/listings/[id]`) — SSR with `generateMetadata` for SEO. 3fr/2fr grid: gallery (main + 6 thumbnails with labels + possession badge) / purchase panel (h1 title, brand/size, condition + popover, price + fee line, TRUST STRIP placeholder, disabled buy/offer/message buttons, seller block with tier badge stub). Seller pending/rejection banners. Admin view banner. Community section B7 placeholder.

10. **Tests** — 10 fee unit tests (vitest). 4 non-@live Playwright specs (`tests/e2e/listings.spec.ts`). Full @live spec (`tests/e2e/listings-live.spec.ts`) covering seller create → RLS → admin approve → visible → reject path → storage isolation.

---

## Verify state (as of B2 close)

```
pnpm verify      ✓  22 tests (1 placeholder + 11 invite-codes + 10 fees; tsc clean; eslint clean)
pnpm build       ✓  17 routes, 0 errors
pnpm verify:ui   ✓  16 Playwright tests (non-@live)
Migrations       ✓  000004 + 000005 pushed to remote
db-guard         ✓  SAFE TO PUSH
code-reviewer    ✓  run on B2 diff (RLS + storage + auth)
```

---

## Blockers

None.

---

## Session start ritual for B3

```
Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.
```

---

## File inventory (key files added/modified in B2)

```
supabase/migrations/
  20240101000004_listings.sql           listings table + RLS + trigger + indexes
  20240101000005_storage.sql            product-images bucket + storage RLS
lib/
  fees.ts                               Fee math (SELLER_FEE_BPS=200, BUYER_FEE_BPS=200)
  condition.ts                          Condition rubric (1–10), photo slots, damage flags
middleware.ts                           Added /listings public + admin gate
app/
  sell/
    page.tsx                            Sell flow server component (auth gate)
    sell-form.tsx                       4-section sell form (client, canvas resize, upload)
  admin/queue/
    page.tsx                            Admin queue server component
    admin-actions.tsx                   Approve/reject client component
  listings/[id]/
    page.tsx                            Listing detail (SSR, generateMetadata, RLS-aware)
    condition-popover.tsx               "What N means" popover (client)
  api/
    listings/route.ts                   POST → create listing (pending_review)
    admin/listings/[id]/approve/route.ts POST → approve (service role)
    admin/listings/[id]/reject/route.ts  POST → reject + reason (service role)
tests/
  unit/fees.test.ts                     10 fee unit tests
  e2e/listings.spec.ts                  4 non-@live Playwright specs
  e2e/listings-live.spec.ts             @live full flow specs (RLS + storage isolation)
```

---

## Known issues / deferred

- **[MEDIUM] code-reviewer**: `listings_seller_update` WITH CHECK allows seller to set `status='removed'` on their own active listing. Intentional for now (delist) but tighten to `status IN ('draft', 'pending_review')` before B5 when `sold` status arrives on the orders table.
- **[LOW] code-reviewer**: `images[]` array in `POST /api/listings` not validated against storage bucket prefix — a client could store arbitrary URLs. Add bucket-prefix validation in B3/B8 hardening.
- **[LOW] code-reviewer**: `condition_notes` JSONB not schema-validated in API route — deferred to B8 hardening.
- **[LOW] code-reviewer**: Admin approve/reject return 200 even if zero rows updated (listing already active/removed). Deferred to B5 when order state machine needs reliable status transitions.
- Storage cross-reference: `images[]` stores public URLs. URL→path extraction not hardened — deferred to B8 (storage cleanup on listing delete).
- Seller tier is hardcoded `Bronze` stub — real tier logic arrives in B4/B7.
- BUY/OFFER buttons disabled — checkout arrives in B5.
- Message seller disabled — arrives in B6.
- Community section placeholder — arrives in B7.
- `@live` e2e specs require `RUN_LIVE_TESTS=1` and live Supabase credentials. Run locally before B8.
- Email verification not enforced before profile creation — deferred to B8 (carried from B1).
- Waitlist emails not persisted — `POST /api/waitlist` logs only. TODO B8 (carried from B1).
