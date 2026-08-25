# G13 — Remove the invite/waitlist system entirely; open signup

**Founder decision (2026-08-24):** the platform launches open — zero promotion, handed
directly to trusted testers. No invite gate, no waitlist, no referral codes. This phase
**deletes** the invite system (code, DB, tests, docs), it does not merely leave it
flag-off. Google sign-in is enabled separately via config (`docs/GOOGLE_OAUTH_SETUP.md`)
and is NOT part of this phase — but this phase must not break the OAuth path.

Branch: `feat/remove-invites` (fresh off `main`). Migration: `20240101000041_g13_remove_invites.sql`.

---

## Why full removal

`INVITE_ONLY_ENABLED` is already off, but remnants still surface: `/enter` renders a
code-entry field (open-signup branch tolerates empty code), `/onboarding/codes` shows
"your 3 invite codes", the Google button and OAuth callback carry `?invite=` through,
admin metrics counts the invite tree + waitlist, and the DB holds `invite_codes`,
`waitlist`, `claim_invite_code()`, `generate_member_codes()`, `profiles.invited_by`.
All of it goes.

## Scope — grep-verified inventory

### Delete outright
| Path | What it is |
|---|---|
| `lib/invite-codes.ts` | code generate/normalize/validate lib |
| `tests/unit/invite-codes.test.ts` | 11 unit tests for the above |
| `app/onboarding/codes/page.tsx` + `codes-client.tsx` | "your invite codes" screen |
| `app/api/onboarding/generate-codes/route.ts` | member-code generation API |
| `app/enter/waitlist/page.tsx` | waitlist landing |
| `app/api/waitlist/route.ts` | waitlist signup API |

### Rewrite / edit
| Path | Change |
|---|---|
| `app/enter/page.tsx` | Today: invite-code entry + waitlist landing (imports `normalizeCode`, `isValidCodeFormat`, `INVITE_ONLY_ENABLED_PUBLIC`, stores `pending_invite_code` in sessionStorage). Becomes the plain auth landing: sign-in / create-account entry with no code field and no waitlist copy — or a straight redirect to `/enter/login` if that reads cleaner with the existing design. No sessionStorage use. |
| `app/enter/login/page.tsx` | Remove the "enter with an invite code" link (~line 86). |
| `app/enter/google-button.tsx` | Drop the `inviteCode` prop and the `invite` search param. Keep `next`. |
| `app/api/auth/callback/route.ts` | Drop `invite` param handling; new user (no profile) → `/onboarding/account` with no `?code=`. Keep the profile→`next` routing. |
| `app/onboarding/account/page.tsx` | Remove `normalizeCode` import, `INVITE_ONLY_ENABLED_PUBLIC` import, the `invitedBy` state + `resolveInviter()` (queries `invite_codes`), and any `claim_invite_code` RPC call on submit. Username-only onboarding. Keep `GOOGLE_AUTH_ENABLED` usage. |
| `middleware.ts` | Remove the `INVITE_ONLY_ENABLED` import and the invite gate (~lines 112–154): the "claimed invite code" check, `invited_by` in the profile select, and the bounce to `/enter`. Keep session, profile-exists, `banned`, and `role` handling intact. |
| `lib/flags.ts` | Delete `INVITE_ONLY_ENABLED` and `INVITE_ONLY_ENABLED_PUBLIC` (lines ~75–84) and their comment block. |
| `app/admin/metrics/page.tsx` | Remove the invite-tree count (`.not('invited_by','is',null)`) and the waitlist count card. |
| `scripts/seed-founders.ts` | Remove the `generateCode` import, the system-profile founder-code seeding (§3), and per-founder "3 invite codes each". Founders are still seeded id-verified. |
| `.env.example` | Remove `INVITE_ONLY_ENABLED` / `NEXT_PUBLIC_INVITE_ONLY_ENABLED` lines. |
| `docs/LAUNCH_SEQUENCE.md` | Wave B: delete the `INVITE_ONLY_ENABLED` row and the invite-decision copy; fix the one-line summary ("invite decision" → open signup). |
| Other docs | `grep -rn "INVITE_ONLY\|invite" docs/LAUNCH.md docs/HANDOFF.md` — update stale mentions where cheap; do NOT rewrite history files (SESSION_STATUS et al). |

