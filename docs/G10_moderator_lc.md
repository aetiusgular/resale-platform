# G10 — Moderator-gated Legit Check + community moderator roles

Phase spec, written to match the `docs/LAUNCH_ROADMAP.md` house style. Build it the
same way as every other phase: **one verified phase, on a branch, through the gates**.

- **Branch:** `feat/moderator-lc`
- **Migration:** `supabase/migrations/20240101000036_moderator_lc.sql`
- **Gates (mandatory):** `db-guard` (migration), `code-reviewer` (auth/RPC/RLS),
  `ui-verifier` (LC section on the listing page + profile badge).
- **Verify:** `pnpm verify` (tsc + eslint + vitest) green before commit; `pnpm build`
  green before merge. Runs **natively on the Mac** — the cloud bridge can't run the
  toolchain.

---

## 1. Locked product decisions (from founder, 2026-08-12)

1. **General comments are fully removed** — not hidden, removed. The `general` thread,
   its RPC path, the seller comments-toggle, and `listings.comments_enabled` all go.
   Existing `general` rows are deleted (platform is pre-launch; no real data lost).
2. **Legit Check is moderators-only.** Only `is_moderator` (and `admin`, and the future
   auto-auth bot) may post in LC. Gold-tier and legacy `verified_checker` **lose** LC
   posting. LC remains **publicly readable**.
3. **Promotion is automatic at 3.** When **3 distinct current moderators** have each
   recommended a member, that member is promoted to moderator immediately. Admins can
   also appoint/revoke directly, and seed the first moderators (bootstrap).
4. **Forward hook for the auto-authentication system.** Schema + a service-role entry
   point exist now so the future bot can post LC verdicts as a system author. The bot
   itself is **not** built in this phase.

> **No runtime feature flag.** This is a deliberate *replacement* of an existing
> feature, not an experiment, and the LC gate is enforced in the DB (an env flag can't
> gate a SQL `RAISE EXCEPTION`). The **branch + gates** are the safety mechanism, and the
> migration is the atomic switch. **Seed moderators in the same deploy** (see §7) so LC
> isn't left with zero eligible posters. If you later want a staged rollout instead, the
> only clean lever is deploying the migration to a preview/staging project first.

---

## 2. Data model (migration `0036`)

### 2.1 `profiles` — the moderator flag
```sql
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS is_moderator    BOOLEAN     NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS moderator_since TIMESTAMPTZ;

-- Partial index for the frequent "is this author a mod / list mods" lookups
CREATE INDEX IF NOT EXISTS profiles_is_moderator_idx ON profiles (id)
  WHERE is_moderator = true;
```
**Grant discipline:** do **not** grant `UPDATE (is_moderator, moderator_since)` to
`authenticated`. Same rule as `verified_checker`/`tier` — set only via `service_role`
(admin route) or via the `SECURITY DEFINER` promotion RPC. This is the self-promotion
escalation guard `code-reviewer` will look for.

`verified_checker` / `checker_category` / `tier` columns stay (dropping is destructive)
but are **no longer used for LC gating**. Treat `verified_checker` as deprecated; the
migration should migrate trusted checkers into moderators (see §7 bootstrap).

### 2.2 `moderator_recommendations` — the nomination ledger
```sql
CREATE TABLE moderator_recommendations (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- CASCADE: if the nominee's account is deleted, drop their pending recs
  nominee_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- CASCADE: if a recommender's account is deleted, drop their recs
  recommender_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- one recommendation per moderator per nominee (dedup)
  UNIQUE (nominee_id, recommender_id),
  -- a moderator cannot recommend themselves
  CHECK (nominee_id <> recommender_id)
);

CREATE INDEX moderator_recs_nominee_idx     ON moderator_recommendations (nominee_id);
CREATE INDEX moderator_recs_recommender_idx ON moderator_recommendations (recommender_id);
```
Rows are **kept** after promotion (audit trail of who vouched for whom). The count that
matters is "distinct recommenders who are *still* valid moderators" — computed live, so
a revoked mod's vouch stops counting automatically.

### 2.3 `comments` — source column + nullable author for the bot
```sql
CREATE TYPE comment_source AS ENUM ('human', 'auto');

ALTER TABLE comments
  ADD COLUMN IF NOT EXISTS source comment_source NOT NULL DEFAULT 'human';

-- Allow a system-authored LC verdict to have no human author.
ALTER TABLE comments ALTER COLUMN author_id DROP NOT NULL;

-- Integrity: human comments must have an author; auto comments must not.
ALTER TABLE comments ADD CONSTRAINT comments_author_source_ck CHECK (
  (source = 'human' AND author_id IS NOT NULL) OR
  (source = 'auto'  AND author_id IS NULL)
);
```
(Optional, future-facing, cheap to add now: `verdict TEXT CHECK (verdict IN
('authentic','counterfeit','uncertain'))` nullable — the auto system will populate it.)

