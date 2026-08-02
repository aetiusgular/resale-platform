# Branch 2 — `feat/fee-volume-cap` (verified diff)

Enforce the flat **$2,000 per-order cap** toward trailing tier volume. Off `feat/fee-engine-v2`
(needs Branch 1's `trailingActivity`). Money-critical → code-reviewer. Cloud-verified.

## Recommended: in-app cap (no migration)
The current resolver aggregates in-app; capping is a one-liner and stays verifiable end-to-end.

### `lib/fee-tier.ts`
```diff
 export const NON_COUNTING_STATES = ['cancelled', 'refunded'] as const
+/** A single order contributes at most $2,000 toward tier-volume progress (anti single-item jump). */
+export const MAX_ORDER_VOLUME_CONTRIBUTION_CENTS = 200_000
```
```diff
   const rows = data as Array<{ item_cents: number }>
   return {
-    volumeCents: rows.reduce((sum, r) => sum + (r.item_cents ?? 0), 0),
+    volumeCents: rows.reduce(
+      (sum, r) => sum + Math.min(r.item_cents ?? 0, MAX_ORDER_VOLUME_CONTRIBUTION_CENTS), 0),
     orderCount: rows.length,
   }
```
Verified: one $10,000 sale → counts $2,000, 1 order → stays base (5%); five $3,000 sales →
$2k each = $10k over 5 orders → 4.0%. The **order count is unaffected** by the cap.

## Alternative: SQL `LEAST` in the query layer (your literal spec — adds an RPC)
If you'd rather push the cap into the DB now (cleaner at scale), replace `trailingActivity`'s
body with a call to this function instead of the in-app reduce:
```sql
-- migration: trailing_activity() — capped volume + count, DB-side
CREATE OR REPLACE FUNCTION trailing_activity(
  p_user_id UUID, p_side TEXT, p_since TIMESTAMPTZ, p_cap_cents INT DEFAULT 200000
)
RETURNS TABLE (volume_cents BIGINT, order_count INT)
LANGUAGE sql STABLE SET search_path = public AS $$
  SELECT COALESCE(SUM(LEAST(o.item_cents, p_cap_cents)), 0)::BIGINT, COUNT(*)::INT
  FROM orders o
  WHERE (CASE WHEN p_side = 'buyer' THEN o.buyer_id ELSE o.seller_id END) = p_user_id
    AND o.created_at >= p_since
    AND o.state NOT IN ('cancelled','refunded');
$$;
GRANT EXECUTE ON FUNCTION trailing_activity(UUID, TEXT, TIMESTAMPTZ, INT) TO service_role;
```
```ts
const { data } = await service.rpc('trailing_activity', {
  p_user_id: userId, p_side: side, p_since: cutoffIso,
  p_cap_cents: MAX_ORDER_VOLUME_CONTRIBUTION_CENTS,
})
const row = (data?.[0] ?? {}) as { volume_cents?: number; order_count?: number }
return { volumeCents: Number(row.volume_cents ?? 0), orderCount: row.order_count ?? 0 }
```
Trade-off: one efficient DB call vs. duplicating the `cancelled/refunded` filter in SQL. I
**recommend the in-app version for this branch** (verifiable, no migration, matches the existing
"move to a SQL rollup later" note) and moving to the RPC when you do the aggregation-scale pass.

## Test: add to the fee-tier coverage
`trailingActivity` caps each row (`[{1_000_000}] → {volumeCents:200_000, orderCount:1}`); a lone
$10k order resolves to base; 5×$3k resolves to 4.0%. (See `branch23.reference.test.ts`.)
