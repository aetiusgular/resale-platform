# Fee model v2 — build runbook (Branches 1–3)

**Everything is already written to your working tree** (`~/Projects/resale-platform`, currently on
`feat/recs-integration`). Nothing to drop in or hand-edit — all 9 new/overwritten files are in
place and the 3 route edits are applied. All logic is **cloud-verified**: `tsc --noEmit` strict
clean + **41 unit tests green** (fees, fee-tier, tier-state, tier-progress). What's left is native,
which only your Mac can do: `pnpm verify` (eslint runs there — not in the cloud VM), `supabase db
push`, and the git commits below.

The 6 target files are **identical on `main` and `feat/recs-integration`**, so branching off `main`
carries the uncommitted changes cleanly (no conflicts).

---

## Scope vs. the locked 4-branch plan
Branches **1 + 2 are combined** into `feat/fee-engine-v2` (both touch only `lib/fees.ts` +
`lib/fee-tier.ts` + fee tests — one coherent money change, one review; the $2k cap is one line).
Branch **3** = `feat/stateful-tiers` (migration + new modules + checkout/release wiring, its own
db-guard review). Branch **4** (anti-fraud) is a separate workstream — needs Twilio + Stripe
credentials.

The two branches touch **disjoint files**, so committing them by path from one working tree is clean.

---

## What changed on disk

**Branch A files — `feat/fee-engine-v2`** (no migration)
- `lib/fees.ts` — rates −50bps (base 5.0%, elite 2.0%), order-count AND-gate, `MIN_FEE_CENTS=30` floor
- `lib/fee-tier.ts` — `trailingActivity` (volume+count) with $2,000/order cap; gated `feeBpsForUser`
- `tests/unit/fees.test.ts` — v2 numbers, gate + floor cases
- `tests/unit/fee-tier.test.ts` — NEW: cap + count-gate integration

**Branch B files — `feat/stateful-tiers`** (off Branch A)
- `supabase/migrations/20240101000022_stateful_tiers.sql` — NEW: profiles tier-state columns
- `lib/tier-state.ts` — NEW: pure 30-day lock logic
- `lib/tier-progress.ts` — NEW: `resolveEffectiveBps` (checkout) + `applyTierProgress` (completion)
- `tests/unit/tier-state.test.ts`, `tests/unit/tier-progress.test.ts` — NEW
- `app/api/checkout/route.ts` — EDIT: `feeBpsForUser` → `resolveEffectiveBps` (import + 2 calls)
- `app/api/orders/[id]/deliver/route.ts` — EDIT: `applyTierProgress(buyer+seller)` after release
- `app/api/cron/process-transfers/route.ts` — EDIT: `+buyer_id` in select, `applyTierProgress` after transfer

---

## Branch A — commit
```bash
cd ~/Projects/resale-platform
git checkout main && git pull                 # working-tree changes carry (files identical on main)
git checkout -b feat/fee-engine-v2
pnpm verify                                    # eslint + tsc + vitest (full repo)
git add lib/fees.ts lib/fee-tier.ts tests/unit/fees.test.ts tests/unit/fee-tier.test.ts
git commit -m "feat(fees): v2 tiers — -50bps rates, order-count gate, \$0.30 floor, \$2k/order cap"
```
Run **code-reviewer** on the money diff. Acceptance: base 5.0%/side; $10k+15 orders → 2.0%;
$10k+14 orders → 3.0% (count-gated); a single $10k order stays base (cap + count); sub-$6 items
floored to $0.30/side. Existing orders unchanged (fees snapshotted per order).

## Branch B — commit (stacked on A)
```bash
git checkout -b feat/stateful-tiers            # from feat/fee-engine-v2; B depends on A's resolver
supabase db push                               # applies migration 22 — run db-guard first
pnpm verify
git add supabase/migrations/20240101000022_stateful_tiers.sql \
        lib/tier-state.ts lib/tier-progress.ts \
        tests/unit/tier-state.test.ts tests/unit/tier-progress.test.ts \
        app/api/checkout/route.ts app/api/orders/[id]/deliver/route.ts \
        app/api/cron/process-transfers/route.ts
git commit -m "feat(fees): v2 stateful tier lock (30-day) + checkout/release wiring"
```
Gates: **db-guard** on the migration, **code-reviewer** on the resolver + checkout/release wiring.
Acceptance: reaching a better tier persists it + a 30-day lock; a mid-window activity drop keeps
the locked rate until expiry, then degrades; checkout charges the effective (locked-or-activity)
rate and snapshots it.

---

## The 3 route edits (already applied — shown for your reviewer)

**`app/api/checkout/route.ts`**
```diff
-import { feeBpsForUser } from '@/lib/fee-tier'
+import { resolveEffectiveBps } from '@/lib/tier-progress'
...
   const [buyerBps, sellerBps] = await Promise.all([
-    feeBpsForUser(service, user.id, 'buyer'),
-    feeBpsForUser(service, listing.seller_id, 'seller'),
+    resolveEffectiveBps(service, user.id, 'buyer'),
+    resolveEffectiveBps(service, listing.seller_id, 'seller'),
   ])
```
**`app/api/orders/[id]/deliver/route.ts`** — import added; after the release RPC succeeds:
```ts
  await Promise.all([
    applyTierProgress(service, order.buyer_id, 'buyer'),
    applyTierProgress(service, order.seller_id, 'seller'),
  ])
```
**`app/api/cron/process-transfers/route.ts`** — import added; `+buyer_id` in the released-orders
select; after each successful transfer (`processed++`):
```ts
      await Promise.all([
        applyTierProgress(service, order.buyer_id, 'buyer'),
        applyTierProgress(service, order.seller_id, 'seller'),
      ])
```

---

## Follow-ons (not in these branches)
- **Display parity:** `app/checkout/[listingId]/page.tsx` still quotes `feeBpsForUser`. After
  Branch B, swap the checkout-page quote to `resolveEffectiveBps` so shown == charged. Sell/listing
  indicative rates can move with the dashboards (v2 item 1f). `feeBpsForUser` stays valid (pure
  activity rate); `lib/idv/verification-policy.ts` still uses `trailingVolumeCents` (preserved).
- **Branch 4 (anti-fraud):** Twilio Lookup VOIP block + Stripe collusion engine (bank/card
  fingerprint, billing name/zip, ship-to-self) extending G6 — needs credentials.

## Housekeeping
While working around a git index-lock in the cloud VM I moved a stale lock file into
`_to_delete_cowork/index.lock.stale` (the VM can't delete files). Safe to `rm -rf _to_delete_cowork`
whenever — it's not tracked and not needed.
