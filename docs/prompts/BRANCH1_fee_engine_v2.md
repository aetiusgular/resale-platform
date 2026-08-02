# Branch 1 — `feat/fee-engine-v2` (verified diffs)

Rates −50 bps, order-count AND-gate, $0.30/side floor. **No migration** (the `buyer_fee_bps`
/`seller_fee_bps` snapshot columns already exist). Blast radius is exactly **`lib/fees.ts` +
`lib/fee-tier.ts` + `tests/unit/fees.test.ts`** — every caller keeps its signature
(`feeBpsForUser`, `orderAmountsAt`, `trailingVolumeCents` are all preserved). Existing orders
are unaffected (fees are snapshotted). **Money-critical → code-reviewer.**

Branch off `main` (isolated money change): `git checkout main && git checkout -b feat/fee-engine-v2`.

**Cloud-verified before shipping:** tsc clean; 15 unit tests green — the AND-gate drop-through
(`$10k + 14 orders → 3.0%`, `$10k + 4 orders → 4.0%`) and the $0.30 floor (doc Scenario B).

---

## `lib/fees.ts`

### 1) FEE_TIERS — add `minOrders`, new bps
```diff
-export const FEE_TIERS: ReadonlyArray<{ minVolumeCents: number; bps: number }> = [
-  { minVolumeCents: 1_000_000, bps: 250 }, // ≥ $10,000 → 2.5%
-  { minVolumeCents:   500_000, bps: 350 }, // ≥ $5,000  → 3.5%
-  { minVolumeCents:   300_000, bps: 400 }, // ≥ $3,000  → 4.0%
-  { minVolumeCents:   100_000, bps: 450 }, // ≥ $1,000  → 4.5%
-  { minVolumeCents:         0, bps: 550 }, // <  $1,000 → 5.5%
-]
+export const FEE_TIERS: ReadonlyArray<{ minVolumeCents: number; minOrders: number; bps: number }> = [
+  { minVolumeCents: 1_000_000, minOrders: 15, bps: 200 }, // ≥ $10,000 & ≥15 orders → 2.0%
+  { minVolumeCents:   500_000, minOrders: 10, bps: 300 }, // ≥ $5,000  & ≥10 orders → 3.0%
+  { minVolumeCents:   300_000, minOrders:  7, bps: 350 }, // ≥ $3,000  & ≥7  orders → 3.5%
+  { minVolumeCents:   100_000, minOrders:  3, bps: 400 }, // ≥ $1,000  & ≥3  orders → 4.0%
+  { minVolumeCents:         0, minOrders:  0, bps: 500 }, // base                  → 5.0%
+]
```

### 2) Base rate + new floor constant
```diff
-/** Highest fee (new / lowest-activity users). Safe display fallback. */
-export const BASE_FEE_BPS = 550
+/** Highest fee (new / lowest-activity users). Safe display fallback. */
+export const BASE_FEE_BPS = 500
+
+/** Platform floor: minimum fee per side ($0.30) — insulates against fixed processor cost. */
+export const MIN_FEE_CENTS = 30
```

### 3) Order-count AND-gate — new `feeBpsForActivity`, keep `feeBpsForVolumeCents` as a shim
```diff
-/**
- * Resolve the fee rate (basis points) for a given trailing-365d volume in cents.
- * Monotonic non-increasing in volume. Negative/NaN volume falls back to BASE.
- */
-export function feeBpsForVolumeCents(trailingVolumeCents: number): number {
-  if (!Number.isFinite(trailingVolumeCents) || trailingVolumeCents < 0) {
-    return BASE_FEE_BPS
-  }
-  for (const tier of FEE_TIERS) {
-    if (trailingVolumeCents >= tier.minVolumeCents) return tier.bps
-  }
-  return BASE_FEE_BPS
-}
+/**
+ * Authoritative rate: the richest tier where trailing volume ≥ minVolumeCents AND
+ * completed-order count ≥ minOrders. Both gates must pass — enough volume on too few
+ * orders drops to the lower tier the count clears (anti single-order wash-trading).
+ */
+export function feeBpsForActivity(volumeCents: number, orderCount: number): number {
+  if (!Number.isFinite(volumeCents) || volumeCents < 0) return BASE_FEE_BPS
+  const count = Number.isFinite(orderCount) && orderCount >= 0 ? orderCount : 0
+  for (const tier of FEE_TIERS) {
+    if (volumeCents >= tier.minVolumeCents && count >= tier.minOrders) return tier.bps
+  }
+  return BASE_FEE_BPS
+}
+
+/** @deprecated volume-only (IGNORES the order-count gate) — display/fallback use only.
+ *  The authoritative charged rate is feeBpsForActivity, resolved in lib/fee-tier.ts. */
+export function feeBpsForVolumeCents(volumeCents: number): number {
+  return feeBpsForActivity(volumeCents, Number.MAX_SAFE_INTEGER)
+}
```

