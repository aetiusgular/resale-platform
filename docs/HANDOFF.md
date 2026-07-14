# HANDOFF.md
## Current state: HF5 COMPLETE — MOBILE OVERHAUL + MESSAGES LAYOUT

**Last updated:** 2026-07-14
**Next prompt:** PA (post-alpha) — see LAUNCH.md §8 for PA backlog

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

All B0-B8 milestones + HF1-HF5 complete. The codebase is ready for private alpha launch.
Follow `docs/LAUNCH.md` to deploy.
