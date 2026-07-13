# DESIGN_PROMPTS.md
### Ready-to-paste prompt pack for Claude Design — minimal white/black luxury-resale UI
Aligned to FEATURE_SET.md and PROJECT_PLAN.md milestones. Run prompts **in order, in one Claude Design project** — the tool retains context, so Prompt 1 establishes the design system and every later prompt inherits it.

---

## 0. How to prompt Claude Design (read before pasting)

**What the research says works:** design-system-first sequencing (later prompts inherit earlier ones); exact tokens (hex values, font names, px scales) rather than adjectives; a short product brief for context; explicit negative constraints ("do not add…"); one screen per prompt.

**Be detailed about:** colors as hex, fonts by exact Google Fonts name + weight, spacing/sizing numbers, every element that must appear on screen (named list), component states (hover, empty, error).

**Leave out / forbid (this is what prevents hallucination):**
- Never mention real brands' logos or trademarked UI. Say "placeholder brand names like 'MAISON ARCHIVE'."
- Don't describe features that aren't in FEATURE_SET.md — Claude will happily invent AR try-on and crypto checkout if you let it. Every prompt below ends with a DO NOT list; keep it.
- Don't ask for copywriting — supply exact microcopy where it matters (button labels, fee lines), otherwise say "use terse placeholder text."
- Don't stack multiple screens in one prompt; iterate one screen at a time and reference "the design system from this project."

**The font trio (all free, Google Fonts):**
- **Mono — listing names & prices:** `Space Mono` (400, 700). Archival/utilitarian, gives listings a "spec sheet" quality. Alternate if too quirky: `IBM Plex Mono`.
- **Serif — subheaders:** `EB Garamond` (400, 500 + italic). The current luxury-retail typographic vocabulary; quiet, editorial. Alternate: `Cormorant Garamond`.
- **Sans — main headers & UI chrome:** `Inter` (400–700, tight tracking) — the modern Helvetica-adjacent workhorse, closest free cousin to Grailed's look. Alternate with more personality: `Archivo`.

---

> **PROMPT STATUS (keep current):** 1 ✅ RUN · 2 ✅ RUN · 3 ✅ RUN · 4 ✅ RUN · 5 ✅ RUN · 6 ⏳ NEXT · 7 ⏳ · 8 ⏳ · 9 ⏳
> **Rule: a RUN prompt is locked.** Never edit its block, never re-run it — both cause drift. All changes to already-generated screens go through the ITERATION ASKS list at the bottom: short, surgical requests against the existing frame. Blocks 4 and 5 below contain seller-protection text added before they ran — if your generated frames match them, great; if not, the same content is covered in iteration asks A3–A5.

## PROMPT 1 — Design system (run first; everything inherits this)

```
You are a senior product designer creating the design system for a curated, invite-only
peer-to-peer marketplace for secondhand designer fashion and streetwear (think the
category Grailed occupies, but our own identity). Audience: 18–35 fashion resellers and
collectors. Personality: archival, precise, quiet confidence — a gallery, not a bazaar.

Create the foundational design system. Desktop-first (1440px), responsive down to 375px.

COLOR TOKENS (use exactly these, nothing else):
- --bg: #FFFFFF (all page backgrounds)
- --ink: #111111 (primary text, buttons)
- --ink-soft: #6B6B6B (secondary text, metadata)
- --line: #E5E5E5 (all borders, 1px only)
- --accent: #1B4332 (deep archival green — used ONLY for: verified badges,
  active states, "authenticated" tags, success. Max one accent element per view.)
- --alert: #B3261E (errors and dispute states only)
No gradients, no shadows heavier than 0 1px 2px rgba(0,0,0,0.06), no rounded corners
larger than 2px, no other colors anywhere.

TYPOGRAPHY (Google Fonts, exactly these three):
- Headers / nav / buttons: Inter — weights 500–700, tracking -0.01em, always sentence
  case in UI chrome, ALL CAPS only for nav items and section labels at 11–12px with
  +0.08em tracking.
- Subheaders / section intros / editorial lines: EB Garamond — 400 and italic,
  1.35rem–1.75rem. Used sparingly: one serif moment per screen.
- Listing titles, prices, sizes, condition scores, timestamps, usernames: Space Mono —
  400 and 700. ALL listing data is mono. This is the signature of the brand.
Type scale: 12 / 14 / 16 / 20 / 28 / 40px. Body 14px Inter 400, line-height 1.6.

SPACING & LAYOUT: 8px base grid. Max content width 1280px. Generous whitespace —
minimum 64px between page sections. Grid gutters 24px.

COMPONENTS TO DEFINE (show each with all states: default, hover, disabled, error):
1. Buttons: primary (solid #111 bg, white text), secondary (1px #111 border, white bg),
   text-only. Height 44px, 2px radius.
2. Listing card: 3:4 image on white, below it — Space Mono 700 14px title (one line,
   truncated), Space Mono 400 14px price, Space Mono 400 12px size + condition score
   "8/10" in --ink-soft. Optional 11px green "VERIFIED" tag. No card border; 1px
   --line border appears on hover only.
3. Input fields: 1px --line border, 2px radius, 44px height, floating label in
   Inter 12px caps.
4. Tier badge: four levels Bronze/Silver/Gold/Platinum — text-only chip, Space Mono
   11px caps in a 1px bordered pill; Platinum uses --accent border. No metallic colors,
   no icons.
5. Tag/chip, tab bar, dropdown, toast notification, modal (white, 1px border,
   centered, no overlay blur).

DO NOT: use any color outside the tokens above; use icons where text works; add
illustrations, emoji, or decorative graphics; use drop shadows for depth; round
corners beyond 2px; introduce dark mode; invent components not listed.
```

