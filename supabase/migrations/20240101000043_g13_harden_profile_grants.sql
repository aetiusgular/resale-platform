-- Migration: 20240101000043_g13_harden_profile_grants
-- G13 follow-up — close the self-service privilege escalation on `profiles`, and drop the
-- orphan enum that 0041 left behind.
--
-- db-guard: NOT YET REVIEWED. NOT YET PUSHED.
--
-- ════════════════════════════════════════════════════════════════════════════════════════
-- 1. PRIVILEGE ESCALATION (pre-existing since B1; G13 is what makes it reachable)
-- ════════════════════════════════════════════════════════════════════════════════════════
-- 20240101000001_profiles_b1.sql:25 grants INSERT on `role`, `id_verified` and
-- `id_verification_status` to `authenticated`. The only gate is:
--     profiles_owner_insert  WITH CHECK (auth.uid() = id)
-- which constrains WHO the row belongs to and never WHAT is in it. There is no BEFORE INSERT
-- trigger on profiles, and `role` accepts 'admin' (CHECK at 0000:12-13). The anon key is
-- NEXT_PUBLIC_, so with open signup any person on the internet can run:
--
--     const { data } = await s.auth.signUp({ email, password })
--     await s.from('profiles').insert({ id: data.user.id, username: 'x', role: 'admin' })
--
-- and is_admin() (0014:19-28) then returns true — opening every admin RLS policy, the
-- moderation console, ban/unban, platform metrics, and admin refund transitions.
--
-- The matching UPDATE grant (0001:28) lets any existing member self-issue the ID-verified
-- badge, which is the platform's trust signal on listing/seller pages and a permission input
-- in post_comment() (0011:238).
--
-- Safe to revoke: the only `authenticated`-role writes to profiles in the whole app are the
-- two inserts in app/onboarding/account/page.tsx (both `{ id, username }` only), the sizes
-- update in app/api/settings/sizes/route.ts:27, and the quick_setup update in
-- app/onboarding/setup/page.tsx:72. Every id_verification_status write already goes through
-- the service role (api/idv/start, webhooks/stripe). Founder/admin seeding uses service_role,
-- which bypasses RLS and column grants entirely.

REVOKE INSERT (role, id_verified, id_verification_status) ON profiles FROM authenticated;
REVOKE UPDATE (id_verified, id_verification_status)       ON profiles FROM authenticated;

-- Re-state the intended surface explicitly rather than relying on what survived the revoke.
GRANT INSERT (id, username, quick_setup, sizes) ON profiles TO authenticated;
GRANT UPDATE (username, quick_setup, sizes)     ON profiles TO authenticated;

-- Defence in depth. Column grants are easy to re-widen by accident — 0001 did exactly that
-- while "re-granting to cover the new columns". This policy makes the escalation impossible
-- even if the grants drift again. The app's inserts supply only (id, username), so the three
-- guarded columns take their defaults: 'member', false, 'unverified' (0000:12-14, 0001:11-12).
DROP POLICY IF EXISTS "profiles_owner_insert" ON profiles;
CREATE POLICY "profiles_owner_insert"
  ON profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = id
    AND role                   = 'member'
    AND id_verified            = false
    AND id_verification_status = 'unverified'
  );

-- ════════════════════════════════════════════════════════════════════════════════════════
-- 2. ORPHAN ENUM left by 0041
-- ════════════════════════════════════════════════════════════════════════════════════════
-- Dropping a table does NOT drop an enum type that table used, so invite_code_status
-- (created 0002:7) outlived invite_codes. Proof it is still live: lib/supabase/types.ts was
-- regenerated from the hosted schema after 0041 ran and still emits it at lines 1946/2108.
-- Nothing references it — no column, function, view, or index.
--
-- Deliberately NOT CASCADE: a plain DROP TYPE errors if any dependency remains, which is
-- the safety check we want. If this statement fails, something still uses the type and that
-- needs investigating rather than force-dropping.
DROP TYPE IF EXISTS public.invite_code_status;
