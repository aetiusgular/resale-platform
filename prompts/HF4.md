# HF4 — Saved Items page (new design export) + navigation performance

READ FIRST: CLAUDE.md, docs/HANDOFF.md, docs/DESIGN_MAP.md, and the NEW export
now in the repo: design-reference/saved-items-export/Saved Items.dc.html
(+ its tokens/ and styles.css — same token system as the rest).

RUN CONTEXT: .env.local exists (never print/commit); supabase env parsed inline
if migrations needed (pnpm exec supabase db push --yes); ANTI-HANG rules; commit
locally, no GitHub push. Model policy: opus everywhere.

## ISSUE 1 — SAVED button is a dead link (confirmed)
app/components/site-header.tsx links SAVED → /browse?saved=1, but NOTHING reads
a `saved` param (grepped: zero handlers in app/browse/page.tsx or
app/api/browse/route.ts), and there is no /saved route. Clicking it silently
shows unfiltered browse.

BUILD /saved per design-reference/saved-items-export/Saved Items.dc.html:
- Read the export FIRST and follow its structure/typography exactly. Use the
  existing token system (app/globals.css @theme) — do not import the export's
  CSS files; they are reference only.
- Server component page + client interactivity, matching the patterns already
  used in app/browse/page.tsx + browse-client.tsx (SiteHeader, listing cards).
- REUSE the ListingCard from browse (extract it to app/components/listing-card.tsx
  and import in BOTH places — it now carries the uniformity fix: grid parent must
  use minmax(0, 1fr), title capped at 38 chars via truncateTitle, fixed-height
  meta rows, 3:4 aspect-ratio image. Do NOT fork a second card implementation).
- Data: saves table (exists, from B4) joined to active listings; owner-only RLS
  already in place — verify, do not weaken.
- Unsaving from this page removes the card optimistically (with revert on error).
- Empty state per the export's tone (EB Garamond italic one-liner + link to browse).
- Point site-header SAVED at /saved (not /browse?saved=1). Sold/removed listings
  that a user saved: show per the export if it has a state for it, else render the
  card with a mono "NO LONGER AVAILABLE" line in --ink-soft and disable the link.
- Add the row to docs/DESIGN_MAP.md.

## ISSUE 2 — slow page-to-page navigation (real, but NOT what it looks like)
MEASURED: production build serves /enter in 5–10ms; dev mode ~1–2s (webpack
recompile per route — expected, ignore). So the perceived slowness is mostly dev
mode. HOWEVER there IS a genuine production latency problem to fix, because every
navigation pays for serial Supabase round-trips:
  a. middleware.ts calls auth.getUser() AND a profiles SELECT on EVERY request.
  b. app/browse/page.tsx then calls getUser() AGAIN plus ~6 more sequential
     awaits (listings → price history → counts → saves → profile).
Each is a separate network hop to hosted Supabase; they add up.

FIX (do not break auth or RLS — this is SENSITIVE; code-reviewer-critical
subagent review is MANDATORY before commit):
- Parallelize independent queries with Promise.all in app/browse/page.tsx (and
  any other page doing the same serial pattern — audit /listings/[id], /messages,
  /settings, /sellers/[username]). Queries that depend on a prior result stay
  sequential; everything independent runs concurrently.
- Middleware: keep auth.getUser() (required — never trust getSession()), but
  eliminate the per-request profiles SELECT on paths that don't need it. Only the
  gate check needs invited_by/role; cache that result in a signed/httpOnly cookie
  (short TTL, e.g. 10 min) and re-validate on miss. If a cookie approach adds
  risk, an acceptable alternative is skipping the profiles query for paths already
  known-public and for users whose gate status is confirmed. Whatever you choose:
  a user who has NOT redeemed a code must still be gated; write a test proving it.
- Add prefetch to primary nav Links (Next.js Link prefetch is on by default for
  viewport links — verify SiteHeader/cards aren't opting out with prefetch={false}).
- Do NOT introduce client-side data fetching to "feel" faster; keep SSR.

## VERIFY
- pnpm verify + verify:ui green (all 44 e2e must still pass).
- New @live specs: SAVED in header navigates to /saved; a saved listing appears
  there; unsaving removes it; empty state renders for a user with no saves; a
  non-owner cannot read another user's saves (RLS).
- Gate regression spec: user with no redeemed invite code still cannot reach
  /browse (proves the middleware optimization didn't open a hole).
- Perf: measure with a production build (pnpm build && pnpm start) — record
  before/after server response times for /browse in docs/HANDOFF.md. Report the
  number of Supabase round-trips per /browse render before and after.
- ui-verifier: /saved vs Saved Items.dc.html at 1440 and 375px.
- code-reviewer-critical: mandatory (middleware/auth touched).

FINISH: HANDOFF entry (incl. perf numbers); conventional commit; summary ending
"HF4 COMPLETE — GATE GREEN" or "HF4 BLOCKED: <reason>".
