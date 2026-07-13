# HANDOFF.md
## Current state: B7 COMPLETE

**Last updated:** 2026-07-13
**Next prompt:** B8 — Analytics + alpha polish (M8)

---

## What was done in B7

B7 added the full community layer: legit-check threads, general comments, verified-checker gating, admin moderation queue, and seed data.

### Migration: `20240101000011_comments.sql`

- New enums: `member_tier` (bronze/silver/gold), `thread_type` (lc/general), `comment_status` (visible/removed/flagged), `comment_action_type` (agree/flag)
- Altered `profiles`: `verified_checker` boolean, `checker_category` text, `tier member_tier`
- Altered `listings`: `comments_enabled` boolean default true
- New tables: `comments`, `comment_actions` (with UNIQUE dedupe constraint)
- New RPCs (SECURITY DEFINER):
  - `post_comment()` — id-verification gate, LC permission gate, rate limit (new accounts ≤2/day), redaction flag
  - `check_and_auto_flag_comment()` — auto-flags at ≥2 flags; service_role only
  - `toggle_listing_comments()` — seller toggle bypassing active-listing RLS restriction

### Key files added

```
lib/comment-filter.ts                              — Reuses filterMessage pipeline for comments
app/api/listings/[id]/comments/route.ts           — GET (tab fetch) + POST (via RPC)
app/api/listings/[id]/comments/[commentId]/agree/route.ts
app/api/listings/[id]/comments/[commentId]/flag/route.ts
app/api/listings/[id]/comments-toggle/route.ts    — Seller comments_enabled toggle
app/api/admin/comments/[commentId]/remove/route.ts
app/api/admin/comments/[commentId]/restore/route.ts
app/api/admin/comments/[commentId]/pin/route.ts
app/api/admin/profiles/[profileId]/checker/route.ts  — Admin grant/revoke verified_checker
app/listings/[id]/community-section.tsx           — Client component: tabs, pinned card, rows, input
app/admin/queue/comment-actions.tsx               — Admin comment moderation UI
tests/unit/comment-filter.test.ts
tests/e2e/comments.spec.ts
```

### Key files modified

```
app/listings/[id]/page.tsx     — Replaced B7 placeholder with CommunitySection + profile fields
app/admin/queue/page.tsx       — Added FLAGGED COMMENTS section
scripts/seed-founders.ts       — Extended: fixture founders id-verified, 2 verified checkers, demo LC thread
supabase/migrations/...        — 000011_comments.sql pushed to remote
```

---

## Verify state (as of B7 close)

```
pnpm build       ✓  54+ routes, 0 errors
pnpm verify      ✓  120 tests, 0 errors (9 files)
pnpm verify:ui   ✓  36 passed, 3 skipped (pre-existing)
Migration 000011 ✓  pushed to remote
db-guard         ✓  APPROVED after fixes (privilege escalation in profile grant fixed)
code-reviewer    ✓  APPROVED — all 7 items pass
```

---

## Blockers

None.

---

## B7 architecture notes (for B8 reuse)

- `post_comment()` RPC is SECURITY DEFINER + id-verification + rate-limit checked inside. All comment inserts must go through it (no direct client INSERT policy on `comments`).
- `check_and_auto_flag_comment()` is service_role only — call via `createServiceClient()` in flag route.
- `toggle_listing_comments()` is the only way for a seller to change `comments_enabled` on an active listing (active-listing RLS blocks direct UPDATE).
- Admin routes for checker grant use `createServiceClient()` — `verified_checker/checker_category/tier` columns have no authenticated-role grant (escalation prevention).
- `comment_actions` table keeps (comment_id, actor_id, action) pairs immutable — unique constraint dedupes; full log queryable for future collusion detection.
- CommunitySection is a client component: fetches from `/api/listings/[id]/comments?tab=lc|general`; tab switches trigger a fresh fetch.
- Pinned cards: LC comments with `pinned=true` render above the thread list with accent border.
- Seller toggle: only visible when `isSeller=true` in CommunitySection props; posts to `/api/listings/[id]/comments-toggle`.

---

## Session start ritual for B8

```
Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.
```

---

## Known issues / deferred

### B7 MEDIUM findings (address before B9)

- No upper bound on comment body other than the 2000-char TS API check — RPC itself doesn't enforce max length. Fix in B8.
- `comment_actions_auth_read` policy uses `USING (true)` — exposes flag-actor identity to all authenticated users. Design decision (transparency), accepted for now; revisit in B8.

### Carried from B6

- **[MEDIUM]** Double-lock ambiguity in offer-based checkout (B8).
- **[LOW]** `shippingAddress` discarded in checkout PI metadata (B8).
- **[LOW]** `conversationId` / `offerId` URL params not UUID-validated (B8).
- **[LOW]** Message filter: bare `paypal.com/send` not caught (B8).

### Carried from B4/B3

- **[MEDIUM]** `verified` filter in browse silently ignored by PostgREST (B8).
- **[MEDIUM]** Seed route guard is dev-only NODE_ENV check (B8).
- **[MEDIUM B3]** `profiles_public_read_username` exposes full row to anon (B8).
- **[LOW]** listing_id UUID not validated in /api/saves (B8).
- **[LOW]** No `img-src` CSP header (B8).
- **[LOW]** Saved-search JSONB has no size cap (B8).
- **[LOW B3]** Dedup uses exact hash — re-encode bypasses (B8).
- **[LOW B2]** `images[]` URL validation incomplete (B8).
