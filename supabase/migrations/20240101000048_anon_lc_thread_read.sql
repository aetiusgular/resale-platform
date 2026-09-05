-- Migration: 20240101000048_anon_lc_thread_read
-- Guest browsing: the legit-check thread never loads for signed-out visitors (go-live audit
-- 2026-09-05, P1-5).
--
-- GET /api/listings/[id]/comments runs with the caller's role (anon for guests) and embeds
--   profiles:author_id (username, tier, verified_checker, role, is_moderator, checker_category)
--   comment_actions (id, action)
-- `anon` has column-level SELECT on profiles (0012 → 0016 → 0045) that does NOT include
-- `is_moderator` (added in 0036, granted to `authenticated` only in 0044), and has NO grant on
-- comment_actions at all (0011 grants `authenticated` only). PostgREST rejects the whole embed
-- with 42501, the route returns non-OK, and community-section.tsx stays on "LOADING…" for
-- every guest on every public listing page (guest browsing has been live since fe47ce1).
--
-- Fix = the minimum the embed needs, nothing more:
--   1. profiles.is_moderator readable by anon. It already renders publicly as the MODERATOR
--      badge on /sellers/[username]; no PII.
--   2. comment_actions: column-level SELECT for anon on (id, comment_id, action, created_at)
--      plus a read policy. `actor_id` is deliberately NOT granted: guests get the aggregate
--      AGREE / FLAG counts, never who cast them. `comment_id` is required for the embed join.
--      RLS stays enabled; the new policy mirrors `comment_actions_auth_read` (USING true) for
--      the anon role. No INSERT/UPDATE/DELETE for anon anywhere.
-- Column-level GRANT on a table with RLS: the policy decides rows, the grant decides columns,
-- so a guest selecting actor_id still fails (42501) while the embed above succeeds.
-- db-guard: run before applying.

-- ─── 1. profiles.is_moderator → anon ───────────────────────────────────────────
GRANT SELECT (is_moderator) ON public.profiles TO anon;

-- ─── 2. comment_actions → anon (aggregate counts only) ────────────────────────
DROP POLICY IF EXISTS "comment_actions_anon_read" ON comment_actions;
CREATE POLICY "comment_actions_anon_read"
  ON comment_actions FOR SELECT
  TO anon
  USING (true);

GRANT SELECT (id, comment_id, action, created_at) ON comment_actions TO anon;
