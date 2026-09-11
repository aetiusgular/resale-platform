# CONTRIBUTING.md: how to build in this repo

This is the working playbook for anyone changing code here, human or coding agent
(Cursor, Claude Code, Codex, Copilot). It tells you how to get running, what the
verification gate is, how to add a feature without breaking one, and how to write
the tests that prove it. The rules themselves live in `AGENTS.md` and are binding;
this file is how you satisfy them efficiently.

Read order for a new session:

1. `AGENTS.md`: the rules. Protected paths, invariants, workflow. Binding.
2. This file: how to work here.
3. `docs/HANDOFF.md`: current state of the build. Do not edit it.

If anything in `README.md` conflicts with `AGENTS.md`, `AGENTS.md` wins.

---

## 1. Zero to running

Requirements: Node 22 LTS, pnpm 11. Nothing else. No npm, no yarn, ever.

```bash
corepack enable                          # provides pnpm
pnpm install                             # never npm install / yarn
pnpm exec playwright install chromium    # once per machine; the e2e suite needs it
cp .env.example .env.local
```

`.env.example` ships with blank values, and the Supabase clients in `lib/supabase/`
read those values without a guard, so a blank `.env.local` gives you a dev server
whose pages throw. Fill `.env.local` with one of the two blocks below.

**Block A: no keys (UI-only work, matches CI exactly).** Every page boots, the
chrome renders, `/browse` renders an empty grid, all redirects and 401s behave, and
the full non-`@live` test suite passes. This is precisely what CI runs against.

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://dummy.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=dummy-anon-key
SUPABASE_SERVICE_ROLE_KEY=dummy-service-role-key
SUPABASE_DB_PASSWORD=dummy-password
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_dummy
STRIPE_SECRET_KEY=sk_test_dummy
STRIPE_WEBHOOK_SECRET=whsec_dummy
NEXT_PUBLIC_POSTHOG_KEY=phc_dummy
NEXT_PUBLIC_POSTHOG_HOST=https://us.i.posthog.com
SENTRY_DSN=
```

**Block B: sandbox keys from Tony.** Needed to see real listings, sign in, use the
listing page with data, the legit-check thread, checkout, messages, and to run the
`@live` specs. Ask for them; never guess them; never commit them.

Then:

```bash
pnpm dev          # http://localhost:3000
```

Stop the dev server before running `pnpm build`. They both write to `.next/` and
will corrupt each other.

---

## 2. The verification gate

CI runs four checks on every pull request to `main`. Run the same commands locally
before every commit. They are the same commands, in the same order, with the same
config. Nothing is green until all of them are.

| CI job | Local command | What it catches | Typical time |
|---|---|---|---|
| `verify` | `pnpm verify` | Type errors (`tsc --noEmit`), lint (`eslint .`), unit regressions (`vitest run`) | 30 to 90s |
| `build` | `pnpm build` | Anything Next.js refuses to compile: bad imports, server/client boundary mistakes, missing Suspense around `useSearchParams`, broken routes | 1 to 3 min |
| `verify-ui` | `pnpm verify:ui` | Playwright structural specs: pages that 500, redirects that stop working, elements that vanished | 1 to 3 min |
| `protected-paths` | (CI only) | Any diff to money, auth, DB, or config paths without founder sign-off | seconds |

The full local sequence, in order:

```bash
pnpm verify && pnpm build && pnpm verify:ui
```

What you are allowed to do when something fails: fix the code you changed, or
report it. What you are never allowed to do: delete a test, skip it, add `.only`,
loosen an assertion, grep it out, or edit `tsconfig.json`, `eslint.config.mjs`, a
CI workflow, or either test config to make red go green. CI sets
`forbidOnly`, so a stray `.only` fails the run on its own.

If `pnpm verify` fails somewhere you did not touch, say so in the PR and stop that
thread. Do not fix server code to get past it.

`@live` specs (tagged in the test title) need Block B keys and are skipped
automatically unless `RUN_LIVE_TESTS=1`. CI skips them too. A local run that shows
them as skipped is a normal, green run.

---

## 3. Where things live

Three zones. Green: edit freely. Amber: editable, list the change in the PR.
Red: protected, the `protected-paths` check fails your PR until Tony reviews and
applies the `protected-approved` label. Machine-readable list:
`.github/protected-paths.txt`.

```
app/
  globals.css               Tokens (:root light, [data-theme='dark'] dark) + the whole
                            component sheet. One file, plain CSS.          AMBER
  layout.tsx                Fonts (next/font), theme bootstrap, html shell  AMBER
  components/               Shared chrome: app-shell, site-header, site-footer,
                            icons.tsx, theme.tsx, cards, popouts            green
  browse/browse-client.tsx  Browse page: rail, results head, dock, sort     green
  listings/[id]/            Listing page (page.tsx) + community-section.tsx
                            (the legit-check thread)                        green
  saved/ sell/ settings/ messages/ checkout/ ...   route segments           green
  styleguide/               Living design reference, /styleguide           green
  api/                      Route handlers. Money, webhooks, admin.         RED
