# G11 — Onboarding fee ramp + category shipping margin + identity locks

Phase spec. Branch **`feat/fee-tier-checkpoints`** (build on top of the shipped tier
change `4c87216`). **Money-path — `db-guard` + `code-reviewer` + native `pnpm verify`
required.** Author the deduction/pricing code only after the money forks in §3 are
confirmed. This spec **supersedes** the earlier `/tmp/G11_onboarding_fee_ramp.md`:
the flat **$2/month seller fee + `seller_monthly_fees` ledger is DELETED**. The Connect
per-active-seller cost is now recovered on **every** sale through a category-based
shipping margin, not a monthly charge. Do NOT reintroduce Persona or the monthly ledger.

## 1. What this is

A permanent, near-frictionless seller onboarding model plus the mechanism that pays for
platform + Connect costs without a visible platform fee:

- **Welcome phase — a seller's first 10 lifetime sales:** 0% platform commission. The
  seller absorbs only the actual Stripe processing cost. No monthly fee.
- **Graduated — sale 11+:** the existing Fee Model v3 seller tiers (8% -> 7% -> 5.5% ->
  3.5%, sub-$100 capped 5%, $3k/$10k/$25k + order-count gates, inclusive of processing).
- **Buyer pays NO platform item fee in either phase.**
- **Shipping is a fixed, system-set, category-derived price** (sellers cannot set it). Its
  built-in **+$2 margin on every order** is what funds the ~$2/active-seller/mo Connect
  cost and is real scaling margin — replacing the deleted monthly fee.

Identity is anchored to **phone + payment instrument** (Persona dropped at signup);
government-ID-grade verification via **Stripe** fires only at the INFORM-Act threshold.

## 2. Locked decisions

1. **No $2/month fee, no `seller_monthly_fees` ledger.** Deleted from the design. Connect
   cost is recovered through the shipping margin (§4) on every sale.
2. Welcome phase = first **10 lifetime non-cancelled sales** as seller -> 0% commission,
   seller covers Stripe processing only. Sale 11+ -> existing tier system.
3. First-10 (welcome) sales **count toward tier volume** — automatic; the tier resolver
   already counts all delivered/released orders regardless of how they were priced.
4. Fee mode is **snapshotted at checkout** onto the order and never recomputed.
5. **Sellers cannot set shipping.** The price is derived from the listing `category` at
   listing-create time, stored on the listing, and snapshotted onto the order at checkout.
6. Persona is **removed** as a signup/sell gate. Uniqueness anchors: **phone** (already
   DB-unique) + **payout bank fingerprint** (hard lock) + **card fingerprint** (soft flag).
   Email is 2FA/recovery only, never a uniqueness anchor.
7. INFORM-Act high-volume verification stays (legally required) but repoints Persona ->
   **Stripe Identity / Connect additional verification**; `verification-policy.ts` logic +
   $5k trailing-sales trigger unchanged.

## 3. Money forks to confirm before coding

**Fork A — welcome seller-fee basis (how "seller tanks the base Stripe fee" is computed).**
Recommendation: at checkout estimate Stripe's fee as **2.9% x (item + shipping) + $0.30**
and snapshot it as the welcome seller fee; `transfer = item - welcomeFee`. Platform keeps
the shipping line (funds the label + the $2 margin) and nets ~$0 on processing. -> **Use the
2.9%+$0.30 estimate at checkout** (note: real card mix varies a few cents).

**Fork B — what counts as one of the "10 sales."** Recommendation: the seller's count of
**prior non-cancelled orders at checkout time**; `< 10` -> welcome, `>= 10` -> tier.
Deterministic, snapshottable. -> **Use prior non-cancelled order count at checkout.**

**Fork C — shipping margin amount + rating cadence.** Recommendation: **+$2 (200 cents)**
on top of `max(EasyPost worst-realistic-zone quote, category floor)`, computed **at
listing-create** and stored on the listing (not re-quoted at checkout — avoids a slow/failed
live call on the buy hot path). Re-quote only if the seller edits category. -> **Confirm the
$2 margin and listing-time rating.**

## 4. Category shipping engine (the deleted-monthly-fee replacement)

- Sellers never see a shipping input. On listing create/edit, map `listings.category` ->
  a **worst-case parcel preset** (packed weight + box dims), rate it against EasyPost using
  the **cheaper of enabled carriers** at the **worst realistic destination zone**, take
  `max(quote, category floor)`, add **$2**, and store the result on the listing.
- The **real** label is bought at fulfillment for the actual buyer address; because the
  actual zone <= worst zone, the platform keeps the spread (>= the $2 floor essentially always).
