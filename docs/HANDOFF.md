# HANDOFF.md
## Current state: G11 (welcome ramp + category shipping margin + identity locks + Persona→Stripe) BUILT + native verify green on `feat/fee-tier-checkpoints`. Fee/gap history → docs/SESSION_STATUS.md · tracker → docs/LAUNCH_ROADMAP.md

**Last updated:** 2026-08-18
**Next prompt:** run the repo's code-reviewer/ui-verifier gate agents on the G11 money-path diff (checkout, webhook, migration 0038, identity locks) before merging `feat/fee-tier-checkpoints`; native `pnpm verify` already green (382 tests). Then consider consolidating the feature branches into `main` and pushing to origin (nothing is on origin yet).

---

## G11 — Welcome ramp + category shipping margin + identity locks + Persona→Stripe (2026-08-18)

**Branch `feat/fee-tier-checkpoints`. Native `pnpm verify` green (382 tests, 0 errors).** Money-path;
run code-reviewer + ui-verifier before merge. Flags off by default: `IDENTITY_LOCKS_ENABLED`,
`SHIPPING_LABELS_ENABLED` (live rater dormant → floor pricing), `VERIFICATION_ENABLED`.

- Welcome ramp: first 10 lifetime sales = 0% commission (processing only); `orders.fee_mode`
  snapshot; `profiles.lifetime_sales_count` trigger-maintained.
- Category shipping: `listings.shipping_cents` = max(quote, floor)+$2, set at listing time;
  sellers can't set shipping. Flat `SHIPPING_CENTS` removed; `orderAmountsAt` shipping now required.
- Identity: bank hard-lock (payouts_enabled=false on cross-account fingerprint) + card soft-flag;
  partial unique index on `payment_identities(fingerprint) WHERE kind='bank'`.
- Verification: Persona → Stripe Identity (`lib/idv/stripe-identity.ts`, events in shared Stripe
  webhook). Persona adapter/webhook/test removed. Migration `0038` applied. See docs/G11_*.md.

---

## G10 — Moderator-gated Legit Check + community moderator roles (2026-08-12)

**Branch `feat/moderator-lc`. Code written in a cloud session; NOT yet verified —**
**`pnpm verify`/`build` + db-guard/code-reviewer/ui-verifier must run natively on the Mac.**

What changed:
- General comments FULLY removed (thread path, seller toggle route+UI, `listings.comments_enabled`).
- Legit Check is moderators-only: new `profiles.is_moderator`; `post_comment()` gate → moderator/admin.
- Auto-promotion: `moderator_recommendations` + `recommend_moderator()` (3 distinct still-valid mods → promote).
  Admin appoint/revoke route; "Recommend as moderator (x/3)" button + MODERATOR badge on /sellers/[username].
- Auto-auth bot hook: `comments.source`/nullable author + `post_auto_lc()` (service_role only; bot NOT built).
- Migration `0036_moderator_lc.sql` (bootstraps verified_checker → is_moderator). `moderator_granted` notify (alerts).

**Exact next step — ORDER MATTERS:**
1. `db-guard` on `supabase/migrations/20240101000036_moderator_lc.sql`, then `supabase db push`.
2. Regen types (`unset SUPABASE_ACCESS_TOKEN && npx supabase login`; `supabase gen types ...`; `wc -l lib/supabase/types.ts`).
   tsc WILL fail until types include is_moderator/source/recommend_moderator — regen BEFORE verify.
3. `git add -A` (stages the removed comments-toggle route; then remove the empty `comments-toggle/` dir + `_to_delete/`).
4. `pnpm verify` + `pnpm build` → green.
5. `code-reviewer` on: `post_comment` gate, `recommend_moderator`, `post_auto_lc`, `/api/moderators/recommend`, `/api/admin/profiles/[id]/moderator`.
6. `ui-verifier` on the listing LC section + the profile MODERATOR badge/button.
7. Merge. Full spec: `docs/G10_moderator_lc.md`.

---

## Active workstream (2026-07-26): usage-based tiered fees + pre-launch gap program

**Business-model change:** no membership; always free to join. Per-side, usage-based
transaction fees — buyer's rate ← their trailing-365-day PURCHASES, seller's rate ←
their trailing-365-day SALES (completed, non-reversed orders; excludes cancelled/refunded).
Tiers: ≥$10k → 2.5% · ≥$5k → 3.5% · ≥$3k → 4% · ≥$1k → 4.5% · <$1k → 5.5%.
(Supersedes the old flat 2%/2% + $20/yr membership idea.)

**Done — branch `feat/tiered-fees` (gates passed; pending commit):**
- F1: tiered fee math in `lib/fees.ts` (`FEE_TIERS`, `feeBpsForVolumeCents`, per-side
  `*At` variants); legacy flat fns retained for migration. 27 unit tests; `pnpm verify` green.
- F2: `lib/fee-tier.ts` server-only resolver (trailing-365d volume → bps, fail-safe to BASE);
  migration `0017_tiered_fees.sql` (composite trailing-volume indexes).
- F3 money core: migration `0018_fee_bps_snapshot.sql` (bps columns on checkout_sessions +
  orders, backfill 200); `app/api/checkout/route.ts` charges tiered via `orderAmountsAt` +
  snapshots bps; webhook copies bps onto the order. Typecheck-clean; code-reviewer + db-guard PASS.

⚠️ **Live checkout now CHARGES tiered rates but displays still SHOW flat 2%.** The branch must
NOT deploy/merge until the F3 display half is complete.

**Next:** F3 display half — refactor the ~20 fee-display sites (viewer's live rate for
prospective fees; snapshotted bps for receipts), retire the legacy flat fns, add tier UX.
Start at **Step 4** of `docs/prompts/F3_fee_wiring.md`. Run on-computer (native tsc + ui-verifier).

