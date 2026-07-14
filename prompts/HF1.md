# HF1 — HOTFIX: recursive RLS policies (infinite recursion on profiles)

CONFIRMED BUG (found in manual testing, blocks ALL signups):
"infinite recursion detected in policy for relation profiles". Root cause:
profiles_admin_all (migration 000000) does EXISTS(SELECT FROM profiles) ON
profiles ITSELF, and ~8 migrations repeat the EXISTS-on-profiles admin-check
pattern on other tables — any policy subquery against profiles re-enters
profiles RLS and loops. This also silently broke middleware profile reads
(users bounced to onboarding) and possibly other paths.

READ FIRST: CLAUDE.md, docs/HANDOFF.md. RUN CONTEXT: .env.local exists (never
print/commit); supabase CLI via SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD
parsed inline; push with pnpm exec supabase db push --yes; ANTI-HANG rules
as always; commit locally, no GitHub push.

TASKS:
1. ENUMERATE from the LIVE database (source of truth, not grep):
   query pg_policies for every policy whose qual or with_check references
   profiles; list table, policyname, cmd, roles, definition. Save the survey
   to docs/RLS_RECURSION_AUDIT.md.
2. FIX in one migration (20240101000014_fix_recursive_rls.sql):
   a. CREATE FUNCTION public.is_admin() RETURNS boolean LANGUAGE sql STABLE
      SECURITY DEFINER SET search_path = public AS
      $$ SELECT EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND
      role = 'admin') $$;  REVOKE from PUBLIC, GRANT EXECUTE to authenticated,
      anon, service_role. (SECURITY DEFINER = owner bypasses RLS = no loop.)
      If any policies also subquery profiles for verified_checker or tier,
      add equivalent helper functions (is_verified_checker(), member_tier()).
   b. DROP + recreate EVERY policy found in step 1 with identical semantics,
      substituting the helper function for the EXISTS subquery. Do not widen
      or narrow any policy's effect.
   c. db-guard subagent MUST review the migration before push.
3. CLEANUP: after push, delete any auth user with email aetiusgular@gmail.com
   that has no profiles row (orphan from failed attempts) via admin API.
4. REGRESSION-PROOF: add tests/e2e/signup-live.spec.ts (@live): drives the
   REAL UI — /enter with a fresh unused code → signup form with a random
   test email (test+<ts>@example.com) → asserts landing on the codes screen
   with 3 codes → cleans up the created user via admin API in teardown.
   Also a direct-client @live spec: anon client signUp → session → profiles
   insert → claim_invite_code RPC → middleware-style select returns row
   with invited_by set.
5. SANITY: run the direct-client flow once as a script and show its output;
   run pnpm verify + verify:ui incl @live; code-reviewer pass over the
   migration + any touched code.

FINISH: update docs/HANDOFF.md (HF1 entry: cause, fix, audit doc link);
conventional commit; print summary ending "HF1 COMPLETE — GATE GREEN" or
"HF1 BLOCKED: <reason>", plus 3 currently-unused invite codes on the final line.
