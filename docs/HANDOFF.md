# HANDOFF.md
## Current state: B5 COMPLETE

**Last updated:** 2026-07-13
**Next prompt:** B6 — Chat + offers (M6)

---

## What was done in B5

B5 was completed across two sessions (wip commit b8d2b64 + this session). The wip commit did the heavy lifting; this session fixed all db-guard and code-reviewer findings before commit.

### Migration: `20240101000009_orders.sql`

- `profiles`: added `payouts_enabled BOOL`, `stripe_connect_account_id TEXT`, `shipping_address JSONB`
- `listing_status` enum: added `pending_escrow`
- Tightened `listings_seller_update` policy: sellers can only edit `draft`/`pending_review` rows
- New enums: `order_state`, `event_source`
- New tables: `checkout_sessions`, `orders`, `order_events`, `disputes`
- View: `buyer_stats` (service_role only — restricted from authenticated to prevent history enumeration)
- SECURITY DEFINER RPCs: `transition_order()`, `auto_release_delivered_orders()`, `release_expired_checkouts()`
- pg_cron: auto-release hourly, expired-checkout cleanup every 5 min (idempotent via unschedule-first)

### Key files added

```
lib/fees.ts, lib/orders.ts, lib/stripe.ts, lib/supabase/service.ts
app/api/checkout/route.ts
app/api/webhooks/stripe/route.ts
app/api/orders/[id]/{confirm,ship,deliver,dispute}/route.ts
app/api/admin/listings/[id]/approve/route.ts
app/api/admin/orders/[id]/resolve/route.ts
app/api/cron/process-transfers/route.ts
app/api/stripe/connect/route.ts, return/route.ts
app/api/orders/by-intent/route.ts
app/checkout/[listingId]/page.tsx, checkout-client.tsx
app/checkout/success/page.tsx, checkout-success-content.tsx
app/orders/[id]/page.tsx, order-buyer.tsx, order-seller.tsx, dispute/page.tsx
app/settings/page.tsx, settings/payouts/page.tsx
tests/e2e/checkout.spec.ts
tests/unit/fees.test.ts, tests/unit/orders.test.ts
docs/STRIPE_TESTING.md
```

---

## Verify state (as of B5 close)

```
pnpm verify      ✓  85 tests, 0 errors
pnpm build       ✓  29 routes, 0 errors
pnpm verify:ui   ✓  31 passed, 1 skipped
Migration 000009 ✓  pushed to remote
db-guard         ✓  APPROVED after fixes (F2/J2/D8/D9/H6/K4)
code-reviewer    ✓  APPROVED after fixes (H1-H4, M1-M4)
```

---

## Blockers

None.

---

## Session start ritual for B6

```
Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.
```

---

## Payment flow notes for B6 (accepted-offer checkout reuse)

- Reuse `POST /api/checkout` — accepts any `listingId`; offer can supply it
- Webhook handler routes on `payment_intent.succeeded` — no changes needed for offer-sourced PIs
- Fee math centralized in `lib/fees.ts` → import `orderAmounts()`, no duplication
- Add `offer_id` to PI metadata if needed for offer state tracking post-payment
- The checkout client already prefills address from `profiles.shipping_address`

---

## Known issues / deferred

### B5 LOW findings (address before B8)

- **[LOW] FAIL-L1**: Shipping address entered at checkout is discarded; saved profile address used. Fix: pass address through PI metadata in B8.
- **[LOW] FAIL-L3**: E2E `serviceClient()` has no guard against pointing at production. Fix: assert non-prod URL in B8.
- **[TODO(PA)]**: Carrier-scan webhook for auto-delivery stubbed. Doc: orders move `shipped→delivered` only via buyer manual confirm or admin override.

### Carry-forward from B4

- **[MEDIUM]**: `verified` filter in browse silently ignored by PostgREST. Fix B8.
- **[MEDIUM]**: Seed route guard is dev-only NODE_ENV check only. Harden B8.
- **[LOW]**: listing_id UUID not validated in /api/saves. Fix B8.
- **[LOW]**: No `img-src` CSP header. Fix B8.
- **[LOW]**: Saved-search JSONB has no size cap. Fix B8.
- **[MEDIUM] B3**: `profiles_public_read_username` exposes full row to anon. Restrict B8.
- **[LOW] B3**: Dedup uses exact hash — slight re-encode bypasses. Tighten B8.
- **[LOW] B2**: `images[]` URL validation incomplete. Fix B8.
- Seller tier hardcoded Bronze stub — B7.
- Message seller disabled — B6.
- Community section placeholder — B7.
