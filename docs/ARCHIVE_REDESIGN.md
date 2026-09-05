# ARCHIVE redesign — frontend port (branch `ui/archive-redesign`)

The approved design review (`Downloads/frontend`, a Vite/React reference app) was ported into the
live Next.js app. Every route now renders in the ARCHIVE system: Archivo + IBM Plex Mono, the
`--bg … --alert` token vocabulary, light / dark / system themes, one shared chrome
(`app/components/app-shell.tsx`), and the reference's component sheet (`app/globals.css`).

## What changed

- **Tokens + theme** — `app/globals.css` now starts with `:root` (light) and `[data-theme='dark']`
  palettes; Tailwind's `@import`/`@theme` are gone (no utility classes were in use). Legacy
  `--color-*` aliases resolve to the new palette. Theme is stored under `archive-theme`, applied
  before first paint by a nonce'd inline script in `app/layout.tsx`, and managed by
  `app/components/theme.tsx` (`useTheme`, `ThemeSegment`). Toggle lives in the account popout
  (LIGHT / DARK) and Settings → Appearance (LIGHT / DARK / SYSTEM).
- **Shared chrome** — `AppShell` = sticky header (wordmark, search, SELL / SAVED / MESSAGES,
  avatar → account popout → notifications popout) + footer. Guests get SELL + SIGN IN; gated
  actions open the auth modal (design 1R) instead of bouncing to `/enter`. The mobile tab bar from
  the first pass is gone — see "Mobile web" below.
- **Pages** — browse 16A (filter rail, results head, MY SIZES, sort menu, mobile filter sheet),
  sizes modal 11A/B, listing 4A (gallery + placard + condition scale + legit-check thread), saved,
  messages inbox + thread (offer cards, composer), sell catalog + listing wizard, settings hub and
  sections (address, sizes, notifications, payouts, phone, tiers), orders list + buyer/seller order
  views + dispute, checkout + success, boost, seller profile, onboarding (`/enter`, login, forgot,
  reset, account, verify, setup, banned), info/legal (about, help, trust, terms, privacy, fees),
  admin console (queue, moderation, metrics), styleguide, branded 404 + route error page, and
  every `loading.tsx` skeleton.
- **Brand strings** — `app/components/brand.ts` (`ARCHIVE`, `ALPHA 01`, footer lines). `lib/seo`'s
  `SITE_NAME` still says "Resale Platform" for metadata; swap it when the name is final.

## Feature alignment (second pass) — backend + UI now match the reference feature set

Everything the reference app shows is now real and wired end to end. Backend additions live in
one migration, `supabase/migrations/20240101000045_archive_reference_features.sql`
(**db-guard review required before push**), plus the API routes and pure libs listed below.

- **Browse 16A** — `lib/browse/filters.ts` is the ONE parser + WHERE/ORDER builder shared by
  `app/browse/page.tsx` and `/api/browse` (URL: `q dept cat subcat(csv) size sizes brand(csv)
  color(csv) min_price max_price verified authenticated dropped sold sort offset`; `dept` and
  `cat` are csv lists, `subcat` picks are `Category:Subcategory` keys because Denim lives under
  Outerwear and Bottoms — bare labels in old links still resolve). Rail: DEPARTMENT is multi-select
  (rows toggle, OR together) · CATEGORY where EVERY category row (Sportswear and Other included,
  0-count rows too) is an open / close subsection: the row only folds / unfolds its tree (`+` / `−`),
  never filters; ticks inside select — "All <cat>" is the whole category and shows every child
  ticked, unticking a child under "All" keeps the other children, ticking the last child collapses
  back to "All" (the URL normalises the same way) — and any number of categories and
  subcategories can be on at once (WHERE: whole categories OR (category AND its picks), one
  PostgREST `or` group). The row's active state (dot, bold label + count) follows what is ticked
  inside, so opening a tree never activates it; folding keeps the selection. Chips: one per
  department, whole category and pick (`BOTTOMS · DENIM` when the label is ambiguous); results
  header reads `Menswear + Womenswear / 3 categories` · DESIGNER search +
  VIEW ALL n → · COLOR swatches · PRICE · SHOW ONLY (Authenticated, Verified sellers, Price
  dropped, Sold items). Results header cycles SORT: NEWEST → PRICE ↑ → PRICE ↓; chips include the
  solid MY SIZES chip; LOAD MORE — SHOWING n OF m. Own cards show BUMP ↗ (POST …/bump). MY SIZES
  defaults ON when Settings → My sizes → "Hide listings that aren't my size" is on
  (`profiles.hide_not_my_size`; `?my_sizes=0` turns it off for a visit). Sold listings are
  publicly readable (SHOW ONLY → Sold items, "SOLD 3D AGO" detail pages).
