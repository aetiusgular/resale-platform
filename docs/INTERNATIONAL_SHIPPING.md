# International shipping + sell page redesign A

Branch `feat/intl-shipping-sell-redesign`.

## What ships

- **Sell page (redesign A).** One scroll, no step rail: photos, title, brand, category typeahead, size / color, description, measurements with a TOPS / BOTTOMS toggle, then PRICE + SHIPPING on the left with the take-home breakdown beside them, and a sticky YOU RECEIVE bar. Mobile stacks it all. `app/sell/sell-form.tsx`, `sell-photos.tsx`, `sell-category.tsx`, `sell-shipping.tsx`, `.sellx-*` in `app/globals.css`.
  - **Photos:** up to 15 in the seller's order (drag to reorder; the first is the cover), at least 3 to publish (`MAX_PHOTOS` / `MIN_PHOTOS` in `lib/listings/images.ts`; `POST /api/listings` answers `400 too_few_photos` below the minimum). No fixed FRONT / BACK / TAG slots. `listings.images` is now only the public photos, in order; the possession proof lives only in `possession_photo_url`. Migration 000052 rewrites the old six-slot rows (blank slots dropped, the proof removed from the list). `image_hashes.slot` is `PHOTO_1` … `PHOTO_15` (+ `POSSESSION`); rows written by the old form keep their `FRONT` … `FLAW` names, and the near-duplicate scan is slot-agnostic, so both compare. Duplicate flags record `new_slot` next to `slot`, which the admin queue uses to mark the matching photo on each side.
  - **Listing page gallery:** one slot per photo (the strip scrolls past ~8); alt text says cover / photo N / possession.
  - **Dropped:** the condition grade (1–10) and the possession proof photo. Both are optional in `POST /api/listings` and in the DB (`listings_published_complete_ck` in migration 000050); existing listings keep their values. The proof-photo dedup across sellers still runs when a possession photo is present, which the form never sends now. The near-duplicate scan compares every stored photo hash against every new one, since photos are no longer positional.
  - **Measurements:** garments are TOPS or BOTTOMS at the seller's choice (`lib/taxonomy` measurement kinds); footwear and accessories keep their own sets. An IN / CM toggle (the listing page's `.unit-toggle`) sets the unit the seller types in; values are kept and sent as inches, and switching rewrites the boxes without drifting the numbers. Storage keys are unchanged (`PIT TO PIT`, `SHOULDER`); the UI prints CHEST and SHOULDERS.
- **Fees** (`lib/fees.ts`):
  - First 10 sales: 2.9% + 30¢ on the item only.
  - After that: tier % + 30¢ (8% + 30¢ at the base tier).
  - Sellers never pay shipping.
  - The take-home box uses `sellerFeeBreakdown()`, the same helpers checkout charges with.
- **Shipping lanes** (`lib/shipping-regions.ts`):
  - **US → US:** unchanged. The price is system-derived (`lib/shipping`) and the platform buys the prepaid EasyPost label (`label_mode = 'platform'`).
  - **Every other lane:** the seller sets a flat rate per region and buys the label (`label_mode = 'seller'`). The shipping the buyer paid is added to the seller's transfer (`transferCentsFor`).
  - **Regions:** US sellers price Canada, UK, Europe, Asia, Australia / NZ and Other. Sellers anywhere else price North America (US, Canada, Mexico) instead of Canada, and must switch on at least one region.
- **Origin.** A listing's `ships_from` comes from the seller's default address. At checkout, a non-US origin must match the country of the seller's Stripe payout account.
- **Checkout:**
  - Shipping is priced for the destination country.
  - `PATCH /api/checkout` re-prices and re-snapshots the address whenever the buyer changes it. Stripe is updated first, then the session, guarded on the priced row.
  - The session's `ship_to_address` is what the order ships to.
  - Restricted countries are refused: CU, IR, KP, SY, RU, BY.
- **EasyPost:**
  - Prepaid labels stay US → US only. `buyLabelForOrder` skips seller-label and non-US orders.
  - The listing-time rater now quotes from the seller's ship-from ZIP.
  - Tracking numbers that sellers type in get an EasyPost tracker (`createTracker`), so delivery scans hit `/api/webhooks/easypost`. A scan dated before the order was marked shipped is ignored.
- **Addresses:**
  - Any supported country (`lib/countries.ts`), with per-country validation in `lib/addresses.ts`. Checkout and Settings → Address have a country picker.
  - The Stripe Connect account is created in the seller's country, using the `recipient` agreement outside the US.

## Deploy order

1. Apply `20240101000050_international_shipping.sql`, then `20240101000051_international_shipping_validate.sql`, then `20240101000052_images_without_possession.sql` (data fix: old six-slot photo rows become the plain photo list; the app's readers still tolerate the old shape until it runs). The app reads the new columns, so the migrations go first.
2. Deploy the app.
3. In the Stripe dashboard, enable cross-border payouts before non-US sellers onboard. Until then, Connect onboarding returns `country_unsupported` and Settings → Payouts explains why.

## Open decisions (owner)

- **Processing on international shipping.** Seller-label shipping passes through with no fee, so the platform pays about 2.9% processing on it. In welcome mode, the seller's fee covers processing on the item only. Options: charge processing on the pass-through, or leave it as is.
- **Shipping inflation.** A genuine non-US seller could move value from the item price into their region rates, which are capped at $500 per region. Options: a relative cap, or a fee on pass-through shipping.