## PROMPT 2 — Browse / search results (FEATURE_SET §1, milestone M4)
*Revised: left-sidebar filter architecture (Grailed-style rail, rebuilt in our design language).*

```
Using the design system already established in this project, design the browse/search
results page (desktop 1440px + a 375px mobile variant).

STRUCTURE:
1. Header bar (64px, white, 1px --line bottom border): wordmark placeholder "———" top
   left (leave space, don't design a logo), center search input (max 480px, placeholder
   text "search designers, items"), right side: "SELL" secondary button, "SAVED" text
   link, "MESSAGES" text link, avatar circle 32px.
2. Results header row (above grid, full width): left — Space Mono 14px "79 LISTINGS
   FOR" followed by active-filter chips: bordered pills, Space Mono 11px caps text
   with ✕ (e.g., "MAISON ARCHIVE", "FOOTWEAR: 9", "CONDITION 7+"), then a "CLEAR ALL"
   text link. Right — solid primary button "FOLLOW SEARCH" and sort dropdown labeled
   "SORT: NEWEST" with open state shown in a separate detail frame listing: most
   relevant / newest / price ↑ / price ↓ / most saved (checkmark on active row).
   Chips stay monochrome: 1px --ink border, white bg — no blue, no fills.

3. LEFT SIDEBAR (240px fixed, the primary filter surface):
   a. MY SIZES module at top: 1px --line bordered box, toggle switch (accent green
      knob when on), label "My Sizes" Inter 14px 500, helper text 12px --ink-soft
      "hide listings that aren't your size", text link "edit".
   b. Filter sections stacked below, each: Inter 12px caps header + chevron,
      1px --line divider between sections, 24px vertical padding. Sections in order:
      DEPARTMENT, CATEGORY, SIZE, DESIGNER, PRICE, CONDITION, SELLER LOCATION,
      SHOW ONLY, FOLLOWED SEARCHES.
   c. Show three sections expanded: CATEGORY — checkbox list with Space Mono 11px
      counts right-aligned ("OUTERWEAR 1,204", "FOOTWEAR 890", "TOPS 2,113");
      CONDITION — the 1–10 rubric as a compact range selector with quick toggle
      "7+ ONLY"; PRICE — min/max inputs plus a "VERIFIED ONLY" checkbox lives under
      SHOW ONLY (expanded too, with "VERIFIED" and "PRICE DROPPED" checkboxes).
      All other sections collapsed.
   d. Checkboxes: 16px square, 1px --ink border, 2px radius, black fill + white
      check when selected. No blue anywhere.
4. Listing grid right of sidebar: 4 columns desktop (grid takes remaining width),
   24px gutters, using the listing card from the design system unchanged. Show 12
   cards with varied placeholder data — invented brand names only (e.g., "MAISON
   ARCHIVE", "ATELIER 9", "FORM STUDIO"), prices $85–$2,400, sizes like "M / 48",
   condition scores like "9/10", relative timestamps in Space Mono 11px --ink-soft
   above the title ("1D AGO"). Two cards carry the green VERIFIED tag; one card
   shows strikethrough old price + new price (price drop).
5. Pagination: text-only "LOAD MORE" secondary button, centered under grid.

MOBILE (375px): sidebar collapses to a sticky "FILTERS (6)" secondary button next to
the sort dropdown; tapping opens a full-screen filter drawer — show this drawer as
its own frame: same sections, MY SIZES on top, "SHOW 79 LISTINGS" primary button
pinned at bottom. Grid becomes 2 columns. Active-filter chips scroll horizontally
in one row under the header.

EMPTY STATE (final frame): zero results — EB Garamond italic line "Nothing in the
archive matches." + text link "follow this search and we'll notify you".

DO NOT: add a horizontal filter bar above the grid (chips + sort only live there);
add banners, hero images, or promo tiles; show seller avatars on cards; add heart
icons on card images (saving happens on the listing page); use blue or any color
outside the token set for chips, checkboxes, or toggles; invent filter sections or
categories beyond those listed; add a department mega-menu nav row under the header.
```