- **Sizes** — `lib/sizes.ts`: dept-scoped storage (`{"menswear:tops": […]}`), modal 11A/11B with
  MENSWEAR / WOMENSWEAR tabs and per-section summaries, Settings 2C groups, `sizeScaleFor()` for
  the wizard SIZE select. Legacy flat keys still read as menswear.
- **Listing 4A** — crumb `← SEARCH · DEPT / CATEGORY / SUBCATEGORY`, MEASUREMENTS — FLAT with
  IN / CM (`listings.measurements`, labels by category), spec `SIZE · COLOR`, `+ $x SHIPPING · US`,
  LC chip `LC n LEGIT · VERDICT ↓`, seller row `4.9 · 132 SALES · VERIFIED ID` + FOLLOW
  (`lib/sellers/stats.ts`), view counter (`/api/listings/[id]/view` → `bump_listing_view`).
  Community legit check: any verified member posts + casts ONE LEGIT/FLAG vote per listing
  (`comments.vote`, `post_comment` v3), tags `LC · LEGIT` / `LC MOD` / `AUTO-AUTH`, meta
  `AGREE n · FLAG · REPLY`, strip `LEGIT CHECK — n LEGIT · n FLAGGED / AUTO-AUTH · MOD VERDICT`.
  Condition (1–10) is kept and shown in the DESCRIPTION label row.
- **Header / popouts** — MESSAGES unread badge from `conversation_reads` +
  `unread_conversation_counts()` (`/api/conversations/unread`); avatar initials from the display
  name (`getViewer()`); account popout = VIEW PROFILE (→ settings) · Notifications · Orders
  (→ /settings/orders) · Settings · THEME · Sign out. Notifications popout renders reference rows
  from the event payload (`notifications.data`) with inline ACCEPT / COUNTER / DECLINE on unread
  offers (`offerId` + `conversationId` in the payload), PRINT LABEL → / VIEW OFFER → links, push
  prompt, MARK ALL READ, ALL nn / UNREAD nn. New events: `offer_declined`, `offer_countered`,
  `price_drop`, `listing_approved`; prefs are per event (7 rows × EMAIL / PUSH).
- **Saved** — "n PRICE DROPS · n SOLD SINCE LAST VISIT" (`profiles.saved_visited_at`,
  `POST /api/saves/visit`); searches: chip line, `n NEW` (`saved_searches.last_seen_at`), ALERTS
  ON/OFF (`alerts_enabled`, `PATCH /api/saved-searches/[id]`), VIEW →, remove; sellers:
  `n LISTINGS · 4.9 RATING`, `n NEW THIS WEEK`, FOLLOWING.
- **Messages** — `n UNREAD` / ALL READ, per-thread unread badges, thread opens → read cursor
  (`mark_conversation_read`), thread bar VIEW PROFILE + REPORT (`reports` table), order milestones
  as system lines, offer flow: ACCEPT / COUNTER / DECLINE → ACCEPTED + PROCEED TO CHECKOUT →,
  COUNTERED + `YOUR COUNTER · PENDING · AWAITING @x`, `?counter=<offerId>` pre-arms the counter.
- **Settings** — hub: PROFILE (avatar CHANGE PHOTO / REMOVE via `avatars/{uid}/…`, USERNAME
  changeable 1× / 30 days by DB trigger, DISPLAY NAME, EMAIL VERIFIED, SAVE CHANGES → SAVED ✓),
  PHONE, SELLER TIER (`Tier n`, CURRENT FEE / TIER n+1 FEE / REVIEW DATE, qualifying-sales bar),
  APPEARANCE, danger row with DELETE ACCOUNT… (`POST /api/account/delete`, typed DELETE; blocked
  while orders are open; hard delete or anonymise). `/settings/orders` (moved from `/orders`,
  which now redirects; `/orders/[id]` detail stays), `/settings/review?order=` (rate cells 1–5,
  tags, 600-char body editable 48h, up to 3 photos — `post_review` / `update_review`), ADDRESS
  book (`addresses` table, DEFAULT / SET DEFAULT / EDIT / REMOVE, ADD NEW ADDRESS + Set as default;
  the default mirrors into `profiles.shipping_address` and `ship_from_address`), MY SIZES
  (switch + MENSWEAR / WOMENSWEAR tabs), NOTIFICATIONS (7 rows), PAYOUTS (AVAILABLE / PENDING
  ESCROW / PAID OUT — ALL TIME + HISTORY LAST 90 DAYS from `/api/stripe/balance`).
