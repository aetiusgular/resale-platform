# HANDOFF.md
## Current state: B6 COMPLETE

**Last updated:** 2026-07-13
**Next prompt:** B7 — Community layer (M7)

---

## What was done in B6

B6 added the full chat + offers system including Realtime messaging, offer negotiation, link blocking, and accepted-offer checkout integration.

### Migration: `20240101000010_messages.sql`

- New enum: `offer_state` (open/countered/accepted/declined/expired/voided)
- New tables: `conversations`, `messages`, `offers`, `buyer_strikes`
- `buyer_stats` view replaced: adds `strike_count` + `pays_fast` columns
- SECURITY DEFINER RPCs: `send_message()`, `expire_and_void_offers()`
- Realtime: `messages` table added to `supabase_realtime` publication
- pg_cron: `expire-and-void-offers` hourly job

### Key files added

```
lib/message-filter.ts             — URL + payment-app blocking for chat
lib/offers.ts                     — Offer state machine helpers + types
app/api/conversations/route.ts    — POST (create/find), GET (inbox list)
app/api/conversations/[id]/messages/route.ts   — GET thread, POST via RPC
app/api/conversations/[id]/offers/route.ts     — POST create offer
app/api/conversations/[id]/offers/[offerId]/accept/route.ts
app/api/conversations/[id]/offers/[offerId]/decline/route.ts
app/api/conversations/[id]/offers/[offerId]/counter/route.ts
app/api/conversations/[id]/consent/route.ts    — PATCH consent toggle
app/messages/page.tsx             — Inbox (two-pane desktop)
app/messages/[id]/page.tsx        — Thread page (server component)
app/messages/[id]/thread-client.tsx — Realtime + offer UI (client)
app/listings/[id]/message-seller-button.tsx    — Client button
tests/unit/message-filter.test.ts
tests/unit/offers.test.ts
tests/e2e/messages.spec.ts
```

### Key files modified

```
app/api/checkout/route.ts         — Extended: offerId param, verified offer price
app/listings/[id]/page.tsx        — Message seller + Make offer buttons live
```

---

## Verify state (as of B6 close)

```
pnpm verify      ✓  112 tests, 0 errors (0 type errors, 0 lint errors)
pnpm build       ✓  49 routes, 0 errors
pnpm verify:ui   ✓  36 passed, 1 skipped (pre-existing SSR test skip)
Migration 000010 ✓  pushed to remote
db-guard         ✓  APPROVED (no blocking FAILs)
code-reviewer    ✓  APPROVED after fixes (M1 non-atomic void+create compensated)
```

---

## Blockers

None.

---

## B6 architecture notes (for B7 reuse)

- `send_message()` RPC is SECURITY DEFINER + participant-checked. All message inserts must go through it.
- Offer state machine is in `lib/offers.ts`. Transitions enforced server-side (no client UPDATE on offers table).
- `expire_and_void_offers()` cron handles: open→expired (24h), accepted→voided+strike (24h after accepted_at).
- Offer-based checkout: `POST /api/checkout` with `{ listingId, offerId }`. Server verifies offer.state='accepted', conv.buyer_id=user.id, uses offer.amount_cents (0 shipping).
- `buyer_stats` view now includes strike_count + pays_fast. Still service_role only.
- Realtime: subscribe to `messages:${conversationId}` channel on postgres_changes INSERT.
- Message filter: `lib/message-filter.ts` → `filterMessage(body)` returns `{ redacted, body }`.

---

## Session start ritual for B7

```
Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.
```

---

## Known issues / deferred

### B6 LOW findings (address before B8)

- `shippingAddress` is destructured in checkout route but not passed to PI metadata (FAIL-L1 from B5 still applies).
- `Make offer` button on listing page links to `/messages?listing=id` which opens the inbox — in the thread, users must manually click "Make offer". Future: link directly to the thread with offer composer open.

### B5 LOW findings (carry-forward, address before B8)

- **[LOW] FAIL-L1**: Shipping address entered at checkout is discarded. Fix: pass through PI metadata in B8.
- **[LOW] FAIL-L3**: E2E `serviceClient()` has no guard against pointing at production. Fix B8.
- **[TODO(PA)]**: Carrier-scan webhook for auto-delivery stubbed.

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
- Community section placeholder — B7.