### 2.4 Remove general comments
```sql
-- 1. delete general-thread data (comment_actions cascade off comments FK)
DELETE FROM comments WHERE thread_type = 'general';
-- 2. drop the seller toggle RPC + column
DROP FUNCTION IF EXISTS toggle_listing_comments(UUID, BOOLEAN);
ALTER TABLE listings DROP COLUMN IF EXISTS comments_enabled;
```
Leave the `thread_type` enum in place (Postgres can't cleanly drop an enum value; all
rows are `'lc'` now). Document in a comment that `'general'` is dead.

---

## 3. RPCs (all `SECURITY DEFINER`, `SET search_path = public`)

### 3.1 Rewrite `post_comment()` — LC gate = moderator/admin
Keep the signature stable. Changes vs. today:
- Reject `p_thread_type <> 'lc'` with `general_comments_removed`.
- LC gate becomes: `is_moderator OR role = 'admin'` (drop `verified_checker`/`tier='gold'`).
- Drop the `comments_disabled` branch (column is gone).
- Drop the new-account **rate-limit** branch for LC (posters are vetted moderators;
  keep the ban check). Set `source = 'human'`, `author_id = auth.uid()`.

```sql
-- ── LC permission: moderators (or admins) only ──
IF p_thread_type <> 'lc' THEN
  RAISE EXCEPTION 'general_comments_removed' USING ERRCODE = 'P0001';
END IF;
IF NOT (v_profile.is_moderator OR v_profile.role = 'admin') THEN
  RAISE EXCEPTION 'lc_permission_denied' USING ERRCODE = 'P0001';
END IF;
```
Keep: auth check, profile load, ID-verification check (mods must be verified anyway),
active-listing check, one-level parent validation. The route already maps
`lc_permission_denied`; add a map for `general_comments_removed` (→ 410/403).

### 3.2 `recommend_moderator(p_nominee_id UUID)` → new
Returns a small composite the route can pass back, e.g. `TABLE(distinct_count INT,
promoted BOOLEAN)`.

Logic:
```
caller := auth.uid();  require not null
require caller.is_moderator OR caller.role='admin'      -- only mods recommend
require caller not banned
load nominee;  require exists
require nominee_id <> caller                            -- no self-rec (also CHECK)
require nominee.id_verification_status = 'verified'     -- only verified members
require nominee not banned
if nominee.is_moderator then return (…, promoted=false) -- already a mod, no-op
INSERT ... ON CONFLICT (nominee_id, recommender_id) DO NOTHING   -- idempotent

-- count DISTINCT recommenders who are STILL valid moderators
SELECT count(*) INTO distinct_count
FROM moderator_recommendations r
JOIN profiles p ON p.id = r.recommender_id
WHERE r.nominee_id = p_nominee_id
  AND p.is_moderator = true
  AND p.banned_at IS NULL           -- confirm the banned column name in 0025/0029
;

if distinct_count >= 3 then
  UPDATE profiles SET is_moderator = true, moderator_since = now()
    WHERE id = p_nominee_id AND is_moderator = false;
  promoted := true;
  -- notify nominee (see §5)
end if;
return (distinct_count, promoted);
```
`GRANT EXECUTE ... TO authenticated` (the route runs as the signed-in moderator; the
`is_moderator` check inside is the gate). Threshold `3` is a documented literal — put
`-- MODERATOR_PROMOTION_THRESHOLD = 3` above it.

### 3.3 `post_auto_lc(p_listing_id UUID, p_body TEXT, p_pinned BOOLEAN DEFAULT true, p_verdict TEXT DEFAULT NULL)` → new, **forward hook**
`SECURITY DEFINER`, **`GRANT EXECUTE ... TO service_role` only** (never `authenticated`).
Inserts `source='auto'`, `author_id=NULL`, `thread_type='lc'`, `pinned=p_pinned`. This is
the single entry point the future auto-authentication service calls (server-side, service
key). No client path. Mark clearly: *bot not built this phase — this is the seam.*

---

## 4. RLS + grants (new objects)

`moderator_recommendations`: `ENABLE ROW LEVEL SECURITY`.
- **SELECT:** admins read all; a moderator reads rows they authored (`recommender_id =
  auth.uid()`); a nominee reads rows about themselves (`nominee_id = auth.uid()`).
