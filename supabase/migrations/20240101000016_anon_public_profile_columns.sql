-- FIX: anon SELECT on profiles was narrowed to 2 columns (B7 privilege fix
-- collateral), which 404s every logged-out listing/seller page: the SSR
-- queries join profiles(username, role, id_verification_status) and
-- column-level permission denial nulls the whole row. SEO-critical.
--
-- Grant anon ONLY the public-display columns. Explicitly NOT granted:
-- sizes, quick_setup, shipping_address, stripe_connect_account_id,
-- payouts_enabled, invited_by (private).
-- RLS still applies on top (public read policy).

GRANT SELECT (id, username, role, id_verification_status, id_verified,
              verified_checker, checker_category, tier, created_at)
  ON public.profiles TO anon;