## PROMPT 3 — Listing detail page (FEATURE_SET §1/§3/§5, milestones M2 + M7)
*Revised: mobile-first spec + differentiators surfaced above the fold. This screen is where we are NOT a Grailed clone — the community trust layer must be visible without scrolling to a buried tab.*

```
Using the design system already established in this project, design the listing
detail page. Produce BOTH a desktop frame (1440px) and a mobile frame (375px) —
treat mobile as equally important, not an afterthought.

=== GLOBAL MOBILE SHELL (define here, reuse on all future mobile frames) ===
Bottom tab bar, 56px, white, 1px --line top border, five items in Inter 10px caps
with simple 20px line icons: FEED / DISCOVER / SELL / MESSAGES / PROFILE. Active
tab = solid black icon + label; inactive = --ink-soft. SELL is visually identical
to the others — no big center button, no accent color.

=== DESKTOP LAYOUT: two columns — left 60% images, right 40% panel ===

LEFT — image area: main 3:4 image with 6 thumbnails below in fixed labeled slots,
11px caps: FRONT / BACK / TAG / DETAIL / FLAW / POSSESSION. The POSSESSION thumb
carries a small green corner tick and tooltip: "handwritten-tag photo — proof the
item is in hand. required on every listing here."

RIGHT — panel, top to bottom:
1. Space Mono 700 20px title: "2004 DISTRESSED BONDAGE BOMBER"
2. Space Mono 400 16px: "MAISON ARCHIVE · M / 48"
3. Condition row: Space Mono "CONDITION 8/10" + text link "what 8 means" —
   tapping shows a small popover with the rubric line: "light wear, no flaws
   visible at arm's length." (show popover open in a detail frame)
4. Price block: Space Mono 700 28px "$1,250", beneath it 12px --ink-soft:
   "buyer fee 2% · $25 — total $1,275 · that's it."
5. TRUST STRIP (the differentiator block — must sit ABOVE the buy button, 1px
   bordered container, three stacked rows with green ticks):
   ✓ VERIFIED · AI + human reviewed
   ✓ COMMUNITY CHECKED · 4 legit checks, 1 from a VERIFIED CHECKER — text link "read"
   ✓ ESCROW · your money is held until you confirm delivery
6. Buttons stacked full width: primary "BUY NOW", secondary "MAKE OFFER",
   text button "MESSAGE SELLER".
7. Seller block (1px top border): username Space Mono + tier badge GOLD + "VERIFIED
   ID" microtag, rating "4.9 · 212 SALES", ships-from line "SHIPS FROM · US",
   FOLLOW text link.
8. Meta line: Space Mono 12px --ink-soft "LISTED 3D AGO · 41 SAVES"

BELOW BOTH COLUMNS — THE COMMUNITY SECTION (our signature, give it real presence):
EB Garamond italic 24px header: "The community weighs in." Two tabs, Inter 12px caps:
Tab 1 "LEGIT CHECK (4)" — default open: threaded comments, each row: username in
   Space Mono + tier badge + green "VERIFIED CHECKER" microtag where applicable,
   14px Inter comment text, Space Mono 12px timestamp, small "AGREE (3)" text
   action. Pinned verdict card at top from the verified checker: 1px --accent
   border, "CHECKED — hardware, stitching, and tag are consistent with authentic.
   — @formcheck, VERIFIED CHECKER · OUTERWEAR". Input at bottom, helper text
   "ID-verified members only · new accounts limited to 2 comments/day".
Tab 2 "COMMENTS (2)": same anatomy + right-aligned "seller has comments ON" note.
   Include one comment showing a struck-through URL with system line: "link
   removed — off-platform payment offers violate policy."

=== MOBILE LAYOUT (375px), top to bottom ===
1. Compact header: back chevron, centered truncated title in Space Mono 14px,
   save (SAVED text toggle) right.
2. Full-width swipeable 3:4 gallery, dot indicators, current slot label bottom-left
   in an 11px caps chip ("TAG"), "6 PHOTOS" counter bottom-right.
3. Title / brand+size / condition row / price block — same content as desktop,
   stacked, 16px side padding.
4. TRUST STRIP — identical three-row block, full width. Never collapse or hide it.
5. Seller block as one tappable row: username + GOLD badge + "4.9 · 212 SALES" +
   chevron.
6. COMMUNITY SECTION inline (not behind a tab bar swipe): LEGIT CHECK / COMMENTS
   as segmented control, pinned checker verdict card first, then 2 comments.
7. STICKY BOTTOM ACTION BAR (above the global tab bar): left half secondary
   "OFFER", right half primary "BUY $1,275". One 10px caps line above the bar,
   centered, --ink-soft: "ESCROW PROTECTED · 2% FEE INCLUDED".
Show the global mobile tab bar beneath (DISCOVER active).

DO NOT: add related-items carousel, "more from this seller", share buttons,
AR/try-on, shipping calculator, countdown timers, or view counters; no payment
logos; no bid/auction UI — fixed price + offers only; do not demote the trust
strip or community section below any parity element; do not use accent green
anywhere except the trust strip ticks, checker elements, and verified tags.
```

