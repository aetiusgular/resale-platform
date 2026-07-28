# F3 — Wire tiered fees into checkout + display (step-by-step)

## STATUS (2026-07-26): money core DONE — START AT STEP 4 (displays)

Steps 1–3 are already implemented and gate-passed on branch `feat/tiered-fees`.
**Do NOT redo them** (no duplicate migration, no re-editing the routes):

- ✅ **Step 1** — migration `20240101000018_fee_bps_snapshot.sql`: `buyer_fee_bps`/
  `seller_fee_bps` added to `checkout_sessions` + `orders` (nullable; historical
  backfilled to 200; `CHECK 0..10000`). db-guard PASS.
- ✅ **Step 2** — `app/api/checkout/route.ts`: resolves per-side rate via
  `feeBpsForUser(service, id, 'buyer'|'seller')`, computes with `orderAmountsAt`,
  snapshots both bps into `checkout_sessions`, and returns `buyer_fee_bps` in
  `orderSummary`.
- ✅ **Step 3** — `app/api/webhooks/stripe/route.ts`: reads the two bps from the
  session (not PI metadata) and writes them onto the order.
- Typecheck-clean under TS 5.9.3; code-reviewer PASS.

⚠️ **Live checkout now CHARGES tiered rates, but displays still SHOW flat 2%.**
The branch must NOT be deployed/merged until Steps 4–7 are complete — otherwise a
buyer sees 2% and is charged their tier rate.

Execute ON YOUR COMPUTER (native `tsc` across ~20 files + `ui-verifier`).
Gates for this half: **code-reviewer** (display diff), **ui-verifier**
(checkout/sell/listing). Finish with one commit for the display half.

Helpers already on the branch: `lib/fees.ts` (`orderAmountsAt`, `buyerFeeAt`,
`sellerFeeAt`, `sellerPayoutAt`, `feeBpsForVolumeCents`, `BASE_FEE_BPS`),
`lib/fee-tier.ts` (`feeBpsForUser`). Orders/sessions now carry
`buyer_fee_bps`/`seller_fee_bps`.

---

## Step 4 — Display refactor (the ~20 sites)  ◀ START HERE

Find every rate-dependent call site:
```
grep -rnE '\b(buyerFee|sellerFee|orderAmounts|sellerPayout|buyerTotal)\b' app lib \
  --include=*.ts --include=*.tsx | grep -vE 'lib/fees|lib/fee-tier'
```
`formatCents`-only importers do NOT change. Convert by surface:

- **Prospective fee** (listing-card, PDP, browse, sell-form, checkout preview):
  use the VIEWER's live rate. In a server component resolve
  `feeBpsForUser(service, viewerId, side)`; pass the rate into client components
  as a prop. Logged-out viewer → `BASE_FEE_BPS` (show "up to 5.5%, drops as you
  buy/sell"). Replace `buyerFee(p)`→`buyerFeeAt(p, bps)`, `sellerFee`/`sellerPayout`
  →`*At`, `orderAmounts`→`orderAmountsAt`.
- **Historical / receipt** (order-buyer, order-seller, orders/[id], admin): render
  from the order's SNAPSHOTTED `buyer_fee_bps`/`seller_fee_bps` (or the stored
  `*_fee_cents`). **Never re-resolve** — a past order shows the fee actually charged.

## Step 5 — Retire the legacy flat path
Once no caller uses them, delete `sellerFee`/`buyerFee`/`sellerPayout`/`buyerTotal`/
`orderAmounts` + `SELLER_FEE_BPS`/`BUYER_FEE_BPS` from `lib/fees.ts`; update
`fees.test.ts` (drop the legacy-fn tests; keep `orderAmountsAt(p,200,200)` as the
flat-2% regression anchor).

## Step 6 — Tier UX
Show the viewer their rate + tier ("Your fee: 3.5% · Tier 2") linking to the tier
table. Sell-form: live payout at the seller's tier + "fees drop as you sell more."
Optional `/fees` page rendering `FEE_TIERS`.

## Step 7 — Verify + gates + commit
`pnpm verify` + `pnpm build` green. code-reviewer on the display diff; ui-verifier
on checkout/sell/listing. ONE commit:
`feat(fees): apply tiered rates to all fee displays + retire flat path`.

## Acceptance
- A tier-1 buyer sees & pays 2.5%; a base seller sees & pays 5.5% on the same order.
- Fee shown == fee charged, everywhere.
- A historical order still shows its original rate after the buyer's tier changes.
- Offer-based checkout (no shipping) resolves both tiers correctly.
- Logged-out browsing shows the base/prospective rate with no error.
