# G13 kickoff prompt — Remove invites/waitlist, open signup

> Run this in an **on-computer** Claude Code session inside `~/Projects/resale-platform`
> (needs the native toolchain + the repo's `.claude/agents` gates). Paste everything below
> the line as the prompt. Keep the full spec `docs/G13_remove_invites.md` open alongside it.

---

On a fresh branch `feat/remove-invites` off `main`, build **phase G13 — remove the
invite/waitlist system entirely**, per `docs/G13_remove_invites.md`. Read that spec and
`CLAUDE.md` first; follow the repo's phase discipline (one verified phase, gated, native
`pnpm verify`). Founder decision: the platform launches OPEN — no invite gate, no
waitlist, no referral codes, nothing left dormant. Delete, don't hide.

Scope, exactly (the spec has the full grep-verified inventory — follow its tables):

1. **Migration first** — `supabase/migrations/20240101000041_g13_remove_invites.sql`:
   drop `claim_invite_code` (BOTH signatures: `(TEXT, UUID)` and `(TEXT)`),
   `generate_member_codes(UUID, INT)`, tables `invite_codes` and `waitlist`, and
   `profiles.invited_by`. Before writing DROP COLUMN, check migration `0016` for any
   view/column-grant that enumerates `invited_by` and handle it. Run **db-guard** on the
   migration, then `pnpm exec supabase db push`, then regen types.

2. **Delete**: `lib/invite-codes.ts`, `tests/unit/invite-codes.test.ts`,
   `app/onboarding/codes/` (both files), `app/api/onboarding/generate-codes/`,
   `app/enter/waitlist/`, `app/api/waitlist/`.

3. **Rewrite**: `app/enter/page.tsx` → plain auth landing (no code field, no waitlist, no
   `pending_invite_code` sessionStorage); `app/enter/login/page.tsx` → drop the invite
   link; `app/enter/google-button.tsx` → drop `inviteCode`/`invite` param;
   `app/api/auth/callback/route.ts` → drop `invite` handling (new user →
   `/onboarding/account`, keep `next` routing); `app/onboarding/account/page.tsx` →
   username-only (no code resolution, no `claim_invite_code` call); `middleware.ts` →
   remove the invite gate + `INVITE_ONLY_ENABLED` import, KEEP session/profile/banned/role
   logic; `lib/flags.ts` → delete both INVITE_ONLY flags; `app/admin/metrics/page.tsx` →
   remove invite-tree + waitlist counts; `scripts/seed-founders.ts` → founders seeded
   id-verified, no codes; `.env.example` + `docs/LAUNCH_SEQUENCE.md` Wave B → remove
   INVITE_ONLY entries.

4. **Tests**: rewrite `tests/e2e/auth.spec.ts` (/enter assertion), delete the invite-RLS
   describe in `tests/e2e/auth-live.spec.ts`, rewrite `tests/e2e/signup-live.spec.ts`
   (signup without codes), fix the `invited_by` fixture in `listings-live.spec.ts` and
   stale comments in `checkout.spec.ts`.

Gates, in order: db-guard (migration) → push → regen types → `pnpm verify` (expect 392
unit tests) + `pnpm build` → **code-reviewer** on the auth-surface diff (middleware,
callback, /enter, onboarding/account, migration) → e2e. Acceptance:
`grep -ri "invite|waitlist" app lib middleware.ts scripts tests e2e` returns zero hits,
and both signup paths (email; Google with `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true`) land a
new user on `/onboarding/account` → the app with no code UI anywhere.

Do NOT configure Google OAuth in this phase (human steps, `docs/GOOGLE_OAUTH_SETUP.md`) —
but do not break the OAuth path either. Commit per repo convention; quote globby paths in
`git add`; stop before merging and report the diff summary + gate results.
