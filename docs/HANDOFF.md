# HANDOFF.md
## Current state: B1 COMPLETE

**Last updated:** 2026-07-12
**Next prompt:** B2 — Listings + curation queue

---

## What was done in B1

1. **Supabase email auth** — `@supabase/ssr` signup/login/logout. Middleware uses `getUser()` exclusively (never `getSession()`). Logout via `POST /api/auth/logout`.

2. **Migrations** — Three migrations applied to remote:
   - `20240101000000_profiles.sql` — profiles table + RLS (B0, already applied)
   - `20240101000001_profiles_b1.sql` — adds `id_verification_status` enum, `invited_by` FK, `quick_setup` JSONB
   - `20240101000002_invite_codes.sql` — invite_codes table, RLS, `claim_invite_code` RPC (FOR UPDATE), `generate_member_codes` RPC (pgcrypto)
   - `20240101000003_fix_rpc_security.sql` — security fixup: `claim_invite_code` now uses `auth.uid()` (no `p_user_id` param); `generate_member_codes` locks profile row (FOR UPDATE) to serialize concurrent calls

3. **Middleware gate** — `/enter` for unauthenticated; `/enter` for authenticated users with no claimed code; onboarding bypass; admin bypass.

4. **Onboarding flow** — `/enter` (code input, Space Mono, error states) → `/onboarding/account` (email/username/password) → `/onboarding/verify` (ID verification placeholder, `VERIFICATION_ENABLED=false`) → `/onboarding/setup` (sizes/address, skippable) → `/onboarding/codes` (3 generated codes with COPY, Space Mono).

5. **Waitlist** — `/enter/waitlist` with email capture; `POST /api/waitlist` stubs (TODO B8: persist to DB).

6. **`lib/invite-codes.ts`** — `generateCode()`, `normalizeCode()`, `isValidCodeFormat()` (unambiguous alphabet, no 0/O/1/I).

7. **`lib/flags.ts`** — `VERIFICATION_ENABLED` feature flag (false).

8. **`scripts/seed-founders.ts`** — 30 founder codes owned by a system profile; idempotent.

9. **Tests** — 12 unit tests (vitest), 11 Playwright e2e tests (non-@live). `@live` specs in `tests/e2e/auth-live.spec.ts` (RLS/double-claim tests — run locally with `RUN_LIVE_TESTS=1`).

10. **Code reviewer** — Full pass on auth/RLS/RPC. Two HIGHs found and fixed (see migration 000003). One HIGH acknowledged (profile insert before email verification — deferred: email verification is the verify step in flow; enforcing at DB level is B8 hardening).

---

## Blockers

None. All migrations applied. All checks green.

---

## Verify state (as of B1 close)

```
pnpm verify      ✓  12 tests (tsc + eslint + vitest)
pnpm build       ✓  14 routes, 0 warnings
pnpm verify:ui   ✓  11 Playwright tests (non-@live)
```

---

## Session start ritual for B2

```
Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.
```

---

## File inventory (key files added/modified in B1)

```
middleware.ts                                       Auth gate (getUser, invite check)
lib/
  flags.ts                                          VERIFICATION_ENABLED feature flag
  invite-codes.ts                                   Code format utils
  supabase/
    browser.ts                                      Browser Supabase client
    server.ts                                       Server + service role clients
    types.ts                                        DB type helpers
app/
  page.tsx                                          Landing stub (redirects via middleware)
  enter/
    page.tsx                                        Invite code entry UI
    waitlist/page.tsx                               Waitlist email capture
  onboarding/
    account/page.tsx                                Signup form (email/username/password)
    verify/page.tsx                                 ID verification placeholder
    setup/page.tsx                                  Quick setup (sizes, address, skippable)
    codes/
      page.tsx                                      Server component (fetches codes)
      codes-client.tsx                              Client component (COPY buttons)
  api/
    auth/logout/route.ts                            POST → signOut + redirect /enter
    onboarding/generate-codes/route.ts              POST → generate_member_codes RPC
    waitlist/route.ts                               POST → log + ack (TODO B8: persist)
supabase/
  migrations/
    20240101000001_profiles_b1.sql                  id_verification_status, invited_by, quick_setup
    20240101000002_invite_codes.sql                 invite_codes table + RPCs
    20240101000003_fix_rpc_security.sql             auth.uid() fix + FOR UPDATE in generate_member_codes
scripts/
  seed-founders.ts                                  30 founder codes (idempotent)
tests/
  unit/invite-codes.test.ts                         11 unit tests (code format utils)
  e2e/auth.spec.ts                                  8 non-@live Playwright specs
  e2e/auth-live.spec.ts                             @live RLS + double-claim specs
```

---

## Known issues / deferred

- Email verification not enforced before profile creation — profile is inserted immediately after `signUp`. Deferred to B8 hardening.
- Waitlist emails not persisted — `POST /api/waitlist` logs only. TODO B8.
- `@live` e2e specs (RLS isolation, concurrent double-claim) require `RUN_LIVE_TESTS=1` and live Supabase credentials. Run locally before B8.
