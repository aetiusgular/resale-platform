# G11 kickoff prompt — onboarding ramp + category shipping margin + identity locks

> Run this in an **on-computer** Claude Code session inside `~/Projects/resale-platform`
> (needs the native toolchain + the repo's `.claude/agents` gates + a real `pnpm verify`).
> This is a **money-path** phase. Keep `docs/G11_onboarding_shipping_margin.md` open beside it.
>
> **Already landed on `feat/fee-tier-checkpoints` (do not rebuild):** the pure core —
> `lib/shipping.ts` (presets, floors, `resolveShippingCents`, injected `ParcelRater`),
> `lib/fees.ts` additions (`WELCOME_SALES`, `resolveFeeMode`, `welcomeSellerFeeCents`,
> `STRIPE_PCT_BPS`/`STRIPE_FIXED_CENTS`), and their tests (`tests/unit/shipping.test.ts`,
> `tests/unit/welcome-fee.test.ts`). `SHIPPING_CENTS = 1200` is still present and still used
> by checkout — you REMOVE it as part of step 3 below, not before.

---

On branch `feat/fee-tier-checkpoints`, build **phase G11** per
`docs/G11_onboarding_shipping_margin.md`. Read that spec and `CLAUDE.md` first; follow the
repo's phase discipline (one verified phase, gated, native `pnpm verify` green before each
commit). Do NOT reintroduce Persona or any monthly-fee ledger.

Locked open-decision defaults for this build (all reversible; flagged for later tuning):
1. **Accessories** stays a single preset ($12 floor → $14 buyer). Do not split small/bag yet
   — the sell-form enum has no such split; revisit from real shipment data.
2. **No +$4 signature-confirmation on >$750 items** in v1. Leave a documented TODO hook in
   `lib/shipping.ts`; do not wire it.
3. **Footwear floor stays $20** ($22 buyer) — Tony's explicit minimum.

Scope, exactly:

1. **Migration `0038` (db-guard BEFORE pushing).**
   - `profiles.lifetime_sales_count INT NOT NULL DEFAULT 0` (cached non-cancelled seller-order
     count; maintain on order create + reversal, OR derive in code — decide in review, but the
     checkout read must be O(1)).
   - `orders.fee_mode TEXT CHECK (fee_mode IN ('welcome','tier')) NOT NULL DEFAULT 'tier'`.
   - `listings.shipping_cents INT` (nullable; backfill existing rows from the category preset
     via `floorShippingCents` equivalent in SQL or a follow-up script) and
     `listings.shipping_source TEXT CHECK (shipping_source IN ('preset','quote')) DEFAULT 'preset'`.
   - **Bank hard lock:** partial `UNIQUE INDEX ... ON payment_identities (kind, fingerprint)
     WHERE kind = 'bank'`. Do NOT make card unique.
   - Add a comment documenting that `seller_monthly_fees` is intentionally NOT created.

2. **EasyPost live rater (`lib/shipping-easypost.ts`, server-only).** Implement a `ParcelRater`
   that takes a `ParcelPreset` + the seller ship-from address, rates the **cheaper of enabled
   ground carriers** (USPS Ground Advantage default; UPS Ground if a carrier account is
   attached) at the **worst realistic destination zone**, and returns the cheapest rate in
   cents or `null` on any error. Feed it through `quoteShippingCents` from `lib/shipping.ts`.
   Rating is free; never buy a label here.

3. **Listing create/edit** (`app/sell/...` + its API route): remove any seller shipping input;
   on create/edit call `quoteShippingCents(category, easypostRater)` and store
   `shipping_cents` + `shipping_source` on the listing. Re-quote on category change.

4. **Checkout** (`app/api/checkout/route.ts`): **remove the `SHIPPING_CENTS = 1200` default
   from `lib/fees.ts`** and make `orderAmountsAt`'s `shippingCents` a required arg; read the
   listing's `shipping_cents` (offer checkout keeps 0 shipping per current behavior). Resolve
   `fee_mode` from the seller's prior non-cancelled order count via `resolveFeeMode`; in
   `welcome` mode compute the seller fee with `welcomeSellerFeeCents(item, shipping)`, set
   `fee_mode='welcome'`, and snapshot; in `tier` mode keep the existing `feeBpsForUser` +
   `orderAmountsAt` path. Buyer total = item + shipping, no platform fee, either mode. Grep for
   every other `SHIPPING_CENTS` importer and update it.

5. **Identity locks.**
   - **Bank (hard):** on Connect payout onboarding / `account.updated`, capture the
     external-account fingerprint into `payment_identities(kind='bank')`; the partial unique
     index rejects a bank already bound to another user → block payouts on the 2nd account with
     a clear message. Fail closed if no lockable instrument is attached.
   - **Card (soft):** on buyer payment capture `payment_identities(kind='card')`; if the
     fingerprint is on >= N other accounts (default 2), flag to moderation — do NOT hard-block.
   - **Phone:** unchanged (`profiles_phone_unique`).

6. **INFORM repoint Persona → Stripe.** Switch the `lib/idv` provider adapter to Stripe
   Identity / Connect additional verification; keep `verification-policy.ts` logic + the $5k
   trailing-sales trigger unchanged. Remove `lib/idv/persona.ts` + `tests/unit/persona.test.ts`
   only if nothing still imports them; otherwise leave and mark dead.

7. **Disclosure UI (ui-verifier).** Sell form: shipping input gone, copy "Shipping is
   calculated and prepaid for you." Listing + checkout: single shipping line (no $2-margin
   breakdown — it's disclosed carriage, not a platform fee). Seller settings: welcome progress
   ("6 of 10 commission-free sales used"); after graduation, the existing tier dashboard.
   Onboarding/ToS: "Your first 10 sales are commission-free — just cover card processing.
   After 10 sales you move to volume rates as low as 3.5%. No buyer fees, ever."

8. **Tests.** Extend route/integration coverage: listing-create stores `shipping_cents`;
   checkout snapshots `fee_mode` and reads listing shipping; 10th vs 11th order pricing; bank
   fingerprint collision blocks 2nd-account payout; card collision flags not blocks. Update
   `fees.test.ts` for the removed `SHIPPING_CENTS` default. Prune Persona-gate tests.

Gates & verify (do not skip):
- `db-guard` on `supabase/migrations/20240101000038_*.sql` **before** pushing.
- `code-reviewer` on `lib/fees.ts` (the required-arg change), `lib/shipping-easypost.ts`,
  listing create/edit + API, checkout, the fingerprint-lock resolver, and the Stripe
  verification adapter.
- `ui-verifier` on the sell form, listing/checkout shipping line, and seller-settings progress.
- `pnpm verify` green before each commit; `pnpm build` green before merge. Regen
  `lib/supabase/types.ts` after the migration.
- Commit per logical step (migration, easypost rater + listing, checkout, identity locks,
  verification repoint, UI, tests) — never one blind megachange.

When green: update `docs/HANDOFF.md`, mark G11 in `docs/LAUNCH_ROADMAP.md`, note the
shipping-margin model + Persona→Stripe repoint in `docs/SESSION_STATUS.md`.
