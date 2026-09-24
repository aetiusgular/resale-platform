# QA seed — the showcase world around `e2e-buyer@test.local`

`scripts/seed-qa-showcase.mjs` fills the hosted Supabase project (the same DB production
serves) with a complete set of interaction states around the tester account, so QA testers
can open the app and find every screen already populated. Photos are AGMNT Store product
shots (`scripts/seed-qa-photos.json`), re-uploaded to the `product-images` bucket.

```bash
node scripts/seed-qa-showcase.mjs                # wipe previous seed rows, then seed (photos re-uploaded, ~25 min)
node scripts/seed-qa-showcase.mjs --skip-images  # same, reusing photos already in the bucket (~1 min)
node scripts/seed-qa-showcase.mjs --wipe         # remove everything the seed created
node scripts/seed-qa-showcase.mjs --wipe --wipe-users   # …and delete the qa-* accounts
node scripts/seed-qa-showcase.mjs --dry          # fixture summary + fee math, no network
```

Every seeded row has a deterministic id (hash of a fixture key), so re-running is safe: the
wipe step removes exactly what a previous run created, then inserts fresh. It never touches
`tabiwalker`'s `[SEED]` browse fixtures, real sign-ups, or the tester's password.

## Accounts

| Account | Handle | Role in the story |
| --- | --- | --- |
| `e2e-buyer@test.local` | `@e2e_buyer` (display "Tester") | The tester. Password = `TEST_BUYER_PASSWORD` in `.env.local`. Verified, Tier 2 seller, 14 lifetime sales. |
| `qa-mara@test.local` | `@mara_lindqvist` | LA seller the tester buys from (puffer, bomber, boots, tees). |
| `qa-theo@test.local` | `@theo_nakamura` | Brooklyn buyer/seller. Open offer on the tester's PAF jacket; accepted the tester's offer on an XLIM jacket. |
| `qa-ines@test.local` | `@ines_roca` | Toronto buyer. International lanes: paid for the Evangelion crewneck (Canada, seller label), accepted offer on the Helmut Lang bomber. |
| `qa-kenji@test.local` | `@kenji_ito` | Tokyo seller (`ships_from` JP, North America / Asia region rates). Refunded + cancelled orders with the tester. |
| `qa-priya@test.local` | `@priya_venkat` | Moderator: signed the Legit Check verdict; unread chat with the tester. |
| `qa-lowell@test.local` | `@lowell_grant` | Austin buyer with a strike (accepted an offer, never paid). Countered offer + open dispute with the tester. |

All `qa-*` personas share one password, generated on first run and stored in `.env.qa.local`
(gitignored) — also printed at the end of every run. US personas carry the test Stripe
Connect account of `TEST_SELLER_EMAIL`, so checkout against their listings reaches Stripe
(test mode). `@e2e_buyer` has no Connect account: buying FROM the tester 422s at checkout
until someone completes `/settings/payouts` for that account. Kenji's listings 422 with
`origin_mismatch` (JP origin vs a US Connect account) — expected.

## What to look at, logged in as `@e2e_buyer`

