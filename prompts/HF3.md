# HF3 — QA batch 3: hydration warning, card uniformity v2, infinite scroll, settings build-out

READ FIRST: CLAUDE.md (note MODEL_ROUTING policy), docs/HANDOFF.md,
docs/DESIGN_MAP.md row for Settings + design-reference/Settings.dc.html.
RUN CONTEXT: .env.local exists (never print/commit); supabase env parsed
inline if migrations needed (pnpm exec supabase db push --yes); ANTI-HANG
rules; commit locally, no GitHub push.

ISSUES:

1. HYDRATION WARNING (browser-extension noise): Grammarly injects body
   attributes pre-React. Add suppressHydrationWarning to <body> in
   app/layout.tsx. One-line fix, nothing else.

2. CARD UNIFORMITY V2 — HF2's fix didn't hold: images still render at
   differing heights (seed images have varying intrinsic ratios and the
   container is not enforcing shape). Requirements, verified by measurement:
   a. Image wrapper: width 100%; aspect-ratio: 3/4; overflow hidden.
      <img> inside: width/height 100%, object-fit: cover. NO height from
      the image itself, ever.
   b. Title: single line, overflow hidden, text-overflow ellipsis,
      white-space nowrap AND hard cap display at 38 chars (slice + "…" —
      keeps mono rows visually equal even before ellipsis kicks in).
   c. Every text row fixed height (timestamp/title/price/size·condition/
      badges/save) so all cards in a row align at every line — including
      when old-price strikethrough or VERIFIED is absent (render empty
      placeholders with the same height).
   d. Playwright spec: for the first grid row, assert all card image boxes
      have identical height AND all title baselines equal y (±1px); assert
      a title longer than 38 chars renders truncated.

3. INFINITE SCROLL on /browse: keep cursor pagination, replace manual-only
   LOAD MORE with IntersectionObserver sentinel ~600px before list end:
   auto-fetch next page while scrolling, small mono "LOADING…" line during
   fetch; keep the LOAD MORE button as no-JS/error fallback; stop observing
   when exhausted ("END OF THE ARCHIVE" line per design tone). Debounce so
   fast scrolling can't double-fetch (in-flight flag). Spec: scroll to
   bottom → more cards appear without click.

4. SETTINGS PAGES ARE EMPTY — /settings renders a shell with nothing in it.
   Build per design-reference/Settings.dc.html (founder attached the export
   screens as reference — they show exactly: left rail ACCOUNT[PROFILE,
   MY SIZES, ADDRESSES, PAYMENTS] SELLING[LISTINGS, OFFERS, VACATION MODE]
   TRUST[VERIFICATION, PRIVACY, NOTIFICATIONS]; active item = black text +
   2px left rule; mobile = index list pushing detail screens):
   a. MY SIZES pane — chip multi-selects TOPS XS–XXL / BOTTOMS 26–40 /
      FOOTWEAR 6–14 incl halves, black fill when active, helper "used by
      the MY SIZES filter and size alerts — never shown publicly", Save
      disabled until dirty; persists to profiles.quick_setup (or the
      existing sizes jsonb field — reuse whatever B1 stored) and the
      /browse MY SIZES toggle MUST read the same field (wire end-to-end;
      spec: set sizes M + 32, enable toggle on browse, only matching
      listings remain).
   b. ADDRESSES pane — address cards (name, lines, DEFAULT chip, EDIT/
      REMOVE), inline edit form per export (FULL NAME/STREET/CITY/
      STATE·ZIP/COUNTRY, SET AS DEFAULT checkbox, Save/Cancel), Add
      address. Store in an addresses table if none exists (owner-only RLS
      + grants, db-guard review) or reuse existing storage from B1
      quick-setup if present.
   c. PAYMENTS pane — PAYMENT METHODS list from B5 saved methods (VISA ··
      4242 row style, DEFAULT chip, REMOVE / MAKE DEFAULT), Add card
      (B5 SetupIntent flow), Link PayPal (disabled, "beta"), the lock-line
      microcopy from the export verbatim; PAYOUTS section: real Stripe
      Connect status (connected → "PAYOUT ACCOUNT · CONNECTED BANK ·· N +
      manage in Stripe" / else "Set up payouts" button wired to the B5
      onboarding flow + "required before your first listing goes live").
   d. PROFILE pane — username (read-only, "permanent"), email, location
      dropdown; LISTINGS/OFFERS panes — link out to existing pages (simple
      rows, not new builds); VACATION MODE / VERIFICATION / PRIVACY /
      NOTIFICATIONS — nav items present, pane renders design-consistent
      "coming soon" placeholder (EB Garamond italic one-liner), no dead 404s.
   e. Mobile: settings index → detail screens with back chevron per export;
      global tab bar present.

VERIFY: pnpm verify + verify:ui green; new specs above pass; ui-verifier
(haiku) compares /settings MY SIZES + PAYMENTS panes and the /browse grid
vs the exports at 1440px; code-reviewer (sonnet) pass — addresses table RLS
and payments pane read-paths get db-guard/code-reviewer attention; nothing
here moves money (payment mutations reuse existing B5 routes untouched).

FINISH: HANDOFF entry; conventional commit; summary ending
"HF3 COMPLETE — GATE GREEN" or "HF3 BLOCKED: <reason>".
