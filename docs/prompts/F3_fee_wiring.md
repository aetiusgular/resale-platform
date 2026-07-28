# F3 — Wire tiered fees into checkout + display (step-by-step)

Execute ON YOUR COMPUTER (needs native `tsc` across ~20 files + `ui-verifier`).
Branch: continue `feat/tiered-fees`. Gates: **db-guard** (migration), **code-reviewer**
(money diff), **ui-verifier** (checkout/sell/listing). Ship checkout + display in
ONE commit — the displayed fee must always equal the charged fee.

Foundation already on the branch: `lib/fees.ts` (`orderAmountsAt`, `feeBpsForVolumeCents`,
`*At` variants), `lib/fee-tier.ts` (`feeBpsForUser(service, userId, 'buyer'|'seller')`),
migration `0017` (trailing-volume indexes). All inert until this phase wires them.

## Step 1 — Migration: snapshot the rates
New migration `20240101000018_fee_bps_snapshot.sql` (run **db-guard**):
- Add `buyer_fee_bps INT` and `seller_fee_bps INT` to `orders` and to `checkout_sessions`.
- Nullable (historical rows predate tiers). Backfill existing rows to `200`
  (they were charged flat 2%): `UPDATE ... SET buyer_fee_bps = 200, seller_fee_bps = 200 WHERE buyer_fee_bps IS NULL;`
- `CHECK (buyer_fee_bps BETWEEN 0 AND 10000)` etc. Idempotent (`ADD COLUMN IF NOT EXISTS`).
- No RLS/grant changes (service-role writes these, as with the other fee columns).

## Step 2 — Checkout route (`app/api/checkout/route.ts`)
- After resolving `priceCents` and the seller, resolve both rates server-side:
  ```ts
  import { feeBpsForUser } from '@/lib/fee-tier'
  import { orderAmountsAt } from '@/lib/fees'
  const [buyerBps, sellerBps] = await Promise.all([
    feeBpsForUser(service, user.id, 'buyer'),
    feeBpsForUser(service, listing.seller_id, 'seller'),
  ])
  const amounts = orderAmountsAt(priceCents, buyerBps, sellerBps, offerId ? 0 : undefined)
  ```
- Add `buyer_fee_bps: buyerBps, seller_fee_bps: sellerBps` to BOTH the
  `checkout_sessions` insert and the Stripe PaymentIntent `metadata` (as strings).
- Include `buyer_fee_bps` in the returned `orderSummary` so the confirm screen can show it.

## Step 3 — Webhook (`app/api/webhooks/stripe/route.ts`)
- When creating the `orders` row from the session/metadata, persist
  `buyer_fee_bps` / `seller_fee_bps` onto the order. Fees remain snapshot-immutable.

## Step 4 — Display refactor (the ~20 sites)
Rule of thumb by surface:
- **Prospective fee** (listing-card, PDP, browse, sell-form, checkout preview): use
  the VIEWER's live rate. In a server component resolve `feeBpsForUser(service, viewerId, side)`;
  pass the rate into client components as a prop. Logged-out viewer → `BASE_FEE_BPS`
  (show "up to 5.5%, drops as you buy/sell"). Replace `buyerFee(p)`→`buyerFeeAt(p, bps)`,
  `sellerFee`/`sellerPayout`→`*At`, `orderAmounts`→`orderAmountsAt`.
- **Historical / receipt** (order-buyer, order-seller, orders/[id], admin): use the
  order's SNAPSHOTTED `buyer_fee_bps`/`seller_fee_bps` (or the stored `*_fee_cents`) —
  **never re-resolve**; a past order must show the fee actually charged.
- `formatCents`-only importers do NOT change.
Find every call site: `grep -rnE '\b(buyerFee|sellerFee|orderAmounts|sellerPayout|buyerTotal)\b' app lib --include=*.ts --include=*.tsx | grep -vE 'lib/fees|lib/fee-tier'`.

## Step 5 — Retire the legacy flat path
Once no caller uses them, delete `sellerFee`/`buyerFee`/`sellerPayout`/`buyerTotal`/
`orderAmounts` and `SELLER_FEE_BPS`/`BUYER_FEE_BPS` from `lib/fees.ts`; update
`fees.test.ts` (drop the legacy-fn tests; keep the `orderAmountsAt(p,200,200)`
equivalence as the flat-2% regression anchor).

## Step 6 — Tier UX
- Show the viewer their rate + tier ("Your fee: 3.5% · Tier 2") with a link to the
  tier table. Sell-form: live payout at the seller's tier + "fees drop as you sell more."
- Optional: a small `/fees` page rendering `FEE_TIERS`.

## Step 7 — Verify + gates + commit
- `pnpm verify` green (tsc + eslint + vitest). `pnpm build` green.
- **code-reviewer** on the money diff; **db-guard** on the migration; **ui-verifier**
  on checkout/sell/listing.
- ONE commit: `feat(fees): apply tiered rates to checkout + all fee displays`.

## Acceptance
- A tier-1 buyer sees & pays 2.5%; a base-tier seller sees & pays 5.5% on the same order.
- Fee shown == fee charged, everywhere.
- Snapshot immutable post-payment; a historical order still shows its original rate
  after the buyer's tier later changes.
- Offer-based checkout (no shipping) resolves both tiers correctly.
- Logged-out browsing shows the base/prospective rate with no error.
- `RECS_ENABLED` unaffected; no secret rates leak to client (bps are non-sensitive, but
  resolution stays server-side).