## PROMPT 4 — Sell flow / listing creation (FEATURE_SET §4, milestone M2)

```
Using the design system from this project, design the "create listing" flow as a
single-page form with a 4-step progress indicator (desktop + mobile). Steps in Inter
12px caps: PHOTOS → DETAILS → CONDITION → PRICE.

STEP 1 PHOTOS: six upload slots in a row (2×3 grid mobile), each a 3:4 dashed
1px --line rectangle with its label inside: FRONT, BACK, TAG, DETAIL, FLAW,
POSSESSION. The POSSESSION slot has helper text: "handwritten tag with your username
+ today's date, in frame with the item." Show slot states: empty, uploaded (thumbnail
with ✕), error ("photo appears to be a stock image — upload your own photo",
in --alert).

STEP 2 DETAILS: brand (autocomplete input showing 3 invented suggestions as the user
types "MAI…"), category dropdown, size dropdown, title input with Space Mono live
preview beneath ("this is how buyers see it"), description textarea with counter.

STEP 3 CONDITION: the 1–10 rubric as a horizontal selector of 10 numbered squares;
selecting one reveals its definition line, e.g. 8 = "light wear, no flaws visible at
arm's length." Damage checklist beneath: stains / repairs / fading / odor, each a
checkbox that requires a note + photo reference if checked.

STEP 4 PRICE: price input (Space Mono 28px), beneath it a live fee line: "you receive
$1,225 — seller fee 2% ($25)". Toggle: "SMART PRICING — drop 10% weekly to floor"
with floor-price input revealed when on. Primary button "SUBMIT FOR REVIEW" with
helper text: "every listing is reviewed before going live — usually under 24h."

SELLER PROTECTION NOTE inside Step 1: under the TAG and DETAIL slots, one 12px
--ink-soft line: "your tag, serial, and flaw photos are archived as evidence —
if a buyer ever disputes with a swapped item, these protect you."

FINAL FRAME: submitted state — EB Garamond italic "In the queue." + Space Mono
status row "REVIEW: PENDING · position 4" + text link "list another". Beneath it
a 1px bordered SELLER PROTECTION summary card, three ticked rows in 12px:
✓ EVIDENCE ARCHIVED — your photos are timestamped and stored
✓ AUTO-RELEASE — you're paid 3 days after delivery unless a dispute is opened
✓ VERIFIED BUYERS ONLY — every buyer is ID-checked, you see their record

DO NOT: add draft autosave UI, bulk upload, video upload, background-removal or AI
photo enhancement, category trees deeper than one level, or shipping options
(shipping is set in a later flow, not here).
```

