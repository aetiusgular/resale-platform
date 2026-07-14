-- Migration: 20240101000014_fix_recursive_rls
-- HF1: Fixes "infinite recursion detected in policy for relation profiles".
--
-- Root cause: profiles_admin_all (migration 000000) does
--   EXISTS(SELECT FROM profiles) ON profiles ITSELF.
-- Every other admin policy doing EXISTS(SELECT FROM profiles) on another table
-- also triggers profiles RLS → profiles_admin_all → recurse.
--
-- Fix: SECURITY DEFINER is_admin() bypasses RLS when reading profiles.
--      All 9 recursive policies rebuilt with identical semantics.
--
-- Audit: docs/RLS_RECURSION_AUDIT.md
-- db-guard reviewed: 2026-07-13

-- ─── Helper: is_admin() ───────────────────────────────────────────────────────
-- SECURITY DEFINER → runs as postgres (owner), RLS on profiles bypassed.
-- No recursion possible. Stable = safe to inline/cache within a query.
CREATE OR REPLACE FUNCTION public.is_admin()
  RETURNS boolean
  LANGUAGE sql STABLE
  SECURITY DEFINER
  SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin'
  )
$$;

-- Harden: remove default public execute; grant only to roles that need it.
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;

-- ─── profiles.profiles_admin_all (DIRECT self-recursive — root cause) ─────────
DROP POLICY IF EXISTS "profiles_admin_all" ON profiles;
CREATE POLICY "profiles_admin_all"
  ON profiles FOR ALL
  TO authenticated
  USING (is_admin());

-- ─── buyer_strikes.buyer_strikes_admin_read ───────────────────────────────────
DROP POLICY IF EXISTS "buyer_strikes_admin_read" ON buyer_strikes;
CREATE POLICY "buyer_strikes_admin_read"
  ON buyer_strikes FOR SELECT
  TO authenticated
  USING (is_admin());

-- ─── comments.comments_admin_select ──────────────────────────────────────────
DROP POLICY IF EXISTS "comments_admin_select" ON comments;
CREATE POLICY "comments_admin_select"
  ON comments FOR SELECT
  TO authenticated
  USING (is_admin());

-- ─── comments.comments_admin_update ──────────────────────────────────────────
DROP POLICY IF EXISTS "comments_admin_update" ON comments;
CREATE POLICY "comments_admin_update"
  ON comments FOR UPDATE
  TO authenticated
  USING (is_admin())
  WITH CHECK (is_admin());

-- ─── disputes.disputes_admin_read ────────────────────────────────────────────
DROP POLICY IF EXISTS "disputes_admin_read" ON disputes;
CREATE POLICY "disputes_admin_read"
  ON disputes FOR SELECT
  TO authenticated
  USING (is_admin());

-- ─── listing_flags.listing_flags_admin_select ─────────────────────────────────
DROP POLICY IF EXISTS "listing_flags_admin_select" ON listing_flags;
CREATE POLICY "listing_flags_admin_select"
  ON listing_flags FOR SELECT
  TO authenticated
  USING (is_admin());

-- ─── listings.listings_admin_all ─────────────────────────────────────────────
DROP POLICY IF EXISTS "listings_admin_all" ON listings;
CREATE POLICY "listings_admin_all"
  ON listings FOR ALL
  TO authenticated
  USING (is_admin());

-- ─── order_events.order_events_admin_read ────────────────────────────────────
DROP POLICY IF EXISTS "order_events_admin_read" ON order_events;
CREATE POLICY "order_events_admin_read"
  ON order_events FOR SELECT
  TO authenticated
  USING (is_admin());

-- ─── orders.orders_admin_read ────────────────────────────────────────────────
DROP POLICY IF EXISTS "orders_admin_read" ON orders;
CREATE POLICY "orders_admin_read"
  ON orders FOR SELECT
  TO authenticated
  USING (is_admin());
