# B1 RESUME — finish verification and close out (previous session hung)

CONTEXT: A prior headless session implemented most of B1 (auth, invite gate,
onboarding flow, migrations, specs) but HUNG during verification and was
killed. All work is on disk, uncommitted (15 files: app/enter/, app/onboarding/,
app/api/, middleware.ts, lib/, scripts/, two migrations, tests/e2e/auth*.spec).
Original spec: prompts/B1.md. Read it plus CLAUDE.md and docs/HANDOFF.md first.

YOUR JOB — assess, complete, verify, close:
1. Read the uncommitted diff (git status/diff) and prompts/B1.md; identify
   what's done vs missing. Do NOT rewrite working code.
2. Check migrations state: pnpm exec supabase migration list (export
   SUPABASE_ACCESS_TOKEN + SUPABASE_DB_PASSWORD by parsing .env.local inline,
   never echo). Push unapplied migrations: pnpm exec supabase db push --yes
   (ignore Docker catalog-cache warnings).
3. Complete anything missing from B1.md TASKS.
4. VERIFY per B1.md. ANTI-HANG RULES (the last session died here — obey
   strictly): NEVER run watch mode or a foreground dev server; playwright
   starts/stops the app itself via webServer config with reuseExistingServer
   false and a 120s timeout; every bash command you run must have bounded
   runtime (use `timeout 300 <cmd>` wrappers for test/build commands);
   vitest with `run` (never watch); if a command exceeds its timeout, kill,
   diagnose from its partial output, fix, retry once — if it hangs twice,
   record in HANDOFF and mark B1 BLOCKED rather than waiting.
5. code-reviewer subagent pass on the full diff (auth — mandatory).
6. FINISH per B1.md: ROADMAP + HANDOFF updates, conventional commit,
   10-line summary ending "B1 COMPLETE — GATE GREEN" or "B1 BLOCKED: <reason>".

RUN CONTEXT: .env.local exists — never print or commit it. Do not push to
GitHub. Build UI only from design-reference/Onboarding.dc.html + /styleguide
tokens (already the case for existing files — preserve that).