- **No client INSERT/UPDATE/DELETE policy** — writes go only through
  `recommend_moderator()` (SECURITY DEFINER). Grant `SELECT` to `authenticated` (scoped by
  the policies above); do **not** grant INSERT/UPDATE/DELETE.
- The `/sellers/[username]` page computes the public "x / 3" count with the **service
  client** (already used on that page), so it doesn't depend on the SELECT policy.

`comments` policies are unchanged (public read visible; admin update; RPC-only insert) —
they already cover `source='auto'` rows.

---

## 5. Notifications (reuse `lib/notify`)
On auto-promotion, dispatch to the nominee: category **`alerts`**, a new event
`moderator_granted` ("You're now a moderator — you can post Legit Checks."). Add the
template in `lib/notify/templates`. Guard on `NOTIFICATIONS_ENABLED` like every other
dispatch (no-op when off). Optional: notify each recommender that their nominee was
promoted — nice-to-have, skip if it complicates the gate review.

---

## 6. API routes

| Route | Method | Auth | Does |
|---|---|---|---|
| `app/api/moderators/recommend/route.ts` **(new)** | POST `{ nomineeId }` | signed-in **moderator** | validate uuid → `recommend_moderator` RPC → `{ distinctCount, promoted }`; map `not_a_moderator`→403, `nominee_not_verified`→403, `nominee_not_found`→404, `banned`→403 |
| `app/api/admin/profiles/[profileId]/moderator/route.ts` **(new)** | POST `{ is_moderator: boolean }` | **admin** | mirror the existing `…/checker/route.ts` exactly: verify caller `role='admin'`, `service_role` update `is_moderator` + `moderator_since` (set `now()` when granting, keep/clear on revoke). Bootstrap + revoke live here. |
| `app/api/listings/[id]/comments/route.ts` **(edit)** | — | — | drop all `general` handling; keep LC; add error map for `general_comments_removed`; GET selects `is_moderator, source` on the author join |
| `app/api/listings/[id]/comments-toggle/route.ts` **(delete)** | — | — | seller toggle is gone |

---

## 7. UI changes