## PROMPT 5 — Checkout & order status (FEATURE_SET §2, milestone M5)

```
Using the design system from this project, design two frames (desktop + mobile).

FRAME A — CHECKOUT (single page, no steps): left column — order summary card:
listing thumbnail, Space Mono title + size, price $1,250, fee line "buyer fee 2% ·
$25", shipping "$12", Space Mono 700 total "$1,287". Right column — shipping address
form (5 fields), payment section as a bordered container labeled "CARD" (generic
inputs: number, expiry, CVC — no brand logos), then full-width primary button
"PAY $1,287 — HELD IN ESCROW" with one line beneath in 12px --ink-soft:
"your payment is held until you confirm delivery. seller is paid after."

FRAME B — ORDER STATUS, BUYER VIEW: vertical timeline with five nodes, each Space
Mono 12px caps label + timestamp: PAID & HELD (done, green) → SELLER CONFIRMED
(done, green) → SHIPPED · TRACKING 9400 1108 (done, carrier text link) → DELIVERED
(current, pulsing dot; sourced from carrier scan) → FUNDS RELEASED (pending, grey).
Below the timeline: primary button "CONFIRM RECEIPT — RELEASE FUNDS", then a Space
Mono 12px countdown line: "or funds release automatically in 2D 14H" — the buyer
confirming early is courtesy, not leverage. Text button "REPORT AN ISSUE" with
helper "requires photos within 72h of delivery · pauses the auto-release".
Right rail: order summary card (reuse Frame A card) + seller block with MESSAGE
SELLER text button.

FRAME C — ORDER STATUS, SELLER VIEW (same order, seller's side): identical timeline,
plus at top a BUYER RECORD row: buyer username + tier badge + Space Mono 12px
"37 PURCHASES · 0 DISPUTES · MEMBER 8MO". Below timeline: Space Mono line
"PAYOUT $1,225 — AUTO-RELEASES IN 2D 14H" and a 1px bordered PROTECTED card,
12px, three ticked rows: ✓ carrier scan confirms delivery ✓ your listing photos
are archived as evidence ✓ disputes require buyer photos within 72h.

DO NOT: add multi-item cart UI, promo-code field, BNPL/financing options, PayPal or
any wallet buttons, insurance upsells, tipping, or currency selection. Card payment
only, single item.
```

## PROMPT 6 — Profile & reputation (FEATURE_SET §3/§4, milestones M2 + PA)

```
Using the design system from this project, design the public seller profile page
(desktop + mobile).

HEADER SECTION: avatar 64px circle, username Space Mono 700 20px, tier badge GOLD,
microtags row: "VERIFIED ID" (green) · "VERIFIED CHECKER — OUTERWEAR" (green) ·
"MEMBER SINCE 2026". TWO stats rows in Space Mono 14px — reputation is two-sided
on this platform:
  "AS SELLER · 212 SALES · 4.9 · <1% DISPUTES · REPLIES ~2H"
  "AS BUYER · 37 PURCHASES · 4.9 · 0 DISPUTES · PAYS FAST"
FOLLOW primary button + MESSAGE secondary, right-aligned.

TIER PROGRESS MODULE (collapsible): horizontal track Bronze → Silver → Gold →
Platinum with the user's position marked; under it three requirement lines in
Space Mono 12px: "150+ SALES ✓ · <5% DISPUTES ✓ · 6MO STANDING — 2MO TO GO".
One EB Garamond italic line beneath: "Platinum unlocks early drops and a heavier
voice in legit checks."

TABS: LISTINGS (default — reuse the browse grid card style, 8 cards, but NO filter
sidebar here; just a compact sort dropdown right-aligned above the grid) · REVIEWS
(segmented control inside the tab: "AS SELLER (212)" / "AS BUYER (37)" — list rows:
reviewer username + tier, stars as plain text "★ 5", date in Space Mono, 2-line
comment; show the AS BUYER segment selected in one frame, with reviews written by
sellers like "smooth buyer, paid instantly, no games") · LEGIT CHECKS (their LC
comments with links back to listings — visible only because this user is a
verified checker).

DO NOT: add follower/following counts, social links, bio longer than one line,
badges other than those specified, activity graphs, or a storefront banner image.
```