lib/                        Fees, orders, offers, auth, trust, flags, Supabase
                            clients, browse parser, taxonomy, sizes.        RED
supabase/migrations/        SQL. Every table has RLS.                       RED
middleware.ts               Auth/session.                                   RED
tests/unit/                 Vitest. Pure logic, mostly lib/.                green
tests/e2e/                  Playwright. Structural specs + @live flows.     green
design-reference/           Visual reference only. Never imported.          green
docs/                       Founder planning. Add files, never rewrite.
public/                     Static assets.                                  green
*config*, .github/, .claude/, package.json, pnpm-lock.yaml, AGENTS.md, CLAUDE.md,
CONTRIBUTING.md                                                             RED
```

UI work happens in `app/` (everything except `app/api/`) plus `tests/`. If a task
seems to need a red change (a new API field, a helper in `lib/`, a dependency),
do the UI part, describe the exact red change you need in the PR description (file,
change, reason), and stop. Never re-implement `lib/` logic inside `app/` to avoid
the guard.

### The `data-testid` convention

Interactive and structural elements carry a `data-testid` in kebab-case, scoped by
feature: `browse-signin`, `results-count`, `sort-dropdown-btn`, `follow-search-btn`,
`my-sizes-toggle`, `mobile-filter-btn`, `browse-dock`, `lc-input`, `lc-post`,
`flag-button`. Specs locate elements with `page.getByTestId('...')`. Treat existing
testids as a public contract: renaming or removing one breaks a spec, and a spec
that breaks is the point. Add a testid to any new control you build.

---

## 4. The feature loop

This is the order that avoids rework.

1. **Branch from `main`.** `ui/<thing>` for visual work, `feat/<thing>` for behaviour.
   Never commit to `main`. Never force-push.
2. **Read before you write.** Open the page or component you are changing and the
   spec that covers it (`tests/e2e/<area>.spec.ts`). Search `app/globals.css` for the
   class names involved. Check `/styleguide` for the token or control you need
   before inventing one.
3. **Make the change with tokens only.** No hardcoded colours, fonts, or sizes in
   components. If you need a value that has no token, add the token to
   `globals.css` first and list it in the PR.
4. **Write or extend a structural spec for what you touched.** Section 5 has the
   template. The rule of thumb: if a user could notice it missing, a spec should
   notice it missing. A new button gets a testid and a visibility assertion. A
   changed breakpoint gets a viewport assertion.
5. **Run the gate.** `pnpm verify && pnpm build && pnpm verify:ui`, all green.
6. **Open a small, single-purpose PR to `main`.** Fill in the checklist in section 7.
   CI must be fully green, including `protected-paths`. Tony reviews and merges.

Small PRs merge. Large PRs sit. One visual concern per PR.

---

## 5. Writing tests here

Two frameworks, two jobs. You will almost always be writing Playwright.

**Vitest (`tests/unit/`)** covers pure logic: fee math, order state, trust rules,
filters. Node environment, `globals: true`, files match `tests/unit/**/*.test.ts`.
UI work rarely adds one. If you change a pure helper that a component calls, its
existing unit test is the guard.

**Playwright (`tests/e2e/`)** covers the app as a user sees it. Config:
`playwright.config.ts`. `baseURL` is `http://localhost:3000`, Chromium only, the
suite starts `pnpm dev` itself and reuses a running dev server locally. Traces are
captured on first retry.

Two kinds of spec live side by side, told apart by the `@live` tag in the title:

- **Structural (no tag).** Runs with Block A dummy keys. Asserts on things that
  exist without data: routes, redirects, 401/404 status codes, chrome, testids,
  breakpoints. This is what CI runs and what protects your UI.
- **`@live`.** Runs only with `RUN_LIVE_TESTS=1` and Block B keys. Full flows against
  a real sandbox: sign-up, create listing, checkout, vote. Skipped in CI. Add one
  only when the behaviour cannot be observed without data.

Run one file, or the whole suite, or interactively:

```bash
pnpm exec playwright test tests/e2e/browse.spec.ts      # one file
pnpm exec playwright test -g "sort"                     # tests whose title matches
pnpm exec playwright test --headed                      # watch it
pnpm exec playwright test --ui                          # Playwright UI mode
pnpm verify:ui                                          # the whole non-@live suite
RUN_LIVE_TESTS=1 pnpm verify:ui                         # include @live (needs Block B)
```

### Template: a structural spec for a UI change

Copy this into `tests/e2e/<area>.spec.ts` (extend the existing file for that area
if one exists) and replace the specifics. Header comment style matches the suite.

```ts
import { test, expect } from '@playwright/test'

/**
 * <Area> structural specs (non-@live).
 * Runs against the app with dummy keys. Asserts structure and routing only.
 */

test.describe('<Area> — <what you built>', () => {
  test('<control> renders for a guest at desktop width', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    await page.goto('/browse')
    await expect(page.getByTestId('<your-testid>')).toBeVisible()
  })

  test('<control> is hidden at mobile width and the dock takes over', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/browse')
    await expect(page.getByTestId('<your-testid>')).toBeHidden()
    await expect(page.getByTestId('browse-dock')).toBeVisible()
  })
})
```