### 7.1 `app/listings/[id]/community-section.tsx`
- **Drop** the tab bar's second tab, all `general`/`commentsEnabled`/`canComment` state
  and fetches, the "SELLER HAS COMMENTS ON" indicator, and the whole `SellerToggle`
  component. The section is now a single "Legit Check (N)" panel (keep the heading "The
  community weighs in.").
- **Gate the input** on `canPostLc` (moderator/admin). Non-eligible viewers see the
  disabled input with new copy: **"Legit checks are posted by verified moderators."**
  (replace the "ID-verified members only · new accounts limited to 2/day" line — that
  rule is retired for LC).
- **Badges on rows:** render a `MODERATOR` microtag when `profiles.is_moderator`; render
  an `AUTOMATED AUTHENTICATION` tag when `source === 'auto'` (author is null → show the
  system label instead of `@username`). Keep the existing pinned "CHECKED" verdict card;
  auto verdicts flow through it.
- Update the `CommentRow` / `CommunitySection` prop types: remove `commentsEnabled`,
  `canComment`, `isSeller`; add `is_moderator`, `source` to `CommentRow`.

### 7.2 `app/listings/[id]/page.tsx`
- Select `is_moderator` alongside role/tier in the viewer profile fetch.
- `canPostLc = userProfile?.is_moderator === true || userProfile?.role === 'admin'`.
- Remove `commentsEnabled` / `canComment` / `isSeller` props passed to `CommunitySection`.

### 7.3 `app/sellers/[username]/page.tsx` (+ new `recommend-moderator-button.tsx`)
- Show a **MODERATOR** badge in the profile header when `seller.is_moderator` (the page
  already fetches profile columns via the service client — add `is_moderator`).
- When the **viewer is a moderator/admin** and the profile is a non-moderator,
  ID-verified member, render a client `RecommendModeratorButton` (mirror the existing
  `FollowButton` pattern) showing **"Recommend as moderator (x / 3)"**. It POSTs to
  `/api/moderators/recommend`; disable + relabel to "Recommended ✓" if the viewer already
  vouched; on the response's `promoted`, flip to a "Now a moderator" state. Compute the
  current `x` and `viewerHasRecommended` server-side with the service client.

### 7.4 Admin surface (light)
Add moderator grant/revoke to the existing admin profiles area (the
`app/api/admin/profiles/[profileId]/moderator` route is the backend). A minimal admin
control (button in the admin profile view) is enough for bootstrap; full admin UX can be
a follow-up.

### 7.5 Bootstrap seed (run with the deploy)
So LC isn't empty of posters on cutover, promote today's trusted checkers in the same
migration:
```sql
UPDATE profiles SET is_moderator = true, moderator_since = now()
WHERE verified_checker = true AND is_moderator = false;
```
(Admins can post regardless.) Founder then appoints any additional initial moderators via
the admin route. Document this as an intentional, one-time data migration for db-guard.

---

## 8. Edge cases & security (code-reviewer checklist)
- **No self-promotion:** `is_moderator` writable only via `service_role` / the definer
  RPC. No `authenticated` UPDATE grant on that column. ← primary escalation guard.
- **Revoked-mod vouches don't count:** the promotion count joins on live
  `is_moderator = true AND not banned`; revoking a mod silently drops their weight.
- **No self-recommend:** enforced by both the table `CHECK` and the RPC.
- **Idempotent recommend:** `ON CONFLICT DO NOTHING`; the count is DISTINCT — spamming the
  button can't inflate past one vouch per moderator.
- **Only verified members promotable:** nominee must be `id_verification_status='verified'`
  and not banned.
- **Banned moderators can't recommend:** caller ban check in the RPC.
- **Auto-author integrity:** `CHECK` ties `source='auto'` ↔ `author_id IS NULL`; the auto
  RPC is `service_role`-only.
- **Confirm the ban column name** used in the join (`banned_at` vs a status) against
  migrations `0025_profiles_ban` / `0029_phone` before writing the SQL.

## 9. Tests (vitest + Playwright)
Unit (pure/route-level, mock supabase like the existing suites):
- LC gate: moderator ✓, admin ✓, gold ✗, verified_checker ✗, plain member ✗.
- `recommend_moderator`: 1st/2nd vouch → not promoted; 3rd distinct valid mod → promoted;
  duplicate vouch no-ops; self-rec rejected; non-mod caller 403; unverified nominee 403;
  a vouch from a since-revoked mod does **not** count toward 3.
- General path gone: POST `thread_type:'general'` → error; `comments-toggle` route removed.
- Auto hook: `post_auto_lc` inserts `source='auto'`, null author, visible in GET.
Remove/replace existing tests that assert general comments or the seller toggle.
E2E: LC-only section renders; non-mod sees disabled input + copy; MODERATOR badge shows.

## 10. Acceptance criteria
- General comments are gone end-to-end (no tab, no toggle, no route, no column); listing
  page renders an LC-only community section, still publicly readable.
- A moderator/admin can post LC; a gold-tier or verified_checker or plain member cannot.
- Three distinct current moderators recommending one verified member auto-promotes them;
  they can immediately post LC and receive the `moderator_granted` notice (if notifications
  on). Admin can appoint/revoke directly.
- `post_auto_lc` exists as a `service_role`-only seam (bot deferred).
- `pnpm verify` + `pnpm build` green; db-guard, code-reviewer, ui-verifier all pass.

## 11. Files touched
```
supabase/migrations/20240101000036_moderator_lc.sql            (new)
app/api/moderators/recommend/route.ts                          (new)
app/api/admin/profiles/[profileId]/moderator/route.ts          (new)
app/sellers/[username]/recommend-moderator-button.tsx          (new)
app/listings/[id]/community-section.tsx                        (rewrite: LC-only)
app/listings/[id]/page.tsx                                     (canPostLc = moderator)
app/api/listings/[id]/comments/route.ts                        (drop general)
app/sellers/[username]/page.tsx                                (badge + recommend button)
app/api/listings/[id]/comments-toggle/route.ts                 (delete)
lib/notify/templates(/…)                                       (moderator_granted)
lib/supabase/types.ts                                          (regen — see note)
tests/unit/*, tests/e2e/*                                      (add + prune general)
docs/LAUNCH_ROADMAP.md, docs/HANDOFF.md, docs/SESSION_STATUS.md (record G10)
```

## 12. Operational notes (from prior sessions)
- **Regen types:** `unset SUPABASE_ACCESS_TOKEN && npx supabase login`, then
  `supabase gen types` — and `wc -l lib/supabase/types.ts` after (a failed regen truncates
  it to 0 bytes because `>` runs first).
- `db push` "failed to cache migrations catalog" is cosmetic (needs Docker running for the
  post-push cache only; the migration still lands).
- If git leaves a stale `.git/index.lock`, `rm -f .git/index.lock`.
- Run `db-guard` **before** pushing `0036`; `code-reviewer` on the RPC + both new routes +
  the `post_comment` gate change; `ui-verifier` on the LC section and the profile badge.