**Full program:** `docs/LAUNCH_ROADMAP.md` — phased plan + kickoff prompts for F3 and gap
features G1–G9 (recs integration, notifications, shipping/tracking, ID verification, auth
badge, T&S ops, bump, saved-search alerts, follows/reviews) + founder-only items. Gap
features are scaffolded behind flags in `lib/flags.ts` (all default off). Several PA-backlog
items below are now folded into these phases (carrier webhook → G3, ID verification → G4,
saved Searches/Sellers tabs → G8/G9).

---

## HF5 — Mobile overhaul + Messages layout (audit-driven)

### Summary
Fixed all CRITICAL and HIGH issues from `docs/AUDIT-2026-07-14.md`. The app now
has a fully functional mobile experience: bottom tab bar, responsive headers,
single-pane messages, no horizontal overflow, and >=44px tap targets on all mobile
routes.

### What was built/changed

**TASK 1 — Global mobile bottom tab bar (CRITICAL)**
- `app/components/mobile-tabbar.tsx` — fixed bottom, 56px, white, 1px --line top
  border, safe-area inset padding, 5 tabs (FEED/DISCOVER/SELL/MESSAGES/PROFILE),
  inline SVG 20px line icons, active=solid --ink, inactive=--ink-soft, Inter 10px
  caps labels, data-testid="mobile-tabbar"
- Rendered on ALL authenticated routes at <768px, hidden on desktop via CSS
- SiteHeader: mobile variant shows wordmark + search + avatar only

**TASK 2 — /messages layout (CRITICAL mobile, HIGH desktop)**
- Mobile: `/messages` = full-screen conversation list; `/messages/[id]` = full-screen
  thread with back chevron + counterparty name header
- Desktop: two-pane with bordered containers, sidebar header, anchored empty state

**TASK 3 — Mobile fixes across remaining routes**
- `/sell`: progress indicator wraps at 375px, photo grid 3-col on mobile
- `/listings/[id]`: single-column grid on mobile, 3-col thumbnails, responsive padding
- `/saved`: 2-col grid on mobile, responsive padding
- `/sellers/[username]`: 2-col listings grid, responsive padding
- All pages: overflow-causing 80px padding replaced with responsive 16px on mobile

**TASK 4 — Tap targets (HIGH)**
- All interactive elements on mobile raised to >=44px effective touch height

### Audit results (post-HF5)
```
MOBILE:  ALL 7 ROUTES CLEAN (0 H-overflow, 0 missing-tabbar, 0 JS errors, 0 tap-targets <40px)
DESKTOP: all routes render, tap-targets <40px are expected (mouse-fine)
```

### Verify state (HF5)
```
pnpm verify      ✓  133 unit tests, 0 errors
pnpm verify:ui   ✓  62 passed (14 new), 3 skipped (@live), 0 failures
node audit.mjs   ✓  ALL mobile routes CLEAN
```

### Key files added
```
app/components/mobile-tabbar.tsx      — Mobile bottom tab bar
tests/e2e/mobile.spec.ts             — 11 mobile e2e tests
```

### Key files modified
```
app/globals.css                       — Responsive media queries
app/components/site-header.tsx        — Responsive header
app/components/avatar-menu.tsx        — 44x44 tap target
app/components/listing-card.tsx       — Save button tap area
app/messages/page.tsx                 — Bordered list, empty state, MobileTabBar
app/messages/[id]/page.tsx            — Mobile single-pane, back chevron, sidebar
app/messages/[id]/thread-client.tsx   — Responsive padding
app/browse/browse-client.tsx          — MobileTabBar, header, tap targets
app/sell/page.tsx                     — Wrapping steps, MobileTabBar, username fetch
app/sell/sell-form.tsx                — 3-col photo grid on mobile
app/listings/[id]/page.tsx            — Responsive grid, MobileTabBar, tap targets
app/listings/[id]/condition-popover.tsx — 44px tap target
app/listings/[id]/community-section.tsx — Tab buttons 44px
app/saved/page.tsx                    — MobileTabBar
app/saved/saved-client.tsx            — Responsive grid, unsave button, tab heights
app/sellers/[username]/page.tsx       — MobileTabBar, responsive grid/padding
app/settings/page.tsx                 — MobileTabBar
app/settings/settings-client.tsx      — Back chevron 44px
docs/AUDIT-2026-07-14.md             — RESOLVED section
docs/ROADMAP.md                       — HF5 entry
```

---

## Blockers

None.

---

## PA backlog (from B8 security review + HF4)

- Replace in-memory rate limiter with pg-based counter for multi-instance correctness
- Add nonce-based CSP to eliminate `'unsafe-inline'` in script-src
- Validate `images[]` URLs against storage domain allowlist
- Add UUID validation to admin path params (profileId, commentId)
- Carrier-scan webhook (auto-confirm delivery)   → now roadmap G3
- ID verification provider (Stripe Identity or Persona)   → now roadmap G4
- Fix `generate_member_codes` RPC: qualify `extensions.gen_random_bytes`
- Saved page: implement Searches and Sellers tabs (currently stubbed)   → now roadmap G8/G9
- See LAUNCH.md §8 for full PA backlog

---

## Session start ritual

```
Read CLAUDE.md and docs/HANDOFF.md, then docs/LAUNCH_ROADMAP.md for the current phase.
For launch checklist status, read docs/LAUNCH.md.
```

---

## ALPHA BUILD COMPLETE

All B0-B8 milestones + HF1-HF5 complete. The codebase is ready for private alpha launch.
Follow `docs/LAUNCH.md` to deploy.
