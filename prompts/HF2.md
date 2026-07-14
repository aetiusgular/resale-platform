# HF2 — UI polish batch from founder inspection (4 confirmed issues)

READ FIRST: CLAUDE.md, docs/HANDOFF.md, docs/DESIGN_MAP.md rows for Browse
Results + Seller Profile, design-reference/Browse Results.dc.html +
Seller Profile.dc.html. RUN CONTEXT: .env.local exists (never print/commit);
supabase CLI env parsed inline if needed; ANTI-HANG rules; commit locally,
no GitHub push.

ISSUES (all reproduced on localhost by the founder):

1. REACT KEY WARNING — app/sell/page.tsx:32: fragment inside .map() without
   key. Fix: import { Fragment } and use <Fragment key={step.n}> (move key
   off the inner span). Check the whole codebase for the same pattern
   (grep for "<>" inside .map callbacks) and fix all instances.

2. LISTING CARD ALIGNMENT — on /browse, card images render at varying
   heights and the text blocks don't align across a row. Fix the listing
   card component: image container gets aspect-ratio: 3/4 with width 100%,
   object-fit: cover on the img (seed images vary in dimensions — the
   container must enforce shape, never the image). Text block below gets a
   fixed structure: line 1 timestamp (11px mono), line 2 title (one line,
   overflow ellipsis), line 3 price (+ strikethrough old price), line 4
   size · condition, line 5 badges/save — each line min-height fixed so
   rows align even when a line is empty (e.g. no VERIFIED tag). Cards in
   the same grid row must align pixel-perfect top and bottom.

3. NAVBAR GAPS — the header is missing account affordances and the wordmark
   isn't a home link everywhere:
   a. Wordmark "———" links to / on EVERY page (audit all headers — there
      appear to be multiple header instances; if so, extract ONE shared
      <SiteHeader> component used by all authenticated pages, per the
      design's header: wordmark left, search center, right side: Sell
      button, SAVED, MESSAGES, avatar).
   b. Avatar (32px circle, initials) with a simple dropdown: PROFILE
      (→ /sellers/[own username]), SETTINGS (→ /settings), LOG OUT
      (signOut + redirect /enter). Monochrome, 1px border, 2px radius,
      no icons.
4. SELLER PROFILE PAGE — /sellers/[username] is missing or stub. Build it
   per design-reference/Seller Profile.dc.html: header (avatar initials,
   username Space Mono, tier badge, VERIFIED ID microtag if id_verified,
   member-since), two-sided stats rows (AS SELLER / AS BUYER from
   buyer_stats view + seller aggregates; zeros fine for fresh accounts),
   tabs: LISTINGS (grid of their active listings using the fixed card,
   sort dropdown, NO filter rail) · REVIEWS (empty state ok — reviews table
   may not exist yet; render "no reviews yet" per design typography).
   Link seller names/blocks on listing pages + messages to these profiles.

VERIFY:
- pnpm verify green (fix any type errors introduced); pnpm verify:ui green.
- New/updated Playwright specs: no console errors on /sell (fail test on
  key warning), browse cards equal heights within a row (measure
  boundingBox y/height across 4 cards), wordmark navigates / from /browse
  and /messages and /sell, avatar menu logout lands on /enter, seller
  profile renders for a seeded founder with listings.
- ui-verifier: /browse cards + /sellers/[username] vs the two exports at
  1440px; fix reported deviations.
- code-reviewer pass (auth touched via logout + new profile route reads).

FINISH: HANDOFF update (HF2 entry); conventional commit; summary ending
"HF2 COMPLETE — GATE GREEN" or "HF2 BLOCKED: <reason>".