- **Sell** — catalog: `n ACTIVE · n DRAFTS · n SOLD · TIER n — x% FEE`, tabs ACTIVE / DRAFTS /
  SOLD, meta `n VIEWS · n SAVES · n OFFER · LISTED nD`, EDIT · BUMP ↑ · OFFER $x / BUMPED nD AGO,
  drafts `n OF 6 PHOTOS · NO PRICE SET` + CONTINUE → / SAVED TUE, sold `SOLD AUG 12 · PAID OUT $x`
  + RELIST / VIEW ORDER. Wizard: 5-step rail with live meta, DRAFT AUTO-SAVED (drafts are
  partial `listings` rows — `POST /api/listings/drafts`, debounced `PATCH /api/listings/[id]`),
  photos, details (TITLE / BRAND / CATEGORY "Menswear / Tops / Polos" / SIZE / COLOR / CONDITION),
  1000-char description, measurements, pricing with the live fee box (TIER n FEE, WELCOME RAMP),
  shipping "Buyer pays — $x flat", SAVE DRAFT / PUBLISH LISTING → (`POST /api/listings` with
  `draft_id`), `?edit=` re-opens a live listing (photos locked; a price cut notifies savers),
  RELIST copies a sold/removed row into a draft. Titles keep the seller's casing (brand + size
  stay upper-case).
- **Auth / info** — `/enter` is the signup form: email + password only (MIN 10 CHARACTERS · AT
  LEAST 1 NUMBER), username derived from the email (`lib/auth/username.ts`), straight to browse;
  the auth modal's CREATE ACCOUNT tab is the same form inline; OAuth finishes at
  `/onboarding/account` with an auto username. Footer order ABOUT · PRIVACY · HELP & FAQ · TERMS ·
  TRUST; about / help / trust copy follows the reference.

### Product decisions taken (flag anything you want reversed)

- Condition 1–10 stays (backend invariant) and is surfaced in the wizard CONDITION select and the
  listing DESCRIPTION label row; the reference had no condition field.
- Community LC posting is open to **verified** members (moderators/admins always); the RPC is the
  authority. Sold listings keep their thread readable but closed.
- The escrow line reads `ESCROW · AUTHENTICATED · TRACKED` only when the item is authenticated
  (otherwise `LEGIT CHECKED`) — the reference always said AUTHENTICATED.
- Signup no longer detours through /onboarding/verify + /onboarding/setup; both stay reachable
  (verify from Settings when `VERIFICATION_ENABLED`, sizes from the MY SIZES modal).
- Listing titles are stored as typed (previously upper-cased on insert) so cards read
  "1998 painter-dyed tee" like the reference.
- `/orders` → `/settings/orders` redirect; FEES left the footer (Settings → VIEW FEE SCHEDULE →).
- "Signed in as @x on n devices" — the device count is not tracked; the line omits it.

## Behaviour notes / known gaps

- `middleware.ts` `PUBLIC_PATHS` gained `/about`, `/help`, `/trust` (first pass).
- Feature-flagged UI (follows, reviews, notifications, bump, boost, auth badge, tiers, phone) stays
  hidden until its flag is on — `lib/flags.ts` was not touched.
- Push prompt in the notifications popout needs `NEXT_PUBLIC_VAPID_PUBLIC_KEY`; without it the
  prompt is hidden (status `unconfigured`).