## PROMPT 7 — Offers & messages (FEATURE_SET §2/§5, milestone M6)

```
Using the design system from this project, design the messages screen with an offer
negotiation in progress (desktop: two-pane, mobile: single thread view).

LEFT PANE: conversation list — each row: username + tier badge, one-line preview,
Space Mono 12px timestamp, unread dot in --accent. 6 rows, one active.

RIGHT PANE: active thread. Pinned listing context bar at top: thumbnail, Space Mono
title, price $1,250, status chip "AVAILABLE". Directly under it a COUNTERPARTY
RECORD line the seller always sees, Space Mono 11px --ink-soft: "BUYER · SILVER ·
37 PURCHASES · 0 DISPUTES · PAYS FAST" (on the buyer's side it shows the seller's
record instead). Message bubbles: buyer left, seller right — white bg, 1px --line
border, 2px radius (no colored bubbles). Interleaved OFFER EVENT cards, full-width,
bordered: "OFFER — $1,050" in Space Mono 700 with two buttons ACCEPT (primary) /
DECLINE (secondary) and countdown line "expires in 21h" (Space Mono 12px). Show a
sequence: offer $1,000 declined (collapsed, struck) → counter $1,100 pending —
pending card carries helper text "if accepted, buyer must pay within 24h or the
offer voids and it counts as a strike." Add one ACCEPTED offer state card (separate
detail frame): "OFFER ACCEPTED — $1,100" with primary button "PAY $1,122 NOW" and
a payment-method line under it in Space Mono 11px: "VISA ·· 4242 (DEFAULT) ·
change / use PayPal" — payment uses saved methods, no re-entry. System line
centered in 12px --ink-soft: "off-platform payment links are blocked automatically."

INPUT ROW: text input + "MAKE OFFER" text button left of SEND primary button.
Consent banner (dismissible, 1px border): "chat transcripts can be referenced in
disputes only if both parties consent — manage in settings."

DO NOT: add voice notes, image sending, read receipts, typing indicators, emoji
picker, or group chats. No green/blue message bubbles — monochrome only.
```

## PROMPT 8 — Invite gate & onboarding (FEATURE_SET §6, milestone M1)

```
Using the design system from this project, design four small frames (mobile-first,
desktop variant).

FRAME A — LANDING/GATE: near-empty white page. Centered: wordmark placeholder,
EB Garamond italic 28px line: "A quieter market for the things worth keeping."
Single input: "INVITE CODE" (Space Mono, caps) + primary button "ENTER". Text link
beneath: "no code? join the waitlist". Footer: three 11px caps text links.
Error state: code field with --alert border + "code already used".

FRAME B — POST-CODE SIGNUP: email + username + password fields, then an ID
verification step card: "VERIFY ONCE, SELL FOREVER" — 1px bordered container with
two rows: "1 · PHOTO ID" and "2 · SELFIE MATCH", each with a STATUS chip (pending/
done), helper text "one-time check. no biometric storage. required to buy, sell,
or comment — browsing works without it. it protects sellers as much as buyers:
everyone you transact with is a real, accountable person." Buttons: primary
"VERIFY NOW", text "skip for now — browse only".

FRAME C — QUICK SETUP (after verification, before codes): "SET UP ONCE, CHECKOUT
IN SECONDS" — three optional stacked cards, each with a STATUS chip (skip/done):
1 · MY SIZES (chips selector: tops S–XL, bottoms 28–36, shoes 7–13)
2 · SHIPPING ADDRESS (one-line summary once added)
3 · PAYMENT METHOD — two buttons side by side: "ADD CARD" (opens generic card
   fields) and "LINK PAYPAL" (bordered button, text only — no PayPal logo).
   Helper 12px --ink-soft: "stored securely with our payment providers — we
   never see your card number. you can always use a different card at checkout."
Text link "skip all — do this later". Primary button "CONTINUE".

FRAME D — YOUR CODES: post-setup screen showing the member's 3 invite codes as
Space Mono 700 bordered tokens (e.g. "FORM-7Q2K") each with COPY text button and
status line "unused / claimed by @username". EB Garamond italic header: "Three keys.
Choose carefully." Footer note: "invites earn tier credit when your invitee
completes a first sale."

DO NOT: add social login buttons, phone-number auth, referral leaderboards,
confetti or celebration graphics, progress gamification bars, or marketing
screenshots of the product.
```

