# AGENTS.md — rules for coding agents in this repo

These rules are **binding** for every coding agent (Claude Code, Cursor, Codex,
Copilot, or anything else) and for the humans driving them. They exist so that
UI/frontend work can move fast without ever touching money, auth, or data
integrity. CI enforces the perimeter (`.github/workflows/protected-paths.yml`);
this file tells you where it is before you hit it.

Before starting any task, read `CONTRIBUTING.md`: setup, the verification gate, the
feature loop, and the spec template. This file is the rules; that file is how to
satisfy them.

Context: this is a live-money marketplace (Stripe Connect escrow, Supabase
Postgres with RLS). A wrong edit here doesn't break a demo — it moves money or
leaks data. When in doubt, stop and ask.

## 1. Scope of work

You are here for **frontend/UI work**: pages, layouts, components, styling,
copy, interaction, accessibility, and tests.

Work freely in:

- `app/**` — EXCEPT `app/api/**`
- `tests/**` — add and extend tests
- `public/**`, `design-reference/**`
- `docs/**` — new files only; never rewrite existing docs

## 2. Protected paths — do not create, edit, or delete

Canonical machine-readable list: `.github/protected-paths.txt`. In human terms:

- `lib/**` — fees, orders, offers, auth, Supabase clients, trust/fraud, flags, IDV, shipping, notifications. All of it.
- `app/api/**` — checkout, webhooks, admin, cron, everything server-mutating.
- `supabase/**` — migrations and DB config. Every table ships with RLS; schema is founder-only.
- `middleware.ts`, `instrumentation*.ts`, `next.config.ts`, `vercel.json`
- `package.json`, `pnpm-lock.yaml`, `pnpm-workspace.yaml`, `tsconfig.json`, `eslint.config.mjs`, `postcss.config.mjs`, `playwright.config.ts`, `vitest.config.ts`
- `.github/**`, `.claude/**`, `.mcp.json`, `.env.example`, `.gitignore`
- `prompts/**`, `scripts/**`, `audit.mjs` — founder build tooling
- `docs/HANDOFF.md`, `docs/ROADMAP.md` — founder state files
- `CLAUDE.md`, `AGENTS.md`, `CONTRIBUTING.md` — this rulebook

If your task genuinely requires a protected change (a new API field, a helper in
`lib/`, a dependency): **stop, do the UI part, and write exactly what you need in
the PR description** — file, change, reason. The founder makes the change or
applies the `protected-approved` label after review. Never add that label
yourself, never edit the guard, never restructure files to route around the list
(e.g. re-implementing a `lib/` helper inside `app/` to dodge review — copying
money/auth logic is the exact failure this file exists to prevent).

## 3. Invariants — never violate, in any file

**Money**
- Prices are integer cents, always. Never floats, never string math.
- Every fee/total shown in UI comes from existing helpers (`lib/fees.ts` et al.). Never inline a percentage, rounding rule, or fee tier in a component.
- The client never computes or reports charge amounts; state changes are webhook-driven.

**Auth & data**
- Authorization is server-side. Never gate anything on client state alone; never "fix" an auth check by loosening it.
- `getUser()` from `@supabase/ssr` is the only authorization primitive. `getSession()` is banned for authz.
- Never run `supabase db push`, `db reset`, `link`, or any migration command. Never edit `lib/supabase/types.ts` (generated).

**Secrets**
- Never commit, print, or hardcode key values. `.env.local` stays untouched and unread.
- `NEXT_PUBLIC_` is only for: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_PUBLISHABLE_KEY`, `POSTHOG_KEY`, `POSTHOG_HOST`, and the public-by-nature `APP_URL`, `VAPID_PUBLIC_KEY`, `RECS_ENABLED`, `BOOSTED_POSTS_ENABLED`, `*_AUTH_ENABLED`. Everything else is server-only; never move a server var into client code.

**Integrity of the harness**
- Never delete, skip, `.only`, weaken, or grep-exclude a test to get green. Fix the code or report the failure.
- Never modify CI workflows, lint config, or tsconfig to silence an error.
- If `pnpm verify` fails somewhere you didn't touch, report it in the PR — do not "helpfully" fix server code.

**Feature flags**
- Flags in `lib/flags.ts` are launch sequencing. Never flip, add, or remove one.

## 4. Design system rules

- Tokens are plain CSS custom properties at the top of `app/globals.css` (`:root` = light, `[data-theme='dark']` = dark; no Tailwind `@theme`). Colour vocabulary: `--bg --ink --on-ink --sub --faint --line --line-row --line-mid --line-hover --hover --scrim --sold-scrim --badge-* --tone-1…8 --alert`. Two fonts: `--font-sans` (Archivo 300/400/500) for chrome and copy, `--font-mono` (IBM Plex Mono 300/400) for every piece of data. Radius 0, 1px hairlines, 44px controls. No gradients, no shadows.
- Light, dark and system themes are all supported. Components never branch on theme — they use tokens, and the `data-theme` flip (app/components/theme.tsx) does the rest. `/styleguide` is the living reference.
- **All listing data renders in `--font-mono` (IBM Plex Mono).** No exceptions.
- **Type floor: 11px** for anything a person reads or operates (labels, buttons, nav, meta). Count badges and tag chips may go to 10px. Nothing below 10px anywhere.
- No hardcoded colours/fonts/sizes in components — tokens only. A new visual value must become a token first.
- Token changes ARE allowed (the design system is evolving) — but every token added, changed, or removed must be listed explicitly in the PR description.
- `design-reference/` is never imported by app code. It's visual reference only.

## 5. Workflow

1. Branch from `main`: `ui/<thing>` or `feat/<thing>`. Never commit to `main`. Never force-push anything.
2. Before declaring any task done: `pnpm verify && pnpm build` — both green, locally. (pnpm only; npm/yarn are banned. Stop the dev server before `pnpm build`.)
3. `pnpm verify:ui` runs Playwright; specs tagged `@live` need real sandbox keys — skipping them locally is fine, CI skips them too.
4. Small, single-purpose PRs to `main`. CI must be fully green, including the `protected-paths` check.
5. Quarantine, don't delete: if a file must go away and tooling blocks deletion, move it under `_to_delete/` and say so in the PR.

## 6. Escalation

Blocked by a protected path, a failing check you don't own, a missing env var, or
an ambiguous design call? Say so in the PR (or to Tony directly) and stop that
thread of work. A clearly described blocker is a good outcome; a clever workaround
in a money path is not.
