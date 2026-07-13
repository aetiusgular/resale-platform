# HANDOFF.md
## Current state: B0 COMPLETE

**Last updated:** 2026-07-12
**Next prompt:** B1 — Auth + invite gate

---

## What was done in B0

1. **Next.js 15 scaffold** — App Router, TypeScript strict, Tailwind CSS 4 (CSS-based `@theme` tokens), `@supabase/ssr`, `@supabase/supabase-js`. Vercel-ready (`next.config.ts` with `outputFileTracingRoot`).

2. **Design reference** — `/Users/tonyg/Desktop/Secondhand fashion design system` copied to `design-reference/`. Never imported by app code; reference only for ui-verifier.

3. **Design tokens extracted** — All 6 colors, 3 fonts, type scale, 8px grid, radius, control height from `design-reference/tokens/` → `app/globals.css @theme`. Fonts loaded via `next/font/google` in `app/layout.tsx` (Inter, EB Garamond, Space Mono). `/styleguide` route renders all tokens + listing-card skeleton.

4. **CLAUDE.md** — Written (<150 lines). Stack versions, model routing, token/read discipline, money rules (integer cents, DB transactions, webhook-driven), auth rules (`getUser()` only), DB rules (RLS on every table, explicit grants), verify scripts, per-session epilogue.

5. **Subagents** — `.claude/agents/code-reviewer.md` (opus, read-only), `db-guard.md` (sonnet, read-only), `ui-verifier.md` (sonnet, playwright).

6. **Verify harness** — `pnpm verify` (tsc + eslint + vitest) green. `pnpm verify:ui` (playwright, 3 smoke tests) green. Playwright chromium installed. Live-service specs tagged `@live` (none yet). GitHub Actions CI at `.github/workflows/ci.yml`.

7. **Env / permissions** — `.env.example` with all variable names (values blank). `.claude/settings.json` with allowed commands. `.gitignore` extended.

8. **Supabase** — `pnpm exec supabase init` run. `pnpm exec supabase link` **failed on auth** (see Blockers). Migration ready at `supabase/migrations/20240101000000_profiles.sql`.

9. **docs/DESIGN_MAP.md** — All 8 `.dc.html` exports mapped to screen → route → build prompt. Token extraction notes included.

10. **docs/ROADMAP.md** — B0 checked, B1–B8 unchecked.

---

## Blockers

### Supabase CLI auth not configured
**Error:** `Access token not provided. Supply an access token by running 'supabase login' or setting the SUPABASE_ACCESS_TOKEN environment variable.`

**Remediation (manual, before B1):**
```bash
pnpm exec supabase login
# Opens browser — authenticate with your Supabase account
# Then:
SUPABASE_URL=$(grep NEXT_PUBLIC_SUPABASE_URL .env.local | cut -d'=' -f2)
PROJECT_REF=$(echo $SUPABASE_URL | sed 's|https://||' | cut -d'.' -f1)
pnpm exec supabase link --project-ref "$PROJECT_REF"
pnpm exec supabase db push
```

Migration file: `supabase/migrations/20240101000000_profiles.sql` (profiles table + RLS + grants — ready to push once linked).

---

## Known issues
- `pnpm verify:ui` starts a dev server via `webServer` in playwright config. This is fine locally but CI uses `pnpm dev` startup which takes ~10s. Consider building first if CI is too slow.
- `next build` warns about workspace root (multiple lockfiles). Suppressed with `outputFileTracingRoot` in `next.config.ts`.
- pnpm 11 build script approvals: esbuild, sharp, unrs-resolver approved via `allowBuilds` in `pnpm-workspace.yaml`. `pnpm approve-builds` was run manually once — config persists.

---

## Session start ritual for B1

```
Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.
```
(In Plan Mode on fable/opus — then execute on sonnet.)

**Before running B1:** Complete the Supabase auth blocker above.

---

## File inventory (key files added in B0)

```
CLAUDE.md                                   Context layer — read every session
pnpm-workspace.yaml                         pnpm 11 build script approvals
package.json                                Dependencies
next.config.ts                              Next.js config (outputFileTracingRoot)
tsconfig.json                               TypeScript strict
eslint.config.mjs                           ESLint 9 flat config
postcss.config.mjs                          Tailwind 4 PostCSS
vitest.config.ts                            Vitest unit test config
playwright.config.ts                        Playwright e2e config
app/
  globals.css                               Design tokens + base styles
  layout.tsx                                next/font/google, html shell
  page.tsx                                  Landing stub
  styleguide/page.tsx                       Token showcase + listing-card skeleton
tests/
  unit/placeholder.test.ts                  Placeholder (replaced per prompt)
  e2e/styleguide.spec.ts                    Font + token smoke test (3 specs)
design-reference/                           Design exports (read-only reference)
docs/
  DESIGN_MAP.md                             .dc.html → route → build prompt map
  ROADMAP.md                                B0–B8 milestone tracker
  HANDOFF.md                                This file
supabase/
  migrations/20240101000000_profiles.sql    Profiles + RLS (ready to push)
.claude/
  agents/code-reviewer.md                   opus, read-only, RLS+auth+payment review
  agents/db-guard.md                        sonnet, read-only, migration review
  agents/ui-verifier.md                     sonnet, playwright, design comparison
  settings.json                             Allowed bash commands
.github/
  workflows/ci.yml                          verify + build + verify:ui (non-@live)
.env.example                                Variable names (values blank)
```