- Reference "SELLER LOCATION" and "FOLLOWED SEARCHES" rail rows stay SOON, as in the reference.
- **Social auth (Sign Up Pages 3A/3B/3C handoff, Sept 2026):** `app/components/social-auth-buttons.tsx`
  is the one Google / Apple block — stacked CONTINUE WITH GOOGLE / APPLE rows with brand marks on
  desktop, the split GOOGLE | APPLE pair at ≤720px (`useCompact`, shared with the header search) —
  used by the auth modal (both tabs), `/enter` and `/enter/login`; `.btn-social` = 44px, 9px mono
  +0.16em, `--line-mid` border, hover `--ink` border + `--hover` fill. The old
  `app/enter/google-button.tsx` / `apple-button.tsx` are gone. Both buttons ALWAYS render (the
  handoff adds Apple to the desktop rows) — `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` /
  `NEXT_PUBLIC_APPLE_AUTH_ENABLED` are left in `lib/flags.ts` but nothing reads them any more; a
  provider that is not enabled in Supabase bounces back through `/api/auth/callback` to
  `/enter/login?error=oauth` with the provider's reason (Apple needs the Service ID + signing key). `docs/LAUNCH_SEQUENCE.md` / `LAUNCH_RUNBOOK.md` still describe the
  Google flag as what shows the button — update when convenient. Modal `title` is a prop (default
  SIGN IN TO CONTINUE; the sell gate derives SELLING NEEDS AN ACCOUNT).
- **Upstream, not ours:** on the production build about 1 in 20 `router.push` navigations on
  `/browse` (rail rows, header search, pre-redesign code path too) is silently dropped: the RSC
  request completes, the router applies the new state, then React's transition render suspends
  on the page's flight chunk, the ping lands while the root is in `RootSuspendedWithDelay`, and
  the render never commits (URL and grid stay put, the next click works). Traced with
  instrumented copies of `next/dist/client/components/*` and the vendored
  `react-dom-client.production.js` (React 19.2.0-canary-0bdb9206, Next 15.5.22). Nothing in
  app code triggers it (tested without `startTransition`, with prefetches and API calls
  blocked). Next step is a dependency bump (15.5.25 backport or 16.x) and re-running the
  60-navigation loop; `package.json` is protected so this was not attempted here.

## Mobile web (third pass — "Mobile WEB handoff", `Downloads/handoff 5/mobile-web`, Sept 5)

The first pass had put native-app chrome (a bottom tab bar) on the mobile breakpoint. The handoff
is explicit: mobile WEB and the native app share the visual language but not the chrome. What
ships now, all behind the one breakpoint `(max-width: 720px)` (`useCompact` / the CSS block in
`app/globals.css`):

- **Nav is always at the top.** The 6A header (wordmark; SELL / SAVED / MESSAGES icons + account
  chip; the search row only on `/browse` and `/saved`, `HeaderSearch` gates it by pathname). No
  tab bar (`app/components/mobile-tabbar.tsx` deleted, `TabBarGhost` gone from the skeletons), no
  native back-title bars, no status bar.
- **Footer on every page**, in the flow after the content (`.app-shell` is a `min-height: 100vh`
  column, `.footer { margin-top: auto }`). Pages that have no footer on desktop — messages, the
  auth frames, onboarding — render it with `<SiteFooter mobileOnly />` (`.footer--m`).
- **Docked bars are page controls, never navigation, and never fixed over the footer.** They are
  `position: sticky; bottom: 0` at the end of their page's flex column, so they sit at the
  viewport bottom while the page is in view and scroll away with the footer below them: browse
  `FILTERS · n | SORT · label` (`.dock`, 01), listing `BUY NOW · $ | MAKE OFFER` (`.pdp-dock`, 05),
  settings SAVE MY SIZES / SAVE PREFERENCES (`.save-row--dock`, 11–12), the thread composer (26).
  Sell's `+ NEW LISTING` (14), the wizard's SAVE DRAFT | PUBLISH → (15) and SUBMIT REVIEW → (16)
  are plain in-flow bars.
- **Overlays are sheets / takeovers**: the filter takeover (02: `FILTER (n)` / CLEAR FILTERS / ×,
  the rail with a MY SIZES row on top, SHOW n RESULTS), the sort sheet (03), the sizes editor and
  every `.modal` as a bottom sheet (04), the auth modal as a bottom sheet with CONTINUE BROWSING
  AS GUEST (25). The guest save gate names the item: `openAuthModal(next, { title: 'SIGN IN TO
  SAVE', cta: 'SIGN IN & SAVE →', listing })` (`AuthGate` in `auth-modal-provider.tsx`).
