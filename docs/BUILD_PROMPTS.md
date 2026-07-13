# BUILD_PROMPTS.md
### Sequential Claude Code prompts: infra + backend, integrated with the Claude Design exports
**Prerequisite: SETUP_CHECKLIST.md fully green before B0.** Package manager is pnpm everywhere.
Design source: `/Users/tonyg/Desktop/Secondhand fashion design system` (read by Claude Code, copied into the repo in Prompt B0).
Companion docs (copy into repo `docs/` during B0): PROJECT_PLAN.md · FEATURE_SET.md · USER_FEEDBACK.md · business-models.md · DESIGN_PROMPTS.md · SETUP_CHECKLIST.md.

---

## Part 1 — Operating model (read once, then it runs itself)

**Model routing (token discipline):**
- **Fable/Opus = thinking, Sonnet = typing.** Start each session in Plan Mode (`shift+tab` twice) with `/model fable` (fall back to `opus` if fable isn't offered in Claude Code) to produce/approve the plan. Then `/model sonnet` for execution. Never let an expensive model write boilerplate; never let sonnet make architectural decisions — those come from the approved plan.
- Subagents carry their own models (defined in B0): `code-reviewer` (opus, read-only), `db-guard` (sonnet, read-only), `ui-verifier` (sonnet, playwright-only). Explore-type searches default to haiku — cheap.
- Token rules baked into CLAUDE.md: read ONLY files whitelisted per prompt; use subagents for exploration instead of dumping files into main context; never cat entire directories; design PNGs viewed one at a time, only when implementing that screen.

**The per-prompt loop (this is your "deliberate on its own" mechanism):**
Every build prompt Bn ends with the same mandatory epilogue — VERIFY → RECORD → DECIDE:
1. **VERIFY:** run `npm run verify` (typecheck + lint + unit tests) then `npm run verify:ui` (Playwright specs + screenshot pass against the design reference). Fix until green. The ui-verifier subagent does the Playwright pass so screenshots don't flood main context.
2. **RECORD:** update `docs/ROADMAP.md` (check the milestone) and rewrite `docs/HANDOFF.md` — current state, what's done, what's next, known issues, exact next prompt ID. HANDOFF.md is the session-portable brain; chat memory is never the source of truth.
3. **DECIDE:** self-assess context usage. If the session has done heavy file reading/edits (rule of thumb: one full build prompt = one session), END by printing exactly: `HANDOFF COMPLETE → start a fresh session and run: B<n+1>`. Only continue in-session if the prompt was trivially small. A fresh session re-hydrates from CLAUDE.md + HANDOFF.md in <2k tokens.

Claude Code can't literally open its own new chat window in interactive mode — the DECIDE step makes it *tell you* when to. If you want true hands-off sequencing, use the autopilot runner (Part 3): each prompt runs as its own `claude -p` process = guaranteed fresh context per prompt, with the verify gate deciding whether the next prompt fires.

**Playwright:** two layers, deliberately. Deterministic Playwright *specs* (`tests/e2e/`) gate every prompt in CI and in `verify:ui`. The Playwright *MCP* (`claude mcp add playwright -- npx @playwright/mcp@latest`) is for the ui-verifier's visual comparison against `design-reference/` exports and for debugging failures interactively.

---

## Part 2 — The prompts (one session each; paste verbatim)

### B0 — Bootstrap: repo, context layer, design integration
```
PLAN FIRST (Plan Mode, /model fable), then execute on /model sonnet.

GOAL: a deployable skeleton with the entire context layer, design tokens extracted
from the real design exports, and the verification harness working end to end.

TASKS:
1. Init: Next.js 15+ (App Router, TS strict) + Tailwind + Supabase JS + pnpm.
   Vercel-ready. Git init, first commit.
2. Design integration:
   a. Copy "/Users/tonyg/Desktop/Secondhand fashion design system" into
      repo at design-reference/ (never imported by app code — reference only).
   b. Export format (verified): screen exports are HTML (*.dc.html — Browse
      Results, Checkout & Orders, Create Listing, Listing Detail, Messages,
      Onboarding, Seller Profile, Settings) plus tokens/, components/,
      ui_kits/, styles.css, guidelines/. Inventory and write docs/DESIGN_MAP.md:
      one row per .dc.html — file → screen → route → build prompt that uses it.
      Prefer extracting tokens from tokens/ + styles.css over re-deriving them;
      the ui-verifier can open the .dc.html files directly in Playwright for
      side-by-side comparison with live routes.
   c. Extract the token system into code: tailwind.config tokens for
      --bg #FFFFFF, --ink #111111, --ink-soft #6B6B6B, --line #E5E5E5,
      --accent #1B4332, --alert #B3261E; fonts via next/font/google:
      Inter (UI), EB Garamond (serif moments), Space Mono (all listing data);
      type scale 12/14/16/20/28/40; 2px radius; 8px grid. Build /styleguide
      route rendering all tokens + the listing-card component skeleton.
3. Context layer: copy the five companion docs into docs/. Write CLAUDE.md
   (<150 lines) containing: stack versions; the token rules from Part 1;
   "prices are integer cents"; "every table ships with RLS in the same
   migration"; "getUser() never getSession() for authz"; "money-state changes
   wrapped in DB transactions, driven by webhooks"; the VERIFY→RECORD→DECIDE
   epilogue as a non-negotiable session protocol; model-routing note.
4. Agents: create .claude/agents/code-reviewer.md (model: opus; read-only:
   Read/Grep/Glob; reviews diffs for RLS coverage, authz, payment correctness —
   MUST be invoked before committing any code touching auth, money, or RLS),
   db-guard.md (model: sonnet; read-only; reviews every migration for RLS,
   indexes, cascade behavior), ui-verifier.md (model: sonnet; tools: playwright
   MCP + Read; loads a route, screenshots at 1440px and 375px, compares against
   the mapped file in design-reference/ per docs/DESIGN_MAP.md, reports
   deviations as a checklist — tokens, spacing, fonts, missing elements).
5. Harness: scripts pnpm verify (tsc --noEmit, eslint, vitest) and
   pnpm verify:ui (playwright test); playwright installed
   (pnpm exec playwright install chromium) with one smoke spec (styleguide
   renders, three fonts present — assert computed font-family). Live-service
   e2e specs are tagged @live: GitHub Actions runs verify + non-@live
   verify:ui with dummy env values and NO secrets; @live specs run only in
   the local verify gate. Seed docs/ROADMAP.md (milestones B1–B8 unchecked)
   and docs/HANDOFF.md.
6. Env + permissions: create .env.example with the exact variable names from
   docs/SETUP_CHECKLIST.md §3 (values blank), gitignore .env.local, then ask
   me to paste real values into .env.local myself — NEVER write, print, or
   commit key values. Create .claude/settings.json allowlisting: pnpm *,
   git *, supabase *, stripe *, npx playwright *.
7. Supabase: add the CLI as a devDependency (pnpm add -D supabase; invoke as
   pnpm exec supabase — it is NOT installed globally on this machine), link
   the hosted project (ref from env; no Docker/local stack), confirm pg_cron +
   pgcrypto extensions are enabled (checklist item — fail loudly if not),
   initial migration: profiles table + RLS, pushed remote.

ACCEPTANCE: pnpm build green · /styleguide matches design-reference typography
(ui-verifier pass) · verify + verify:ui green · CI green · DESIGN_MAP.md covers
every export file.
Then: VERIFY → RECORD → DECIDE.
```

### B1 — Auth + invite gate (M1)
```
READ ONLY: CLAUDE.md, docs/HANDOFF.md, docs/PROJECT_PLAN.md (M1),
docs/DESIGN_MAP.md rows for the invite/onboarding screens + those exports.
PLAN FIRST (fable), execute on sonnet.

TASKS: Supabase email auth (@supabase/ssr, middleware using getUser());
invite_codes table (code, generated_by, used_by, status) + redemption RPC —
atomic, single-use, case-insensitive; middleware gate: no session → /enter,
session without redeemed code → /enter (code entry + waitlist email capture);
signup flow per the onboarding design: code → account → ID-verification
placeholder step (store status enum unverified/pending/verified on profiles;
wire real provider later — feature-flag it) → quick-setup (sizes/address
skippable stubs) → three generated invite codes screen; codes table seeded
with 30 founder codes via script.

BUILD THE UI from the design exports mapped in DESIGN_MAP.md — match tokens
exactly; no new colors or components not in the exports.

ACCEPTANCE (Playwright specs, not manual): unauthenticated hit on / redirects
to /enter · bad code shows the designed error state · good code → signup →
lands on codes screen showing 3 codes · reused code rejected · verify +
verify:ui green · code-reviewer pass (auth touched).
Then: VERIFY → RECORD → DECIDE.
```

### B2 — Listings + curation queue (M2)
```
READ ONLY: CLAUDE.md, docs/HANDOFF.md, PROJECT_PLAN.md (M2), FEATURE_SET.md §4,
DESIGN_MAP.md rows for sell-flow + listing-detail screens + those exports.
PLAN FIRST (fable), execute on sonnet.

TASKS: listings schema (id, seller_id, title, brand, category, size,
condition_score 1–10, condition_notes jsonb, price_cents int, images text[],
status enum draft/pending_review/active/sold/removed, possession_photo_url,
timestamps) + RLS (public reads active only; seller CRUD own; admin all) —
db-guard reviews migration. Image upload to Supabase Storage: 6 labeled slots
per the design (FRONT/BACK/TAG/DETAIL/FLAW/POSSESSION), client resize to
max 2000px, jpeg. 4-step sell flow exactly per design export (rubric selector,
live 2% fee math from a single fees.ts constant). Admin queue at /admin
(role-gated via profiles.role): pending list, approve/reject with reason,
rejection reason surfaces to seller. Listing detail page per design: gallery,
purchase panel, TRUST STRIP, seller block — comments/LC section rendered as
placeholder module marked B7.

ACCEPTANCE: e2e spec walks list → pending → admin approve → visible on detail
page · RLS spec proves draft/pending listings invisible to other users (test
via second supabase client) · fee math unit-tested (odd cents, min/max) ·
ui-verifier compares sell flow + detail page against exports · code-reviewer
pass. Then: VERIFY → RECORD → DECIDE.
```

### B3 — Anti-slop layer (M3)
```
READ ONLY: CLAUDE.md, docs/HANDOFF.md, PROJECT_PLAN.md (M3), USER_FEEDBACK.md §3.
PLAN FIRST (fable), execute on sonnet.

TASKS: perceptual hashing on upload (sharp + blockhash/phash in an API route or
edge function): store per-image hash; on submit, hamming-distance check against
existing active/pending listings across ALL accounts → flag duplicates into the
admin queue with a side-by-side diff view; title/tag brand-stuffing lint
(brand-name count heuristic + blocked-pattern list in config) → warning at
submit, flag at review; possession-photo required server-side (not just UI);
listing velocity rate limit (config: N listings/day for accounts <30 days old).
No external CV APIs yet — heuristics only, keep it cheap.

ACCEPTANCE: unit tests — identical image set re-upload flagged, near-duplicate
(re-encoded/resized) flagged, distinct images pass · brand-stuffing fixture
cases · e2e: duplicate submission lands in admin queue with diff view ·
code-reviewer pass. Then: VERIFY → RECORD → DECIDE.
```

### B4 — Browse + search (M4)
```
READ ONLY: CLAUDE.md, docs/HANDOFF.md, PROJECT_PLAN.md (M4), FEATURE_SET.md §1,
DESIGN_MAP.md rows for browse screens (desktop rail + mobile drawer) + exports.
PLAN FIRST (fable), execute on sonnet.

TASKS: browse page per design — left filter rail (MY SIZES toggle reading
profile sizes, collapsible sections with live counts via grouped queries,
monochrome chips, CLEAR ALL), sort (newest/price/most saved), Postgres
full-text search (tsvector on title+brand+description, GIN index), pagination
(cursor, LOAD MORE), favorites (saves table + count), price-drop re-ranking
(price_history table; drop badge per design), empty state per design, mobile
filter drawer per design. SSR for listing + browse routes (SEO is a launch
asset — verify meta/OG tags render server-side). PostHog: pageview +
product_clicked + filter_applied events (env-flagged off in dev).

ACCEPTANCE: e2e — filter by size+condition returns seeded fixtures correctly,
follow-search UI stub records row, favorites toggle persists · SSR spec:
curl (no JS) returns listing title in HTML · ui-verifier vs browse exports
at both breakpoints · lighthouse budget: browse LCP < 2.5s local.
Then: VERIFY → RECORD → DECIDE.
```

### B5 — Checkout + escrow + seller protection (M5 + M5b)
```
READ ONLY: CLAUDE.md, docs/HANDOFF.md, PROJECT_PLAN.md (M5+M5b),
DESIGN_MAP.md rows for checkout/order screens + exports. This is the
highest-risk prompt: plan on fable, review EVERYTHING with code-reviewer.

TASKS: Stripe Connect Express seller onboarding (gate first listing
activation on payouts-enabled webhook); checkout: PaymentIntent on platform
account (separate charges & transfers), fee math per fees.ts (2% buyer +
2% seller), saved payment methods (SetupIntent; "use a different card"),
PayPal = UI stub only, disabled, labeled beta; orders table + state machine
(paid_held → seller_confirmed → shipped(tracking) → delivered(carrier
webhook or manual admin override) → released | disputed → frozen) — every
transition webhook-driven, idempotent (event id dedupe), wrapped in a DB
transaction, audit-logged to order_events; auto-release: pg_cron (or
scheduled edge function) releases 3 days post-delivery unless dispute row
exists; dispute: buyer opens within 72h of delivery, requires ≥1 photo,
freezes auto-release, admin resolve → release or refund; buyer + seller
order-status pages per design (timeline, auto-release countdown, buyer-record
row on seller view, PROTECTED card). pg_cron is already enabled per
SETUP_CHECKLIST (fail loudly if not, don't work around it). Stripe test mode
with `stripe listen --forward-to localhost:3000/api/webhooks/stripe` — take
STRIPE_WEBHOOK_SECRET from its output into .env.local (I paste it, you don't
write it); document the workflow in docs/STRIPE_TESTING.md. Tag all
live-Stripe specs @live.

ACCEPTANCE: e2e in Stripe test mode — full happy path buy → confirm →
transfer created with correct split (assert amounts in cents) · refund path ·
dispute freezes auto-release (time-travel the cron check in test) · webhook
replay is idempotent (same event twice = one transition) · RLS: buyers/sellers
see only their own orders · code-reviewer AND db-guard pass mandatory.
Then: VERIFY → RECORD → DECIDE.
```

### B6 — Chat + offers (M6)
```
READ ONLY: CLAUDE.md, docs/HANDOFF.md, PROJECT_PLAN.md (M6), DESIGN_MAP.md
rows for messages/offers screens + exports.
PLAN FIRST (fable), execute on sonnet.

TASKS: conversations + messages tables (RLS: participants only), Supabase
Realtime subscription, thread UI per design (pinned listing bar, counterparty
record line — purchases/disputes/pay-speed from a buyer_stats view); offers
table + state machine (open → accepted/declined/expired/countered; 24h
acceptance expiry, 24h pay-or-void with strike written to buyer_stats);
accepted offer → checkout session at offer price reusing B5 flow (saved
method line per design); link/payment-redirect blocking: regex + domain
blocklist on message insert (server-side), blocked content stored redacted
with system line per design; consent flags on conversation for dispute
transcript reference.

ACCEPTANCE: e2e — offer → counter → accept → pay at offer price via saved
card · expiry job voids unpaid accepted offer + records strike (time-travel
in test) · message containing paypal.me link stored redacted + system line
rendered · realtime: second client receives message without reload ·
RLS spec: non-participant cannot read thread · code-reviewer pass.
Then: VERIFY → RECORD → DECIDE.
```

### B7 — Community layer (M7)
```
READ ONLY: CLAUDE.md, docs/HANDOFF.md, PROJECT_PLAN.md (M7 + D2),
USER_FEEDBACK.md §4, DESIGN_MAP.md rows for listing-page community section.
PLAN FIRST (fable), execute on sonnet.

TASKS: comments table (listing_id, author, body, thread_type enum lc/general,
status) with RLS: INSERT requires profiles.id_verified = true AND rate limit
(new accounts: 2/day — enforce server-side via count check in RPC, not client);
LC thread: posting gated to verified_checker role OR tier >= gold (tier column
stub on profiles until reputation automation); pinned checker verdict support;
seller toggle comments_enabled per listing (LC thread cannot be disabled);
same link-blocking pipeline as B6; vouch/flag actions table (agree/flag) with
collusion breadcrumbs (log actor pairs); replace the B2 placeholder module on
listing page with the real tabbed section per design.

ACCEPTANCE: e2e — unverified account sees disabled input with helper text ·
verified account posts · 3rd comment same day from new account rejected
server-side · seller toggle hides general tab but LC tab persists · flagged
comment enters admin queue · code-reviewer pass (RLS + rate limits).
Then: VERIFY → RECORD → DECIDE.
```

### B8 — Analytics, hardening, alpha polish (M8)
```
READ ONLY: CLAUDE.md, docs/HANDOFF.md, PROJECT_PLAN.md (M8), FEATURE_SET.md §6.
PLAN FIRST (fable), execute on sonnet.

TASKS: PostHog dashboards config documented in docs/ANALYTICS.md (listing CTR,
checkout abandonment, time-on-listing; funnel browse→listing→offer/buy);
admin metrics page (listings by status, GMV, disputes, invite-tree depth —
SQL views); error tracking (Sentry free tier); rate limiting on auth + upload
+ comment endpoints (middleware, upstash or pg-based); security pass: run
code-reviewer over the FULL diff since B0 with a written report to
docs/SECURITY_REVIEW.md — every RLS policy, every webhook, every admin gate;
seed script: 24 founder accounts + invite codes from USER_FEEDBACK.md §6
(usernames only, fake emails); production env checklist docs/LAUNCH.md
(env vars, Stripe live-mode steps, Supabase backups, Vercel domains).

ACCEPTANCE: full e2e suite green headless · security report has zero
unresolved criticals · lighthouse: browse + listing ≥90 performance locally ·
seed script idempotent · verify + verify:ui green.
Then: VERIFY → RECORD → DECIDE → print "ALPHA BUILD COMPLETE".
```

---

## Part 3 — Optional autopilot runner (true fresh-context-per-prompt)

For hands-off sequencing, save each prompt above as `prompts/B0.md … B8.md` in the repo, then:

```bash
#!/usr/bin/env bash
# runner.sh — each prompt runs in its OWN claude process (fresh context by construction).
# The verify gate decides whether the next prompt fires. Run from repo root.
set -e
for n in 0 1 2 3 4 5 6 7 8; do
  echo "=== B$n ==="
  claude -p "$(cat prompts/B$n.md)" \
    --permission-mode acceptEdits \
    --allowedTools "Edit,Write,Read,Glob,Grep,Bash,mcp__playwright__*"
  pnpm verify && pnpm verify:ui || { echo "B$n FAILED GATE — stopping."; exit 1; }
  git add -A && git commit -m "B$n complete (gated)"
done
```

Honest caveats before you trust it: run B0 and B1 interactively first — autopilot on an un-proven harness compounds errors instead of catching them; `acceptEdits` still prompts for un-allowlisted bash commands unless you extend `--allowedTools`, which you should do cautiously rather than granting everything; and B5 (money) deserves an interactive session with your eyes on it regardless. The practical pattern most people land on: interactive for B0–B1 and B5, autopilot for the rest.

## Part 4 — Session start ritual (interactive mode)

Day one only: confirm SETUP_CHECKLIST.md §5 preflight is green before anything else.
Every new session, first message: `Read CLAUDE.md and docs/HANDOFF.md, then tell me which prompt is next and your plan for it.` — in Plan Mode on fable. Approve plan → `/model sonnet` → paste the prompt. That's the whole ceremony; HANDOFF.md carries everything else across sessions.