**Browse / listing pages** — 25 new real-photo listings on `/browse` next to the 29 `[SEED]`
fixtures (Ann Demeulemeester is boosted and pinned first; the tester's own items carry YOURS).

**Long copy** — five listings carry long descriptions on purpose, to test the PDP clamp
(8 lines desktop / 6 mobile) and the READ FULL DESCRIPTION → reading pane: the PAF
Reversible Curved Jacket is a 549-word, 2,900-character seller wall in six paragraphs (far
past the sell form's 1,000-character cap, which the DB does not enforce); the Rick Owens
puffer is one unbroken 996-character paragraph, right at the cap; the Kozaburo trucker is
the ~140-word "medium" case with two line breaks; the Helmut Lang bomber is list-style copy
with 21 line breaks and an unbroken 70-character style code (wrap/overflow check); the sold
TheSoloist bomber has 165 words on a SOLD page. The Ann Demeulemeester listing has a
109-character title (form cap 120) for card, inbox-row and order-row truncation. Editing the
PAF jacket through the sell form will truncate its description to 1,000 characters on save;
that is the form's limit, not a bug in the seed. Hero gallery: the PAF
Reversible Curved Jacket (7 photos, $420 → $380 → $340 price history, 4 saves, 212 views).
`/listings/<id>` for the white Undercover PIL shirt shows an authenticated Legit Check
thread (pinned moderator verdict, auto-auth pass, 4 legit votes); the Rick Owens Geth
sweater has a pending thread with a flag and a reply.

**Messages** — 15 threads (`/messages`), 3 unread on first load. Offer cards in every state:
open offer to respond to (Theo → PAF jacket), the tester's own counter awaiting Lowell
(Kapital trucker), accepted offer with PROCEED TO CHECKOUT (XLIM brown jacket, 18h left),
accepted awaiting the buyer's payment (Helmut Lang → Inés), declined (Dries bomber),
expired (Veerkracht biker jacket), voided + strike (AVAVAV cap), plus plain chats and
order-timeline lines inside threads (dispute, refund).

**Orders** — `/settings/orders`: 19 orders, 5 buying / 14 selling, 7 active. Seller side:
paid_held (CONFIRM & SHIP, Canada seller-label lane), seller_confirmed (ADD TRACKING),
shipped (IN TRANSIT), delivered, disputed (dispute open with photos), 9 released with fees
(welcome ramp on the first 10 sales, 7.0% + $0.30 after; sub-$100 5% cap on the Saint
Laurent tee). Buyer side: delivered (CONFIRM DELIVERY / REPORT AN ISSUE, auto-release
timer), seller_confirmed, released with reviews both directions, refunded after a dispute,
cancelled.

**Saved** — 9 items (one SOLD, one with a price drop 2 days ago), 3 saved searches with
alerts, 3 followed sellers; "since last visit" counts (visit stamped 7 days ago).

**Settings → Seller tier** — Tier 2 (7.0%), 8 / 10 qualifying sales, "2 MORE TO TIER 3".
Two counted sales fall out of the 365-day window within 14 days (→ 8.0% without new sales),
which is what the tier-expiry notification and the expiring-volume warning key off.

**Sell** — `/sell`: 10 active (one IN REVIEW, one boosted with 5 days left, one price-dropped),
2 drafts (one needs 1 more photo, one title-only), 14 sold with payouts, 1 removed with a
rejection reason. Open offers show on the catalog cards.

**Seller profile** — `/sellers/e2e_buyer`: 8 buyer reviews (avg 4.75) when `REVIEWS_ENABLED`
(11 reviews exist in total, both directions), followers when `FOLLOWS_ENABLED`.

## Feature flags that decide what testers can see (Vercel env)

| Flag | Seeded data it unlocks |
| --- | --- |
| `NOTIFICATIONS_ENABLED=true` | 13 notifications for the tester, 7 unread (offer, sale, delivered, dispute, price drop, measurement request, tier expiry…). Page shows "You're all caught up" while off. |
| `FOLLOWS_ENABLED=true` | Follow buttons, follower counts, the "sellers you follow" section on `/saved`. |
| `REVIEWS_ENABLED=true` | Star ratings on seller profiles + the review form on released orders. |
| `TIER_DASHBOARD_ENABLED=true` | The buyer-side tier pane and the 14-day expiring-volume warning under Settings → Buying & selling power. |
| `NEXT_PUBLIC_BOOSTED_POSTS_ENABLED` + `BOOSTED_POSTS_ENABLED` | BOOST entry points on the sell catalog (the seeded boost already renders as BOOSTED on browse). |
| `BUMP_ENABLED=true` | BUMP buttons; the seeded listings are bump-anchored at creation. |

Booleans are OFF by default in code; flip them in the Vercel project env and redeploy.

## App issues seen while verifying the seed (not seed bugs)

- Region rates never show on the web listing page: `app/listings/[id]/get-listing.ts` selects
  the row for the PDP without `ships_from` / `intl_shipping` (PR #5 added them to
  `LISTING_DETAIL_SELECT` in `lib/loaders/listing.ts`, which the API route uses, but not here),
  so `shippingLanes()` treats every listing as a US-only origin. The Kozaburo trucker shipping
  from Tokyo reads "+ $17 SHIPPING US" and the Helmut Lang bomber's five priced regions are
  hidden. Fix: add `ships_from, intl_shipping,` to that select.
- The CSP `connect-src` in `middleware.ts` allows `https://*.supabase.co` but not
  `wss://*.supabase.co`, so the browser blocks the Supabase realtime websocket on every page
  (console: "Connecting to 'wss://…/realtime/v1/websocket' violates…"). Live thread updates
  will not arrive until `wss://*.supabase.co` is added.
- React hydration error #418 (server/client text mismatch) fires in the console on order and
  listing pages; timestamps rendered in server time vs the viewer's timezone are the usual
  cause. Cosmetic in production, but it is in every tester's console.
- "YOUR LISTING · PENDING_REVIEW" prints the raw status on the seller's own in-review listing.

## Known gaps

- Checkout for the tester's own listings needs a Stripe Connect account on `@e2e_buyer`.
- Kenji (JP) listings can't be bought until cross-border payouts exist (`origin_mismatch`).
- `image_hashes` are not written for seeded photos, so the duplicate-photo detector does not
  know about them.
- The 7 blank untitled drafts the tester account had from sell-form testing were deleted on
  the first run (drafts with no title and no photos only).