- **Browse (01)**: results head = count / scope / SAVE SEARCH +; MY SIZES lives in the takeover.
  **Listing (05)**: `.pdp__left` / `.pdp__right` become `display: contents` and the placard
  re-orders into the mock's stack (← BACK TO RESULTS, swipe gallery with counter pill + save
  bookmark + dots, brand / title / price + LISTED, SIZE · COLOR · CONDITION · SHIPPING rows, seller
  row with MESSAGE, then the LC chip, description, escrow, measurements, thread). The gallery is
  one scroll-snap track at every width (desktop shows the current slide). **Saved (06)**: `n ITEMS`,
  `SEARCHES · n` tabs, the "since your last visit" strip, the caption bookmark unsaves. **Inbox
  (07)**: initials, handle + time, preview, thumb, unread ■. **Thread (26)**: `← @HANDLE · VIEW
  LISTING` row, listing strip, composer docked. **Account popout (08)** hangs under the header
  over the dimmed page (same as desktop).
- **Settings (09–13)**: `/settings` is the menu (profile card, ACCOUNT / PREFERENCES / SELLING
  rows, THEME, Sign out · ALPHA 01 — `SettingsMenu`, mobile only; the desktop hub is unchanged and
  hidden there). The profile form gets its own route `/settings/profile` (`HubSection asProfile`)
  so the menu's Profile row has somewhere to go. Each section opens with the back row
  `← TITLE … meta` (`Crumb` — its desktop trail is the same component; `mobile="link"` gives the
  review page's `← BACK TO ORDERS`). Language from the mock is not a setting the app has, so that
  row is omitted; Orders / Phone / Fees & tiers are included because they exist.
- **Notifications page (27)**: new `/notifications` (`app/notifications/`) — the popout's data
  and `presentNotification`, as a page with `← NOTIFICATIONS · MARK ALL READ`. The account
  popout links there at ≤720px and opens the panel on desktop.
- **Sell (14–15)**: title + stats, 2-col owner cards, `+ NEW LISTING` bar; the wizard gets a
  step bar under the header (‹ · NEW LISTING · DRAFT ✓), progress segments and `STEP n OF 5 —
  …` from the existing `currentStep` / `stepDone` (the form stays one scroll — the mock's step
  count is presentation, not a rewrite of the wizard).
- **Onboarding (22–24)**: the order is now ACCOUNT → PREFERENCES → VERIFY (`StepRail`,
  `app/onboarding/step-rail.tsx`; bar = ARCHIVE + LOG OUT / @HANDLE). `/onboarding/setup`
  (preferences: sizes with MENSWEAR / WOMENSWEAR tabs, taste picks, shipping) continues to
  `/onboarding/verify`; verify's CONTINUE → goes back to the gate that sent the member
  (`?required=sell` → `/sell/new`, `payout` → `/settings/payouts`, else browse). The mock's
  "designers you follow" block is not built — the app follows sellers, not brands.
- **Auth pages (18–21)** keep the second-pass layout (they match 19/20; 18/21 differ from each
  other) and gain the footer.
- Dark = token swap only. Verified at 390×844 light + dark against the mock renders.

## Tests

- `tests/e2e/styleguide.spec.ts` updated for the two-font, eleven-token system (first pass).
- Deliberate test changes in the second pass: `tests/unit/notify-prefs.test.ts` and
  `tests/unit/notify-templates.test.ts` (sale → `sold`, saved_search → `search_alerts` buckets
  + the four new events), `tests/e2e/auth.spec.ts` (`/enter` is the email + password signup form)
  and `tests/e2e/signup-live.spec.ts` (signup lands in browse; username derived from the email).
  New: `tests/unit/archive-reference-libs.test.ts` (browse filters, taxonomy, sizes, addresses,
  draft fields, username, seller stat lines).
- `pnpm verify` (tsc, eslint, vitest — 424 tests) and `pnpm build` were green in the cloud
  container with a mocked Supabase; run them natively before merging. Non-`@live` Playwright:
  63 passed, 4 skipped.
- Third pass (mobile web): `tests/e2e/mobile.spec.ts` gained the browse dock / takeover / sort
  sheet checks, the footer-on-every-page checks and the `/notifications` gate; the old tab-bar
  assertions stay (they now prove it is gone). Container run: 70 passed, 4 skipped; vitest 426.