Assert on stable things: testids, URLs, status codes, visibility, text a user
reads. Do not assert on pixel positions or exact widths unless the layout itself is
the feature; when it is, measure with `boundingBox()` and assert a relationship,
not a magic number (see `tests/e2e/card-alignment.spec.ts`, an `@live` spec that
checks the first row of cards shares heights and baselines within 1px).

If your change is on a page that needs data (a listing, the legit-check thread),
assert what you can without data (the 404 for an unknown id, the redirect for a
guest, the chrome) in a structural spec, and put the data-dependent assertion in a
`@live` test only if it matters enough to maintain. Say which you did in the PR.

---

## 6. The design system, working version

Canonical rules are `AGENTS.md` section 4. The short version you need while building:

- Tokens are plain CSS custom properties at the top of `app/globals.css`.
  `:root` is light, `[data-theme='dark']` is dark. Light, dark, and system are all
  supported. Components never branch on theme; they use tokens and the `data-theme`
  flip does the rest.
- Colour vocabulary: `--bg --ink --on-ink --sub --faint --emphasis --line --line-row
  --line-mid --line-hover --hover --scrim --sold-scrim --badge-bg --badge-bd
  --badge-fg --tone-1` through `--tone-8`, `--alert`. Legacy `--color-*` aliases
  still resolve but are not for new code.
- Two fonts: `--font-sans` (Archivo 300/400/500) for chrome and copy,
  `--font-mono` (IBM Plex Mono 300/400) for every piece of data: prices, sizes,
  counts, labels, timestamps, tags. All listing data renders in mono, no exceptions.
  Those are the only weights `app/layout.tsx` loads; a heavier mono weight in CSS
  is synthesized by the browser, not a real face.
- Radius 0. 1px hairlines. 44px controls. No gradients. No shadows.
- Type floor: 11px for anything a person reads or operates; 10px only for count badges
  and tag chips. Nothing below 10px. WCAG sets no minimum; this is the house floor.
- `/styleguide` is the living reference. When unsure what a control looks like,
  look there before looking anywhere else.
- Contrast is held to WCAG 2.2 AAA for text (7:1) and AA for control edges (3:1), in both themes.
  If you change a token, recheck the ratio in both themes before you open the PR.
- Icons are one visual system: `currentColor` outlines at a 1.5 stroke with round caps.
  Shared custom icons live in `app/components/icons.tsx` (`0 0 24 24` viewBox); new icons
  come from `@phosphor-icons/react/ssr` at the default regular weight, which matches.
  Do not inline one-off SVGs in pages. Text separators use `.sep` (a hairline), not middots.

---

## 7. Pull request checklist

Paste into the PR description and fill it in.

```
## What
<one sentence>

## Where
Files: <list>
Zone: green / amber / red-needed (describe the red change; do not make it)

## Tokens
Added / changed / removed: <list, or "none">

## Tests
Structural spec added or extended: <path> (or why not)
@live spec touched: <path or "none">

## Gate (local)
- [ ] pnpm verify green
- [ ] pnpm build green (dev server stopped first)
- [ ] pnpm verify:ui green (@live skipped is fine)

## Screenshots
Light + dark at 1280 and 390 for any visual change.
```

---

## 8. Things that bite

- **`pnpm dev` and `pnpm build` at the same time.** Both write `.next/`. Stop dev
  first. If a build fails with odd module errors, `rm -rf .next` and rebuild.
- **Blank `.env.local`.** Pages throw inside the Supabase client. Use Block A.
- **Playwright "browser not found".** Run `pnpm exec playwright install chromium`.
- **`@live` specs failing locally.** Expected without Block B keys. They are skipped
  unless `RUN_LIVE_TESTS=1`; if you set it without keys, they fail, which is correct.
- **pnpm version drift.** This repo uses pnpm 11 features in `pnpm-workspace.yaml`.
  If `pnpm install` rewrites `pnpm-lock.yaml`, you are on the wrong pnpm. Do not
  commit the rewritten lockfile; it is a protected path and will fail the guard.
- **`'use client'`.** Any component using hooks, event handlers, `useSearchParams`,
  or browser APIs needs it at the top. Server Components are the default.
- **`useSearchParams` in a client component** must sit under a `<Suspense>` boundary
  or `pnpm build` fails the static prerender.
- **Fonts.** Loaded once in `app/layout.tsx` via `next/font/google` and exposed as
  `--font-sans` / `--font-mono`. Never add a `<link>` to Google Fonts in a page.
- **`design-reference/`** is never imported by app code. Reference only.
- **Non-ASCII in edits.** The CSS and copy use `—`, `·`, `‹`, `›`. When scripting an
  edit, anchor on the ASCII around them rather than retyping them.
- **A stray `.git/index.lock`** after an interrupted git command: `rm -f .git/index.lock`.

---

## 9. When to stop and ask

Blocked by a protected path, a failing check you do not own, a missing env var, or
an ambiguous design call: describe it in the PR (or to Tony directly) and stop that
thread. A clearly described blocker is a good outcome. A clever workaround in a
money or auth path is the failure this whole setup exists to prevent.