## PROMPT 9 — Account settings (sizes, addresses, payments) (FEATURE_SET §4/§6)

```
Using the design system already established in this project, design the account
settings area (desktop 1440px + mobile 375px). Layout: left settings nav rail
(200px) + content pane. Nav rail: Inter 11px caps text links grouped with 24px
gaps and grey --ink-soft for inactive: ACCOUNT group (PROFILE, MY SIZES, ADDRESSES,
PAYMENTS), SELLING group (LISTINGS, OFFERS, VACATION MODE), TRUST group
(VERIFICATION, PRIVACY, NOTIFICATIONS). Active item: black text + 2px black left
rule. On mobile the rail becomes a settings index screen; each item pushes a
detail screen (show the index + one detail).

Design THREE content panes as separate frames:

FRAME A — MY SIZES: intro line 12px --ink-soft "used by the MY SIZES filter and
size alerts — never shown publicly." Three groups with chip selectors (multi-
select, black fill when active): TOPS (XS–XXL), BOTTOMS (26–40), FOOTWEAR
(6–14 incl. halves). Save primary button, disabled until changed.

FRAME B — ADDRESSES: list of address cards (1px border): name, two address lines,
Space Mono 11px "DEFAULT" chip on one card, EDIT / REMOVE text links. "ADD
ADDRESS" secondary button. One card in edit mode: 5 input fields + "SET AS
DEFAULT" checkbox + SAVE primary.

FRAME C — PAYMENTS: section 1 "PAYMENT METHODS": two method cards —
  card 1: "VISA ·· 4242 · EXPIRES 08/28" + Space Mono 11px "DEFAULT" chip +
  REMOVE text link; card 2: "PAYPAL · aetius@···.com" + "MAKE DEFAULT" text link.
  Buttons row: "ADD CARD" secondary, "LINK PAYPAL" secondary (text only, no logo).
  Trust line 12px --ink-soft with a small lock glyph: "stored with our payment
  providers (Stripe / PayPal) — card numbers never touch our servers. saved
  methods pre-fill checkout; you can still use a different card on any purchase."
  Section 2 "PAYOUTS" (sellers): status card "PAYOUT ACCOUNT · CONNECTED" with
  green tick, bank line "BANK ·· 6789", text link "manage in Stripe". If not
  connected: primary button "SET UP PAYOUTS" + line "required before your first
  listing goes live."

DO NOT: add dark-mode toggle, language selector, 2FA/security screens, data-export,
notification matrix tables (a simple grouped toggle list is fine if shown), any
PayPal or card-network logos (text labels only), account deletion flow, or
subscription/membership management (not in this prompt's scope).
```

---

## ITERATION ASKS — for screens already generated (paste as-is into the existing frame's thread; never re-run the prompt)

- **A1 · Listing page (P3):** "In the offer/message area, add a buyer-record line the seller sees: 'BUYER · SILVER · 37 PURCHASES · 0 DISPUTES · PAYS FAST' in Space Mono 11px --ink-soft. Change nothing else."
- **A2 · Checkout (P5):** "In the payment section, add a saved-payment-method selector: 'VISA ·· 4242 (DEFAULT)' row, 'use a different card' text link that reveals the card fields, and a 'PAYPAL' bordered text-only button (no logo). Change nothing else."
- **A3 · Sell flow (P4), if missing:** "Under the TAG and DETAIL photo slots add the line: 'your tag, serial, and flaw photos are archived as evidence — if a buyer ever disputes with a swapped item, these protect you.' Change nothing else."
- **A4 · Sell flow submitted state (P4), if missing:** "On the submitted screen add a 1px bordered SELLER PROTECTION card with three ticked rows: EVIDENCE ARCHIVED / AUTO-RELEASE — paid 3 days after delivery unless a dispute opens / VERIFIED BUYERS ONLY. Change nothing else."
- **A5 · Order status (P5), if missing:** "On the buyer order view add under CONFIRM RECEIPT: 'or funds release automatically in 2D 14H'. Add a seller variant of this page: same timeline plus buyer-record row at top and payout line 'PAYOUT $1,225 — AUTO-RELEASES IN 2D 14H'. Change nothing else."

When an ask is applied, check it off here. If a generated frame already contains the element, skip the ask.