### 4) $0.30 floor on each side
```diff
-/** Seller fee at an explicit (tier-resolved) rate. */
 export function sellerFeeAt(priceCents: number, bps: number): number {
-  return feeAt(priceCents, bps)
+  return Math.max(feeAt(priceCents, bps), MIN_FEE_CENTS)
 }
-
-/** Buyer fee at an explicit (tier-resolved) rate. */
 export function buyerFeeAt(priceCents: number, bps: number): number {
-  return feeAt(priceCents, bps)
+  return Math.max(feeAt(priceCents, bps), MIN_FEE_CENTS)
 }
```
`orderAmountsAt`, `sellerPayoutAt`, `buyerTotalAt` all compose `sellerFeeAt`/`buyerFeeAt`, so
they inherit the floor with no further change. (`feeAt` stays raw — it's the generic helper.)

---

## `lib/fee-tier.ts`

### 1) Import the gated resolver
```diff
-import { feeBpsForVolumeCents, BASE_FEE_BPS } from '@/lib/fees'
+import { feeBpsForActivity, BASE_FEE_BPS } from '@/lib/fees'
```

### 2) Return the order count too — `trailingActivity`, keep `trailingVolumeCents`
```diff
-export async function trailingVolumeCents(
-  service: ServiceClient,
-  userId: string,
-  side: FeeSide,
-): Promise<number> {
-  const column = side === 'buyer' ? 'buyer_id' : 'seller_id'
-  const cutoffIso = new Date(Date.now() - TRAILING_DAYS * 24 * 60 * 60 * 1000).toISOString()
-
-  const { data, error } = await service
-    .from('orders')
-    .select('item_cents')
-    .eq(column, userId)
-    .gte('created_at', cutoffIso)
-    .not('state', 'in', `(${NON_COUNTING_STATES.join(',')})`)
-
-  if (error || !data) return 0
-  const rows = data as Array<{ item_cents: number }>
-  return rows.reduce((sum, r) => sum + (r.item_cents ?? 0), 0)
-}
+export async function trailingActivity(
+  service: ServiceClient,
+  userId: string,
+  side: FeeSide,
+): Promise<{ volumeCents: number; orderCount: number }> {
+  const column = side === 'buyer' ? 'buyer_id' : 'seller_id'
+  const cutoffIso = new Date(Date.now() - TRAILING_DAYS * 24 * 60 * 60 * 1000).toISOString()
+
+  const { data, error } = await service
+    .from('orders')
+    .select('item_cents')
+    .eq(column, userId)
+    .gte('created_at', cutoffIso)
+    .not('state', 'in', `(${NON_COUNTING_STATES.join(',')})`)
+
+  if (error || !data) return { volumeCents: 0, orderCount: 0 }
+  const rows = data as Array<{ item_cents: number }>
+  return {
+    volumeCents: rows.reduce((sum, r) => sum + (r.item_cents ?? 0), 0),
+    orderCount: rows.length,
+  }
+}
+
+/** Back-compat: volume only. Still used by the $5k ID-verification trigger
+ *  (lib/idv/verification-policy.ts) — DO NOT remove. */
+export async function trailingVolumeCents(
+  service: ServiceClient,
+  userId: string,
+  side: FeeSide,
+): Promise<number> {
+  return (await trailingActivity(service, userId, side)).volumeCents
+}
```
> Branch 2 (`fee-volume-cap`) will change the volume line to
> `Math.min(r.item_cents ?? 0, 200_000)` (the flat $2,000/order cap). Leave it a plain sum here.

### 3) Resolve with both signals
```diff
   try {
-    const volume = await trailingVolumeCents(service, userId, side)
-    return feeBpsForVolumeCents(volume)
+    const { volumeCents, orderCount } = await trailingActivity(service, userId, side)
+    return feeBpsForActivity(volumeCents, orderCount)
   } catch (err) {
     console.error(`[fee-tier] volume lookup failed for ${side} ${userId}; charging BASE`, err)
     return BASE_FEE_BPS
   }
```
`feeBpsForUser`'s signature is unchanged, so `app/api/checkout/route.ts` and every display
site that resolves via it are untouched — they just get the gated rate now.

---

## `tests/unit/fees.test.ts`
Update the tiered expectations to the new numbers and add the gate + floor blocks. Verified
reference (lift these):

- `BASE_FEE_BPS` → **500**; `FEE_TIERS` bps `[200,300,350,400,500]`, minOrders `[15,10,7,3,0]`.
- `feeBpsForVolumeCents` mapping (now volume-only view): `0→500, 100_000→400, 300_000→350,
  500_000→300, 1_000_000→200`.
- **New** `feeBpsForActivity` gate cases: `(1_000_000,15)→200`, `(1_000_000,14)→300`,
  `(1_000_000,9)→350`, `(1_000_000,2)→500`, `(500_000,3)→400`, `(100_000,99)→400`,
  `(50_000,99)→500`, `(-1,15)→BASE`.
- **New** floor cases: `sellerFeeAt(500,500)→30`, `buyerFeeAt(100,500)→30`,
  `sellerFeeAt(100000,500)→5000`; Scenario B `orderAmountsAt(1000,200,200,0)` → both fees `30`.
- If `tests/e2e/checkout.spec.ts` asserts a specific bps via `feeBpsForVolumeCents(0)`, it now
  returns **500** (was 550) — update that expectation.

Add a matching test in `lib/fee-tier` coverage (or extend an existing one) for
`trailingActivity` returning `{volumeCents, orderCount}` and `feeBpsForUser` applying the gate.

## Acceptance
`pnpm verify` green; a base user pays 5.0%/side, a $10k+/15-order user pays 2.0%, a
$10k/4-order user pays 4.0% (gated), and any sub-$1.50-fee side is floored to $0.30. Snapshots
of existing orders unchanged. code-reviewer on the money diff.
