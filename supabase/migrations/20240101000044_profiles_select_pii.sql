-- Migration: 20240101000044_profiles_select_pii
-- Security — pre-launch audit 2026-08-25, Finding 1 (HIGH).
--
-- The `authenticated` role held a table-wide `GRANT SELECT ON profiles` (migration
-- 0000, never narrowed) and the row policy `profiles_public_read_username` is
-- USING(true). Combined, any logged-in user could read EVERY profile's PII straight
-- off the PostgREST data API: phone, shipping_address, ship_from_address (home/return
-- addresses), stripe_connect_account_id, and other identifiers. The `anon` role was
-- already column-scoped to (id, username) in migration 0012; this applies the same
-- treatment to `authenticated`.
--
-- Postgres rule: a column-level GRANT does NOT narrow a standing table-level GRANT, so
-- the table-level SELECT must be revoked first, then re-granted on the non-sensitive
-- columns only. The excluded columns are read for the OWNER via the service role in app
-- code (settings page, checkout, stripe webhook, /banned, admin) — never cross-user.
--
-- Excluded (service-role only): phone, phone_verified_at, shipping_address,
--   ship_from_address, stripe_connect_account_id, persona_inquiry_id, banned_reason.
--
-- The row policy is intentionally left as-is: public profile fields (username, badges,
-- tier) are meant to be readable; this migration makes the COLUMN grant enforce that,
-- which is what the policy's own comment always intended.
-- db-guard: run before applying.

REVOKE SELECT ON profiles FROM authenticated;

GRANT SELECT (
  id, username, role,
  id_verified, id_verified_at, id_verification_status,
  tier, verified_checker, checker_category, is_moderator, moderator_since,
  lifetime_sales_count, upheld_complaints,
  current_buyer_tier_bps, current_seller_tier_bps,
  buyer_tier_locked_until, seller_tier_locked_until,
  elite_program_eligible, elite_program_notified_at,
  payouts_enabled, quick_setup, sizes,
  banned, banned_at,
  created_at
) ON profiles TO authenticated;
