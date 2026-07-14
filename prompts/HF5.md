# HF5 — Mobile overhaul + Messages layout (audit-driven)

READ FIRST: docs/AUDIT-2026-07-14.md (measured findings — this prompt implements
its CRITICAL/HIGH list), CLAUDE.md, docs/HANDOFF.md, docs/DESIGN_MAP.md, and the
design exports that define the mobile shell:
- design-reference/Settings.dc.html — frame 1e shows the MOBILE BOTTOM TAB BAR
  (FEED · DISCOVER · SELL · MESSAGES · PROFILE) and the index→detail push pattern
- design-reference/Messages.dc.html — desktop two-pane AND mobile single-pane
- design-reference/Browse Results.dc.html — mobile filter drawer
- design-reference/Listing Detail.dc.html — mobile sticky action bar + tab bar

RUN CONTEXT: .env.local exists (never print/commit). ANTI-HANG rules. Commit
locally, no GitHub push. Model: opus (design-fidelity work — generic/off-system
UI is a BLOCKING failure even if tests pass).

DEV SERVER NOTE: a dev server is already running on :3000. Do NOT run `pnpm
build`/`pnpm start` (it hijacks the port and breaks the founder's browser).
Playwright's config manages its own server; leave :3000 alone.

## TASK 1 — Global mobile bottom tab bar (CRITICAL)
Build app/components/mobile-tabbar.tsx per the exports: fixed bottom, 56px,
white, 1px --line top border, safe-area inset padding (env(safe-area-inset-bottom)),
five items — FEED (/), DISCOVER (/browse), SELL (/sell), MESSAGES (/messages),
PROFILE (/sellers/[own-username]) — Inter 10px caps labels + simple 20px line
icons (inline SVG, monochrome, no icon library). Active = solid --ink icon+label;
inactive = --ink-soft. SELL is a normal item (no center FAB, no accent colour).
Unread dot on MESSAGES when unread conversations exist (accent green).
- Render it on ALL authenticated routes at <768px ONLY. Hide on desktop.
- Add data-testid="mobile-tabbar".
- Every page must get bottom padding (>=72px) at mobile so content never hides
  behind the bar.
- SiteHeader on mobile: reduce to wordmark (→/) + search + avatar; move SAVED and
  MESSAGES into the tab bar / avatar menu. Fix the horizontal overflow (audit
  found NAV + anchors exceeding viewport on every mobile route).
- PROFILE tab needs the viewer's own username: fetch it where the tabbar is
  mounted (server layout) and pass down — do not fetch per-tab-render.

## TASK 2 — /messages layout (CRITICAL mobile, HIGH desktop)
Per Messages.dc.html:
- MOBILE: single pane. Conversation list fills the screen; tapping a conversation
  pushes the thread view (back chevron + counterparty name in header); no
  side-by-side, no horizontal overflow. Use a route param or state — whichever is
  simpler and keeps deep-linking working (/messages/[id] preferred).
- DESKTOP: keep two-pane but give it real structure per the export: list pane and
  thread pane as bordered containers (1px --line), correct padding rhythm, and the
  empty states anchored per design (not floating mid-void). The bare divider rule
  and unanchored "Select a conversation" text are the specific complaints.
- Preserve all existing B6 functionality: realtime, offers cards, link redaction,
  consent banner, counterparty record line.

## TASK 3 — Mobile fixes across remaining routes
- /sell: 4-step progress indicator overflows at 375px — make it wrap or scale.
  Audit every step of the sell flow at 375px (photo slots grid → 2 cols).
- /listings/[id]: verify the mobile layout from the export is intact (swipeable
  gallery, sticky bottom action bar ABOVE the tab bar — they must not collide).
- /settings: mobile index→detail push pattern per export frame 1e/1f (it currently
  renders but verify no overflow and that back navigation works).
- /saved, /sellers/[username], /browse: no horizontal overflow at 375px.

## TASK 4 — Tap targets (HIGH)
Raise interactive elements to >=44px effective touch height on mobile (padding is
fine — do not visually inflate the design; use padding/negative margin so the hit
area grows without changing the look). Priority: filter section headers, save
buttons, sort dropdown, tabs, chevrons, checkbox rows.

## VERIFY (all must pass)
- Re-run the audit harness: `node audit.mjs` — required outcome: ZERO
  H-OVERFLOW, ZERO NO-BOTTOM-TABBAR, zero JS errors, and tap-targets <40px
  reduced to 0 on mobile routes. Paste the resulting table into HANDOFF.
- pnpm verify + pnpm verify:ui green (all existing specs must still pass).
- New Playwright specs (mobile viewport 375x812): tab bar visible on every
  authenticated route; tapping MESSAGES navigates; thread opens single-pane with
  back nav; no horizontal scroll (document.scrollWidth <= innerWidth + 2) on
  every route; sticky action bar and tab bar do not overlap on listing page.
- ui-verifier subagent: /messages (both breakpoints) and mobile tab bar vs the
  exports.
- code-reviewer: routes/layout changes only — no auth/money paths touched.

FINISH: update docs/AUDIT-2026-07-14.md with a RESOLVED section; HANDOFF entry;
conventional commit; summary ending "HF5 COMPLETE — GATE GREEN" or
"HF5 BLOCKED: <reason>".
