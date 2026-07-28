-- Migration: 20240101000017_tiered_fees
-- Supports the usage-based tiered fee model (business-model change 2026-07-26).
--
-- Fee rate per side is resolved at checkout from each user's TRAILING-365-DAY
-- volume of completed, non-reversed orders (SUM of item_cents), EXCLUDING
-- state IN ('cancelled','refunded') so volume cannot be gamed by self-dealing
-- then cancelling. Resolver lives in lib/fee-tier.ts; tier table in lib/fees.ts.
--
-- INDEX-ONLY migration: no new tables, no RLS/policy changes, no grants, no
-- enum/column/money changes, no data changes. Purely additive + idempotent.
--
-- The resolver query is:
--   SELECT item_cents FROM orders
--   WHERE buyer_id = $1  AND created_at >= $2  AND state NOT IN ('cancelled','refunded')
-- (and the seller_id equivalent). These composite indexes make it index-served
-- instead of a per-user row scan as the orders table grows.
--
-- CONCURRENTLY is intentionally NOT used: Supabase runs migrations inside a
-- transaction, and CREATE INDEX CONCURRENTLY cannot run in a transaction. The
-- orders table is small at alpha so a plain CREATE INDEX is safe and fast.
--
-- NOTE for db-guard: the pre-existing single-column indexes orders_buyer_id_idx
-- and orders_seller_id_idx become left-prefix-redundant with these composites.
-- They are intentionally LEFT IN PLACE here (dropping an index is destructive
-- and out of scope for an additive migration); recommend a separate reviewed
-- cleanup migration to drop the two single-column indexes.
--
-- db-guard review: REQUIRED before push.

-- Buyer-side trailing PURCHASE volume lookups.
CREATE INDEX IF NOT EXISTS orders_buyer_created_idx
  ON orders (buyer_id, created_at);

-- Seller-side trailing SALES volume lookups.
CREATE INDEX IF NOT EXISTS orders_seller_created_idx
  ON orders (seller_id, created_at);
