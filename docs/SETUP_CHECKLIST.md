# SETUP_CHECKLIST.md
### Pre-flight: everything to install, create, and key up BEFORE running B0
Work top to bottom; the preflight script at the end proves you're ready. Nothing in B0–B8 should ever ask you for something not on this page.

---

## 1. Local tooling (30 min)

| Tool | Install / check | Needed from |
|---|---|---|
| Node 20 or 22 LTS | `node -v` (≥20.9) — use nvm | B0 |
| pnpm | `npm i -g pnpm` → `pnpm -v` | B0 (repo standard — everything is pnpm, not npm) |
| git + GitHub account | `git --version`; repo created (private); `gh auth status` if using gh | B0 (CI is GitHub Actions) |
| Claude Code | latest: `claude --version`, `claude doctor` clean; confirm `/model` offers fable — if not, plan-mode model is opus (prompts already say fallback) | B0 |
| Playwright browsers | after B0 installs the dep: `pnpm exec playwright install chromium` (B0 does this; nothing to pre-do beyond disk space) | B0 |
| Supabase CLI | installed as repo devDependency in B0 (`pnpm add -D supabase`, run via `pnpm exec supabase`) — brew route blocked by outdated Xcode CLT | B0 |
| Stripe CLI | ✅ installed at `~/bin/stripe` (v1.43.7, direct binary; PATH added to ~/.zshrc) → run `stripe login` yourself | B5 |
| Xcode Command Line Tools | ADVISORY: outdated (blocks Homebrew installs). Not a build blocker — but update when convenient: System Settings → Software Update, or `sudo rm -rf /Library/Developer/CommandLineTools && sudo xcode-select --install` | — |
| Docker | **NOT required.** We run against the hosted Supabase project; migrations push remote via CLI. Local Supabase stack (needs Docker) is optional later. | — |

## 2. Accounts & dashboard setup (45 min, mostly clicking)

**Supabase** (free tier): create project (region near you) →
- Save: project ref, Project URL, anon key, service_role key, DB password.
- Dashboard → Database → Extensions: enable `pg_cron` and `pgcrypto` (B5 auto-release; do it now so B5 doesn't stall).
- Auth → providers: Email enabled (default). Built-in auth emails are fine for alpha (low rate limits — OK for 24 users; custom SMTP is a post-alpha item).

**Stripe** (sandbox only until launch): create account →
- **Create a Sandbox** (dashboard environment switcher, top left) and do everything below inside it — a sandbox is fully isolated (own keys, webhooks, Connect config), so an agentic mistake can at worst trash something you can delete and recreate. Classic shared test mode is the fallback if sandboxes aren't available on your account.
- Save the sandbox's `pk_test_…` publishable key and `sk_test_…` secret key (optionally a restricted key scoped to PaymentIntents/Transfers/Connect — safer still).
- **Enable Connect inside the sandbox**: Connect → set up → Express accounts → complete the platform profile questionnaire (required before Connect works — do it now; also complete it on the main account at some point, since that's the one with review lag before launch).
- Webhook signing secret comes later from `stripe listen` during B5 — nothing to save today.
- **Live keys: never during the build.** They appear only at the B8 LAUNCH.md cutover, entered by you directly into Vercel env settings — never into `.env.local`, never into a Claude Code session. `stripe login` for the CLI: log into the sandbox context.

**PostHog** (free cloud): create project → save Project API key + host (us/eu). Used from B4.

**Sentry** (free): create Next.js project → save DSN. Used in B8 — can defer, listed for completeness.

**Vercel**: account + link the GitHub repo (deploys can wait until after B1; linking early costs nothing).

**Deferred on purpose — do NOT set up now:** PayPal (beta, per payments decision), ID-verification provider (Stripe Identity/Persona — B1 ships a feature-flagged placeholder), shipping APIs, custom SMTP, Apple/Google auth.

## 3. Key & env-var matrix

`.env.local` (gitignored; B0 creates `.env.example` with these names, values blank):

```
NEXT_PUBLIC_SUPABASE_URL=          # Supabase → Settings → API
NEXT_PUBLIC_SUPABASE_ANON_KEY=     # same page (safe for client)
SUPABASE_SERVICE_ROLE_KEY=         # same page — SERVER ONLY, never NEXT_PUBLIC
SUPABASE_DB_PASSWORD=              # project creation (CLI migrations)
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=# Stripe → Developers → API keys (test)
STRIPE_SECRET_KEY=                 # same page — sk_test only until launch
STRIPE_WEBHOOK_SECRET=             # from `stripe listen` output, B5
NEXT_PUBLIC_POSTHOG_KEY=           # PostHog project settings (B4)
NEXT_PUBLIC_POSTHOG_HOST=          # e.g. https://us.i.posthog.com
SENTRY_DSN=                        # B8
```

Handling rules (also enforced in CLAUDE.md): keys live only in `.env.local` and GitHub Actions secrets; Claude Code is instructed to never print, commit, or hardcode them; anything named `service_role` or `sk_` never gets a `NEXT_PUBLIC_` prefix.

**GitHub Actions secrets:** none required initially — CI runs typecheck/lint/unit and non-live Playwright specs against dummy env values. E2E specs needing live Supabase/Stripe are tagged `@live` and skipped in CI (run locally in the verify gate). Add CI secrets only if/when you want full e2e in CI.

## 4. Claude Code configuration

**MCP — exactly one server, project-scoped** (run inside the repo after B0 creates it, or add to `.mcp.json`):
```
claude mcp add playwright -- npx @playwright/mcp@latest
```
Skip Supabase/Stripe MCPs deliberately — the CLIs are more deterministic, and every extra MCP is context overhead on every session.

**Permissions:** B0 now writes `.claude/settings.json` allowlisting the routine commands (`pnpm *`, `git *`, `supabase *`, `stripe *`, `npx playwright *`) so sessions don't stall on approval prompts; anything outside the list still asks. Review that file once after B0 — it's your blast-radius control.

**Design folder:** confirm `/Users/tonyg/Desktop/Secondhand fashion design system` exists and contains the exports (B0 copies it into the repo; after that the Desktop copy is no longer read).

## 5. Preflight script — run this; all green = go

```bash
node -v && pnpm -v && git --version
claude doctor
supabase projects list        # logged in, project visible
stripe config --list          # logged in (test mode)
ls "/Users/tonyg/Desktop/Secondhand fashion design system" | head
# in Claude Code, inside the (empty) repo folder:
#   /model  → confirm fable or opus available
#   /mcp    → after `claude mcp add playwright`, shows playwright connected
```

Manual dashboard checks: Supabase pg_cron enabled · Stripe Connect platform profile complete · GitHub repo exists · keys pasted into a local note ready for `.env.local` (B0 asks for them once).

## 6. What changed in BUILD_PROMPTS.md because of this checklist
- Everything standardized on **pnpm** (runner script included — was npm).
- B0 additionally creates `.env.example`, `.claude/settings.json` allowlist, and tags live-service e2e specs `@live` (CI skips them; local verify runs them).
- B5 assumes pg_cron already enabled (checklist item) and uses `stripe listen` for the webhook secret.
- Part 4 session ritual now starts with "preflight passed?" on day one.
