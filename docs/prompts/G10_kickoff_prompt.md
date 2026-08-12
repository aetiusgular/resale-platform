# G10 kickoff prompt — Moderator-gated Legit Check

> Run this in an **on-computer** Claude Code session inside `~/Projects/resale-platform`
> (needs the native toolchain + the repo's `.claude/agents` gates). Paste everything below
> the line as the prompt. Keep the full spec `docs/G10_moderator_lc.md` open alongside it.

---

On branch `feat/moderator-lc`, build **phase G10 — Moderator-gated Legit Check +
community moderator roles**, per `docs/G10_moderator_lc.md`. Read that spec and
`CLAUDE.md` first; follow the repo's phase discipline (one verified phase, gated, native
`pnpm verify`).

Scope, exactly:

1. **Remove general comments entirely.** Delete the `general` thread path, the seller
   comments-toggle (`app/api/listings/[id]/comments-toggle/route.ts` and the
   `SellerToggle` UI), and `listings.comments_enabled`. Delete existing `general` rows in
   the migration. Leave the `thread_type` enum (document `'general'` as dead).

2. **Make Legit Check moderators-only.** Add `profiles.is_moderator BOOLEAN NOT NULL
   DEFAULT false` + `moderator_since` (service-role/RPC writes only — **no `authenticated`
   UPDATE grant**). Rewrite `post_comment()` so the LC gate is `is_moderator OR
   role='admin'` (drop `verified_checker`/`tier='gold'` and the new-account rate limit for
   LC). Update `app/listings/[id]/page.tsx` (`canPostLc`) and rewrite
   `community-section.tsx` to a single LC panel with the disabled-input copy "Legit checks
   are posted by verified moderators" and a `MODERATOR` badge on mod authors.

3. **Auto-promote at 3 recommendations.** Add `moderator_recommendations` (RLS, indexes,
   `UNIQUE(nominee_id,recommender_id)`, `CHECK(nominee_id<>recommender_id)`) and a
   `SECURITY DEFINER` `recommend_moderator(nominee)` RPC: only a current moderator/admin
   may recommend; nominee must be ID-verified + not banned; promote when **3 distinct
   recommenders who are still valid (non-banned) moderators** exist. Add
   `POST /api/moderators/recommend` and an admin appoint/revoke route
   `POST /api/admin/profiles/[profileId]/moderator` (mirror the existing `…/checker`
   route). Add a "Recommend as moderator (x / 3)" button + MODERATOR badge on
   `app/sellers/[username]/page.tsx` (mirror `FollowButton`). On promotion, dispatch a
   `moderator_granted` notification (category `alerts`, guarded by `NOTIFICATIONS_ENABLED`).

4. **Forward hook for the auto-authentication bot (schema only).** Add
   `comments.source comment_source ('human'|'auto')`, make `author_id` nullable with a
   `CHECK` tying `source='auto'` ↔ `author_id IS NULL`, and add a `service_role`-only
   `post_auto_lc(listing_id, body, pinned, verdict)` RPC. Do **not** build the bot.

5. **Bootstrap:** in the migration, `UPDATE profiles SET is_moderator=true,
   moderator_since=now() WHERE verified_checker=true` so LC has eligible posters at
   cutover. No runtime feature flag — the migration is the switch; the branch + gates are
   the safety.

Before writing SQL, confirm the **ban column name** (`0025_profiles_ban` / `0029_phone`)
and reuse it in the promotion count join.

Gates & verify (do not skip):
- `db-guard` on `supabase/migrations/20240101000036_moderator_lc.sql` **before** pushing.
- `code-reviewer` on `post_comment` gate change, `recommend_moderator`, `post_auto_lc`,
  and both new routes (auth/escalation surface).
- `ui-verifier` on the listing LC section and the profile MODERATOR badge.
- `pnpm verify` green before each commit; `pnpm build` green before merge. Regen
  `lib/supabase/types.ts` (`unset SUPABASE_ACCESS_TOKEN && npx supabase login` first; then
  `wc -l` the output).
- Add the tests in §9 and prune the general-comment/seller-toggle tests.

When green: update `docs/HANDOFF.md`, mark G10 in `docs/LAUNCH_ROADMAP.md`, and note the
general-comments removal in `docs/SESSION_STATUS.md`. Commit per logical step (migration,
RPC+routes, UI, tests) — never one blind megachange.
