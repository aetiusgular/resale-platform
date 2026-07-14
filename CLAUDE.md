# CLAUDE.md — Resale Platform context layer
> Read this file at the start of every session. Then read `docs/HANDOFF.md` to find the current state.

## Stack versions (as of B0)
- **Next.js** 15.3+ · App Router · TypeScript strict
- **React** 19
- **Tailwind CSS** 4 (CSS-based config via `@theme` in `app/globals.css`)
- **@supabase/ssr** 0.6+ · **@supabase/supabase-js** 2.50+
- **Vitest** 3 · **Playwright** 1.50+
- **pnpm** 11 — no npm/yarn anywhere
- **Supabase CLI** via `pnpm exec supabase` (devDependency, not global)
- Node 22 LTS

## Model policy (founder decision, 2026-07-13)
**Opus (claude-opus-4-8) for EVERYTHING** — planning, execution, all
subagents, all headless runs (`--model opus`), interactive default pinned
in .claude/settings.json. No downgrades for token savings unless the
founder explicitly reinstates a routing policy. Quality is the only bar.


## Token / read discipline
- Read ONLY files whitelisted for the current prompt. See each Bn prompt for its whitelist.
- Use subagents (Agent tool) for exploration instead of dumping entire directories into main context.
- Never `cat` entire directories. View design PNGs/HTML exports one at a time, only when implementing that screen.
- Subagents use haiku by default for cheap exploration.

## Money rules (CRITICAL)
- **Prices are integer cents.** Never floats. `price_cents INT NOT NULL`.
- All money-state changes happen inside **DB transactions**, never ad-hoc updates.
- Payment flow is **webhook-driven** — server never trusts client-reported amounts.
- Fee math lives in one place: `lib/fees.ts`. All callers import from there.
- `STRIPE_SECRET_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are **server-only** — never `NEXT_PUBLIC_`.

## Auth rules (CRITICAL)
- Use `getUser()` from `@supabase/ssr`, **never** `getSession()` for authorization checks.
- `getSession()` trusts the JWT without a server round-trip — unsafe for authz.
- Middleware pattern: `createServerClient` with cookie adapter from `@supabase/ssr`.

## Database rules
- **Every table ships with RLS enabled in the same migration.** No table without RLS, ever.
- `db-guard` subagent reviews every migration before it is pushed. Mandatory.
- Grant `SELECT/INSERT/UPDATE` to `authenticated` explicitly — auto-expose is OFF on this project.
- Indexes: every FK column, every column used in a WHERE or ORDER BY, every tsvector column.
- Cascades: document the delete behavior in a comment above every FK.
- `pg_cron` and `pgcrypto` extensions enabled on the hosted project (SETUP_CHECKLIST §2).

## Design token rules
- Tokens live in `app/globals.css` under `@theme`. Source of truth: `design-reference/tokens/`.
- Six colours only: `--color-bg` `--color-ink` `--color-ink-soft` `--color-line` `--color-accent` `--color-alert`.
- Three fonts: `--font-ui` (Inter), `--font-serif` (EB Garamond), `--font-mono` (Space Mono — ALL listing data).
- Type scale: 12/14/16/20/28/40. Radius: 2px everywhere. Grid: 8px. Control height: 44px.
- No new colours, no new fonts, no gradients, no dark mode — match `design-reference/` exports exactly.
- `design-reference/` is never imported by app code. Reference only for ui-verifier.

## Verify scripts
```bash
pnpm verify       # tsc --noEmit && eslint && vitest run
pnpm verify:ui    # playwright test (non-@live only in CI)
pnpm build        # must be green before any commit
```
Live-service e2e specs tagged `@live` — CI skips them; run locally only.

## Per-session epilogue — VERIFY → RECORD → DECIDE (mandatory)
Every build prompt Bn ends with:
1. **VERIFY:** `pnpm build && pnpm verify && pnpm verify:ui` — fix until green.
   - Run `code-reviewer` subagent before committing any auth/money/RLS change.
   - Run `db-guard` subagent before pushing any migration.
2. **RECORD:** update `docs/ROADMAP.md` (check the milestone) and rewrite `docs/HANDOFF.md`
   (current state, what's done, what's next, blockers, exact next prompt ID).
3. **DECIDE:** if context is heavy (rule: one full build prompt ≈ one session), print
   `HANDOFF COMPLETE → start a fresh session and run: B<n+1>` and stop.

## Env / secrets policy
- `.env.local` is gitignored. Never print, commit, or hardcode key values.
- See `.env.example` for the full variable list.
- `NEXT_PUBLIC_` prefix: only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_PUBLISHABLE_KEY`, `POSTHOG_KEY`, `POSTHOG_HOST`.
- All others are server-side only.

## File layout
```
app/                  Next.js App Router
  globals.css         Design tokens (@theme) + base styles
  layout.tsx          Fonts (next/font/google), html shell
  styleguide/         Token showcase + listing-card skeleton
lib/
  fees.ts             (B5) Fee math — single source of truth
  supabase/           Server + browser client factories
design-reference/     Design exports — NEVER imported by app code
supabase/
  migrations/         SQL migrations — every table has RLS
docs/                 Planning docs + HANDOFF.md + ROADMAP.md
tests/
  unit/               Vitest unit tests
  e2e/                Playwright specs (tag live-service with @live)
.claude/
  agents/             Subagent configs (code-reviewer, db-guard, ui-verifier)
  settings.json       Allowlisted bash commands
```