- Carrier allowlist: comparable **ground** services only (USPS Ground Advantage default;
  UPS Ground if a UPS carrier account is attached in EasyPost). No expedited/air in the quote.
- Legally clean: a single disclosed up-front carriage price, no drip pricing, no post-checkout
  surprise (satisfies FTC junk-fee rule + CA SB 478).

### 4a. Parcel presets (worst-case, biased heavy; refine from real shipment data later)

Categories from `app/sell/sell-form.tsx` CATEGORIES. Presets = (packed lb, box L x W x H in):

| Category    | Weight | Box (in)   | Notes                                  |
|-------------|--------|------------|----------------------------------------|
| Tops        | 1 lb   | 12x9x3     | tee / shirt                            |
| Sportswear  | 3 lb   | 15x12x4    | jersey / hoodie                        |
| Bottoms     | 2 lb   | 14x11x3    | trousers / shorts                      |
| Denim       | 2 lb   | 14x11x3    | jeans                                  |
| Knitwear    | 3 lb   | 15x12x4    | sweater                                |
| Tailoring   | 5 lb   | 20x16x6    | suit/blazer; dim-weight ~12 lb         |
| Footwear    | 5 lb   | 15x11x7    | boxed shoes                            |
| Outerwear   | 6 lb   | 20x16x6    | coat/parka; dim-weight ~12 lb          |
| Accessories | 5 lb   | 16x12x8    | HUGE range belt<->bag — see open decision |
| Other       | 6 lb   | 18x14x8    | catch-all ceiling                      |

### 4b. Category floors (buyer-visible = max(quote, floor) + $2)

Floors set from user-confirmed minimums (Tops >= $7, Footwear >= $20, Outerwear >= $15
before the +$2). Displayed price = `max(EasyPost worst-zone quote, floor) + $2`:

| Category    | Floor | +$2 -> buyer sees |
|-------------|-------|-------------------|
| Tops        | $7    | $9                |
| Sportswear  | $8    | $10               |
| Bottoms     | $9    | $11               |
| Denim       | $10   | $12               |
| Knitwear    | $11   | $13               |
| Accessories | $12   | $14               |
| Tailoring   | $14   | $16               |
| Outerwear   | $15   | $17               |
| Footwear    | $20   | $22               |
| Other       | $20   | $22               |

Store floors + presets as data (a `SHIPPING_PRESETS` map in `lib/shipping.ts`), not magic
numbers scattered in code. EasyPost rating is free; only labels cost money.

## 5. Schema (migration `0038`)

- `profiles.lifetime_sales_count INT NOT NULL DEFAULT 0` — cached count of non-cancelled
  seller orders (source of welcome/tier gate; maintained on order create + reversal, or
  derived — decide in code review; cache is O(1) at checkout).
- `orders.fee_mode TEXT CHECK (fee_mode IN ('welcome','tier')) NOT NULL DEFAULT 'tier'` —
  snapshot of which model priced this order (audit + display). Existing bps snapshot columns
  stay; in welcome mode `seller_fee_bps` records the effective processing estimate.
- `listings.shipping_cents INT` — system-derived shipping price (nullable for legacy rows;
  backfill from category preset in the migration). NO seller-writable shipping column/grant.
- `listings.shipping_source TEXT CHECK (shipping_source IN ('preset','quote')) DEFAULT 'preset'`
  — provenance (did we hit the floor or a live EasyPost quote) for audit/telemetry.
- **Bank hard lock:** add a partial UNIQUE index on `payment_identities (kind, fingerprint)`
  **WHERE kind='bank'** to enforce one-bank-one-account at the DB. (Do NOT make card unique.)
- No Persona table changes; `VERIFICATION_ENABLED` stays but the provider adapter -> Stripe.
- **No `seller_monthly_fees` table** (explicitly not created; note in the migration why).

## 6. Fee + shipping resolver changes

- `lib/fees.ts`: new pure `welcomeSellerFeeCents(itemCents, shippingCents)` =
  `feeAt(item+shipping, 290) + 30`, capped at `item` (never negative payout). New
  `resolveFeeMode(priorOrderCount)` -> `'welcome' | 'tier'` (`< WELCOME_SALES (=10)`).
  Add `WELCOME_SALES = 10`. **Delete `SHIPPING_CENTS = 1200`** (the flat default) — shipping
  now comes from the listing; `orderAmountsAt` keeps its `shippingCents` param but callers
  must pass the listing value explicitly (no flat fallback).