### Tests (rewrite, don't skip)
| Path | Change |
|---|---|
| `tests/e2e/auth.spec.ts` | "/enter shows invite code input" → assert the NEW landing (no code field). |
| `tests/e2e/auth-live.spec.ts` | Delete the `@live RLS — invite codes isolation` describe (inserts into `invite_codes`, races `claim_invite_code`). Keep any non-invite tests in the file; delete the file if nothing remains. |
| `tests/e2e/signup-live.spec.ts` | Rewrite the signup flow without seeding a code: signup → username → in the app. |
| `tests/e2e/listings-live.spec.ts` | Remove `invited_by: userId` from the profile fixture (~line 40). |
| `tests/e2e/checkout.spec.ts` | Update the stale comment/assumptions about `/enter` being the invite/waitlist landing (~line 44). |

### Migration `20240101000041_g13_remove_invites.sql`
```sql
-- G13: remove invite/waitlist system (founder decision 2026-08-24, open signup)
DROP FUNCTION IF EXISTS claim_invite_code(TEXT, UUID);  -- 0002 signature
DROP FUNCTION IF EXISTS claim_invite_code(TEXT);        -- 0003 replacement
DROP FUNCTION IF EXISTS generate_member_codes(UUID, INT);
DROP TABLE IF EXISTS invite_codes;                      -- policies drop with it
DROP TABLE IF EXISTS waitlist;
ALTER TABLE profiles DROP COLUMN IF EXISTS invited_by;
```
**Cautions for db-guard:**
- `claim_invite_code` exists in two historical signatures (0002 `(TEXT, UUID)`, 0003
  `(TEXT)`) — drop both, verify with `\df claim_invite_code` equivalent.
- Migration `0016` exposed "anon public profile columns" and names `invited_by` as a
  *private* column — check whether 0016 created a **view or column-level grants** that
  enumerate columns; if a view lists `invited_by`, recreate it without the column in this
  migration, else the DROP COLUMN fails or breaks the view.
- `profiles.invited_by` has FK `profiles_invited_by_fkey` — DROP COLUMN removes it; no
  dependent app reads remain after this phase (verified: only admin metrics + types).

## Order — matters
1. Write the migration → **db-guard** on it → `pnpm exec supabase db push` (pgdelta cert
   warning is cosmetic).
2. Regen types (`unset SUPABASE_ACCESS_TOKEN && pnpm exec supabase login`; gen types;
   `wc -l lib/supabase/types.ts`). tsc will fail on every dead reference until the code
   edits land — that's the worklist.
3. Code deletions/rewrites per tables above. `git add` with **quoted** globby paths.
4. `pnpm verify` (expect: unit count drops by 11 to 392) + `pnpm build` green.
5. **code-reviewer** on the auth-surface diff: `middleware.ts`,
   `app/api/auth/callback/route.ts`, `app/enter/*`, `app/onboarding/account/page.tsx`,
   the migration.
6. e2e: `pnpm verify:ui` non-live specs; @live signup flow when stripe listen is up.
7. Merge to `main` after gates.

## Acceptance
- `grep -ri "invite\|waitlist" app lib middleware.ts scripts tests e2e` → **zero hits**.
- `lib/supabase/types.ts` contains no `invite_codes`, `waitlist`, or `invited_by`.
- New user, email path: create account → username → in the app. No code UI anywhere.
- New user, Google path (flag on): consent → `/onboarding/account` → in the app.
- Existing users: sign in unaffected; admin metrics renders without invite/waitlist cards.
- `pnpm verify` + `pnpm build` green; e2e auth/signup specs green.

## Explicitly out of scope
- Google OAuth **configuration** (Supabase provider + Google Cloud creds + flag) — human
  steps per `docs/GOOGLE_OAUTH_SETUP.md`, doable independently before or after G13.
- Any referral/growth mechanics — if referrals return someday, they'll be rebuilt
  deliberately; keep no dormant hooks.
