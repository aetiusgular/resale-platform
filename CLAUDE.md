# CLAUDE.md — Resale Platform context layer
> Read this file at the start of every session. Then read `docs/HANDOFF.md` to find the current state.

## Stack versions (as of B0)
- **Next.js** 15.3+ · App Router · TypeScript strict
- **React** 19
- **Tailwind CSS** 4 — installed but no longer imported; styling is plain CSS with custom-property tokens (see Design token rules)
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

## Collaborator guardrails (added 2026-09-01)
- `AGENTS.md` (repo root) is **BINDING for every coding agent** in this repo —
  read it before making changes. It defines the protected paths (mirrored in
  `.github/protected-paths.txt`): money, auth, RLS/migrations, config, founder tooling.
- Non-founder PRs touching protected paths fail the `protected-paths` CI check
  until the founder reviews and applies the `protected-approved` label.
- Frontend collaborators: work in `app/` (never `app/api/`) + `tests/`, on
  branches, via PRs — never on `main`.

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

## Design token rules (ARCHIVE system, ui/archive-redesign)
- Tokens are plain CSS custom properties at the top of `app/globals.css`: `:root` holds the light
  palette, `[data-theme='dark']` the dark one. No Tailwind `@theme` (Tailwind is no longer imported).
  Source of truth: the approved design review (`Downloads/frontend` reference app, theme.css + app.css).
- Colour vocabulary (the ONLY colours components may use): `--bg` `--ink` `--on-ink` `--sub` `--faint`
  `--line` `--line-row` `--line-mid` `--line-hover` `--hover` `--scrim` `--sold-scrim` `--badge-bg/bd/fg`
  `--tone-1…8` (image placeholders) `--alert` (errors + disputes only). Legacy aliases
  (`--color-bg`, `--color-ink`, `--color-ink-soft`, `--color-line`, `--color-accent`, `--color-alert`)
  resolve to the new palette so nothing old breaks; don't use them in new code.
- Two fonts: `--font-sans` (Archivo 300/400/500 — chrome and copy) and `--font-mono` (IBM Plex Mono
  300/400 — ALL data: prices, sizes, counts, labels, timestamps, tags). Loaded via next/font/google.
- Radius 0 everywhere. 1px hairlines. Control height 44px. No gradients, no shadows.
- Light, dark and system themes are all supported (`archive-theme` in localStorage, applied before
  first paint by the inline script in `app/layout.tsx`; `app/components/theme.tsx` owns the store).
  Components never branch on theme — tokens only.
- `/styleguide` is the living reference: tokens, type, controls, cards, timeline, rules.
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
- `NEXT_PUBLIC_` prefix: only `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_PUBLISHABLE_KEY`, `POSTHOG_KEY`, `POSTHOG_HOST`,
  plus the public-by-nature `APP_URL`, `VAPID_PUBLIC_KEY`, `RECS_ENABLED`, `BOOSTED_POSTS_ENABLED`, `*_AUTH_ENABLED`.
- All others are server-side only.

## File layout
```
app/                  Next.js App Router
  globals.css         Design tokens (:root / [data-theme='dark']) + the full component sheet
  layout.tsx          Fonts (next/font/google), theme bootstrap script, html shell
  components/         Shared chrome: app-shell, site-header, account/notification popouts, theme, cards
  styleguide/         Living styleguide — tokens, type, controls, cards
lib/
  fees.ts             (B5) Fee math — single source of truth
  supabase/           Server + browser client factories
  browse/filters.ts   ONE browse URL parser + WHERE/ORDER builder (page 1 + /api/browse)
  taxonomy.ts         Department / category tree / colours / measurement labels (pure)
  sizes.ts            Size scales + dept-scoped profiles.sizes contract (pure)
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