## Usage notes
- Run 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9. If a later screen drifts from the tokens, say: "re-apply the design system from Prompt 1, changing nothing else."
- **Payments decision (July 2026, revised after rails research):** alpha ships Stripe-only (Connect: cards, escrow, payouts). PayPal arrives at beta via PayPal Commerce Platform multiparty (auto fee-split + delayed disbursement = fee capture and escrow preserved) — never consumer G&S between users, which bypasses both and is the model old Grailed used and abandoned. Stripe doesn't process PayPal in the US, so PayPal = a second full integration; deferred deliberately. UI is future-proofed now: saved methods pre-fill checkout, "use a different card" always available, PayPal shown as saved-method option (text-only, no logo). Prompt 5 already ran card-only — covered by iteration ask A2.
- **Filter architecture decision (July 2026):** browse uses a Grailed-style left sidebar rail (MY SIZES module, collapsible sections with counts, monochrome chips) — decided after team review of Grailed screenshots. The sidebar exists ONLY on browse/search (Prompt 2); profile grids and any other listing grids get a sort dropdown, never the rail.
- **Mobile shell decision (July 2026):** global bottom tab bar (FEED / DISCOVER / SELL / MESSAGES / PROFILE) is defined in Prompt 3 and reused on every mobile frame after it. If a mobile frame renders without it, say: "add the global mobile tab bar defined on the listing page."
- **Differentiator checklist — this is not a Grailed clone.** When reviewing any generated screen, verify its unique elements survived; if Claude Design drops one, re-ask for it by name:
  - Prompt 2: MY SIZES module · condition 1–10 filter with "7+ only" · VERIFIED-only filter
  - Prompt 3: TRUST STRIP above buy button · POSSESSION photo slot · pinned VERIFIED CHECKER verdict · LC/comments split with seller toggle · "2% — that's it" fee line
  - Prompt 4: POSSESSION upload slot with stock-photo error state · 1–10 rubric selector · live 2% fee math · SELLER PROTECTION card (evidence archive / auto-release / verified buyers)
  - Prompt 5: "HELD IN ESCROW" pay button · buyer timeline with auto-release countdown · SELLER VIEW frame with buyer record + PROTECTED card
  - Prompt 6: tier progress track with requirements · VERIFIED CHECKER tag + LEGIT CHECKS tab · two-sided reputation (AS SELLER / AS BUYER rows + review segments)
  - Prompt 7: offer cards with expiry · counterparty record line · 24h-pay-or-strike helper · off-platform link-block system line · consent banner
  - Prompt 8: invite-code gate · quick-setup frame (sizes/address/payment saved once) · three-codes screen · "verify once, sell forever" ID card (now covers buying too)
  - Prompt 9: MY SIZES chips feeding the browse filter · saved payment methods with default + "different card at checkout" line · seller payout status card
- **Seller-protection policy (July 2026, reflected in Prompts 4–8):** carrier scan = delivery truth; funds auto-release 3 days after delivery unless a dispute with photos is opened within 72h; seller listing photos are archived as swap-scam counter-evidence; ID verification required to buy, sell, or comment; buyer reputation is first-class (purchase count, dispute rate, pay speed) and visible to sellers pre-acceptance; unpaid accepted offers void in 24h and strike the buyer. Prompt 3 already ran without the buyer-record element — covered by iteration ask A1.
- Iterate inside a prompt's thread ("make the purchase panel 20% narrower") rather than re-running the whole prompt — Claude Design keeps project context.
- Admin curation queue (M2) is deliberately excluded — internal tooling doesn't need designed UI at alpha; build it functional-ugly.
- When the name is chosen (D4), replace wordmark placeholders and re-export; nothing else should change.

## Sources
[Claude Design — Complete 2026 Guide](https://agence-scroll.com/en/blog/claude-design-anthropic-2026-guide) · [Claude Design for Non-Designers](https://www.buildfastwithai.com/blogs/claude-design-anthropic-guide-2026) · [10 Advanced Claude Design Prompts — Senior UX Workflow](https://pasqualepillitteri.it/en/news/1486/claude-design-prompts-senior-ux-designer-guide) · [Anthropic — Prompting Best Practices](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-prompting-best-practices) · [Font Trends 2026 — Mono movement](https://madegooddesigns.com/font-trends-2026/) · [Font Pairing Guide 2026](https://madegooddesigns.com/font-pairing/) · [Grailed redesign case study — J. Choi](https://www.jameschoi.design/grailed-redesign)
