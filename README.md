# resale-platform

Curated secondhand luxury & streetwear marketplace. Alpha build, private repo, working name TBD.

**New here? Read in this order:**

1. This file — setup, repo map, and the editing rules.
2. [`AGENTS.md`](AGENTS.md) — **binding** rules for anyone (and any coding agent) changing code here.
3. [`docs/HANDOFF.md`](docs/HANDOFF.md) — current state of the build: what's done, what's in flight.

---

## Stack

| Layer | Choice |
|---|---|
| Framework | Next.js 15 (App Router, RSC-first) · React 19 · TypeScript strict |
| Styling | Tailwind CSS 4 — config lives in CSS (`@theme` in `app/globals.css`), not a JS file |
| Data & auth | Supabase (Postgres + Auth), RLS on every table, via `@supabase/ssr` |
| Payments | Stripe Connect — separate charges & transfers, escrow, **webhook-driven** |
| Observability | PostHog (product analytics) · Sentry (errors) |
| Tests | Vitest 3 (unit) · Playwright (e2e; live-service specs tagged `@live`) |
| Tooling | pnpm 11 (**never npm/yarn**) · Node 22 LTS |

## Getting started

```bash
corepack enable                 # provides pnpm 11
pnpm install
cp .env.example .env.local      # then ask Tony for dev/sandbox keys
pnpm dev                        # http://localhost:3000
```

`.env.local` is gitignored — real keys never enter the repo, and you don't need
production keys for UI work. Sandbox Supabase/Stripe values are enough.

### Commands

| Command | What it does |
|---|---|
| `pnpm dev` | Dev server (stop it before running `pnpm build` — they fight over `.next/`) |
| `pnpm build` | Production build — must be green before any PR |
| `pnpm verify` | `tsc --noEmit` + ESLint + Vitest — must be green before any PR |
| `pnpm verify:ui` | Playwright suite (`@live` specs need real sandbox keys; CI skips them) |
| `pnpm lint` | ESLint only |

## Repo map

Three zones. **Green** — normal frontend work, edit freely. **Amber** — editable, but
call it out explicitly in your PR description. **Red 🔒** — protected: changes fail the
`protected-paths` CI check until Tony reviews and applies the `protected-approved`
label. The full machine-readable list is `.github/protected-paths.txt`.

```
app/                      Next.js App Router — UI LIVES HERE
  components/             Shared UI components ······················· green
  browse/ listings/ sell/ …  Route segments: pages, layouts, UI ······ green
  globals.css             Design tokens (@theme) + base styles ······· AMBER — token changes listed in PR
  layout.tsx              Root shell + font loading ·················· AMBER
  api/                    Route handlers: checkout, webhooks, admin … 🔒 RED
lib/                      Server & business logic: fees, orders,
                          auth, Supabase clients, trust, flags ······· 🔒 RED
middleware.ts             Auth/session middleware ···················· 🔒 RED
supabase/                 SQL migrations (RLS on every table) ········ 🔒 RED
tests/
  unit/  e2e/             Add tests freely; never delete/weaken ······ green
design-reference/         Design exports — reference only,
                          NEVER imported by app code ················· green (see AGENTS.md)
docs/                     Founder planning docs — add, don't edit
                          (HANDOFF.md / ROADMAP.md are 🔒 RED)
public/                   Static assets ······························ green
prompts/  scripts/  audit.mjs   Founder build tooling ················ 🔒 RED
.github/  .claude/  CLAUDE.md  AGENTS.md  *config* files ············ 🔒 RED
```

Rule of thumb: **UI work happens in `app/` (everything except `app/api/`) plus
`tests/`.** If a task seems to need a red-zone change, stop and describe what you
need in the PR — don't reach into it. `AGENTS.md` has the full invariants.

## Design system (the short version)

Tokens are the law and they live in one place: `@theme` in `app/globals.css`
(source exports in `design-reference/tokens/`).

- **Six colours only:** `--color-bg` · `--color-ink` · `--color-ink-soft` · `--color-line` · `--color-accent` · `--color-alert`
- **Three fonts:** `--font-ui` (Inter) · `--font-serif` (EB Garamond) · `--font-mono` (Space Mono — **all listing data, always**)
- **Type scale:** 12 / 14 / 16 / 20 / 28 / 40 · **Radius:** 2px everywhere · **Grid:** 8px · **Controls:** 44px height
- No gradients. No dark-mode variants. No hardcoded hex values in components — tokens only.

The design system itself is evolving and you're welcome to evolve it: change tokens
via PR, with every token addition/change/removal listed in the PR description. New
one-off colours or fonts inside components are not a thing — if it's worth adding,
it's worth being a token.

## Contributing workflow

1. Branch from `main` (`ui/<thing>` or `feat/<thing>`). Never commit to `main`, never force-push.
2. Keep PRs small and single-purpose. Before pushing: `pnpm verify && pnpm build` green locally.
3. CI runs on every PR: type-check/lint/unit, Next build, Playwright (non-`@live`), and the `protected-paths` guard.
4. Tony reviews and merges. If the guard tripped, he reviews those files specifically and applies `protected-approved` before merge.

Using Claude Code, Cursor, Codex, or any other coding agent? Point it at
[`AGENTS.md`](AGENTS.md) first — its rules are binding, and the CI guard enforces
the perimeter regardless of what wrote the diff.

## Architecture in 60 seconds

Server Components by default; mutations go through route handlers in `app/api/*`
and are authorized server-side (`getUser()`, never `getSession()`). Postgres via
Supabase with RLS on every table — the browser client only ever sees what policy
allows. Money is **integer cents end-to-end**; every fee number on screen comes from
helpers in `lib/fees.ts` — never compute a fee in a component. Payments settle via
Stripe webhooks (`app/api/webhooks/stripe`) — the client never reports amounts.
Features ship dark behind flags in `lib/flags.ts`; flag flips are launch sequencing,
not config tweaks. Recommendations come from an external service through
`lib/recs/` — the engine itself is a separate repo.

## More docs

`docs/` is the founder's planning space: `docs/HANDOFF.md` (current state — start
here), `docs/ROADMAP.md`, `docs/FEATURE_SET.md`, `docs/DESIGN_MAP.md`, plus
per-feature specs (`G*.md`). Treat existing docs as read-only context; new design
notes are welcome as new files.