- `lib/shipping.ts` (new): `SHIPPING_PRESETS` (§4a/4b), `shippingForCategory(category)` pure
  fallback-to-floor, and `quoteShipping(category, fromAddr)` async EasyPost worst-zone rater
  returning `max(quote, floor) + 200`. Fail-soft: on EasyPost error, use `floor + 200` and
  set `shipping_source='preset'`.
- Listing create/edit (`app/sell/...` + its API route): call the shipping engine, store
  `shipping_cents` + `shipping_source` on the listing. Remove any seller shipping input.
- Checkout (`app/api/checkout/route.ts`): read `shipping_cents` from the listing (offer
  checkout still 0 shipping per current behavior); resolve `fee_mode` from the seller's prior
  order count; `welcome` -> `welcomeSellerFeeCents`, set `fee_mode='welcome'`, snapshot;
  `tier` -> existing `feeBpsForUser` + `orderAmountsAt` path. Buyer total = item + shipping,
  no platform fee, either mode.

## 7. Identity locks

- **Bank (hard):** on Connect payout onboarding / `account.updated` webhook, capture the
  external-account fingerprint into `payment_identities(kind='bank')`; the partial unique
  index rejects a bank already bound to another user -> block payouts on the 2nd account with
  a clear message. Kills welcome-phase farming (a fresh real bank per 10 sales isn't worth it).
- **Card (soft):** on buyer payment, capture `payment_identities(kind='card')`; if the
  fingerprint is on >= N other accounts (default 2), flag to moderation (ban-evasion signal)
  — do NOT hard-block (shared household cards).
- **Phone:** already DB-unique (`profiles_phone_unique`) — reuse, no change.
- **Verification:** repoint `lib/idv` provider adapter Persona -> Stripe Identity/Connect;
  `verification-policy.ts` logic + $5k trigger unchanged. Leave `persona.ts` in tree only if
  something still imports it; otherwise delete and prune its tests.

## 8. Disclosure surfaces

- Seller onboarding/ToS + sell form: "Your first 10 sales are commission-free — just cover
  card processing. Shipping is calculated for you and prepaid. After 10 sales you move to
  volume rates as low as 3.5%. No buyer fees, ever."
- Listing + checkout: show the single shipping price as a normal line item (no fee breakdown
  of the $2 margin — it is disclosed carriage, not a separate platform fee).
- Seller settings: welcome progress ("6 of 10 commission-free sales used"); after graduation,
  the existing tier dashboard.

## 9. Edge cases

- EasyPost down at listing time -> `floor + $2`, `shipping_source='preset'`; never block the
  listing on a shipping quote.
- Actual label at fulfillment exceeds the quoted worst-zone price (rare: oversize/remote) ->
  platform eats the difference; log for preset tuning. Do not re-bill the buyer.
- Seller edits category after listing -> re-quote and overwrite `shipping_cents`.
- Bank fingerprint unavailable (rare) -> fail closed on payout onboarding (can't sell until a
  lockable instrument is attached), consistent with the current "payout required" gate.
- INFORM trigger fires for a welcome-phase seller who hits $5k in <=10 sales -> Stripe
  verification required before further payouts, independent of fee mode.

## 10. Tests

- Pure: `welcomeSellerFeeCents` (2.9%+30c, item cap), `resolveFeeMode` boundary at 10,
  `shippingForCategory` floors, `quoteShipping` = max(quote,floor)+200 incl. EasyPost-error
  fallback. Update `fees.test.ts` for the removed `SHIPPING_CENTS` + new functions.
- Route/integration: listing-create stores `shipping_cents`; checkout snapshots `fee_mode`
  and reads listing shipping; 10th vs 11th order pricing; bank fingerprint collision blocks
  2nd-account payout; card collision flags not blocks.
- Prune Persona-gate tests; no monthly-fee tests (feature deleted).

## 11. Gates & files

- `db-guard` on `0038` (partial unique index, listing shipping cols, no monthly ledger).
- `code-reviewer` on `lib/fees.ts`, `lib/shipping.ts`, listing create/edit + its API,
  checkout, the fingerprint-lock resolver, and the Stripe verification adapter.
- `ui-verifier` on the sell form (shipping input removed), listing/checkout shipping line,
  and seller-settings welcome progress.
- `pnpm verify` + `pnpm build` green; regen `lib/supabase/types.ts` after the migration.

## Open decisions (confirm with Tony before build)

1. Split **Accessories** into Small ($8 -> $10) vs Bag ($16 -> $18)? (belt vs duffel is a huge
   parcel range under one category.)
2. Adopt **+$4 signature confirmation on items > $750** (Grailed does this)?
3. Keep **Footwear floor at $20** or ease it (flagged as slightly above Depop/Poshmark market)?
