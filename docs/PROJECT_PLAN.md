# PROJECT_PLAN.md
### Orchestration plan: from validated concept → working alpha, built agentically with Claude Code
Companion files in this folder: `business-models.md` (revenue research), `USER_FEEDBACK.md` (PMF synthesis), `Resale Marketplace Proposal.pdf` (the doc that generated the feedback).

---

## Part 1 — Assessment of the advice you collected

**What to keep (it's correct):**
- Stack: **Next.js (App Router) + Supabase (Postgres/Auth/Storage/RLS) + Stripe Connect + PostHog + Vercel**, images on Supabase Storage or Cloudflare R2. This is the right zero-cost-to-start, scales-with-you stack. No changes.
- Context files over giant prompts; CLAUDE.md kept short; Explore → Plan → Code → Commit as the working loop; **modal phases instead of nested agents** — all sound.
- Escrow shape (charge buyer → hold → transfer to seller on delivery) and the manual curation queue (`is_approved=false`) — correct and aligned with the feedback.

**What to correct:**
1. **Don't paste that code — regenerate it.** The pasted snippets are scaffolding-grade with real bugs: the SQL is invalid (`code text primary key template` won't run), the listings insert is missing `seller_id` (RLS will reject every insert), `transactions`/`invite_codes` tables have RLS enabled nowhere, the middleware trusts `getSession()` (spoofable — must use `getUser()`), it mixes the deprecated `auth-helpers` package with `@supabase/ssr`, and the checkout hardcodes an 8% fee that contradicts your locked 2%+2%. Treat the snippets as a *spec* of intent; let Claude Code write current, correct versions against up-to-date docs.
2. **The 4-agent architecture is premature for a solo/duo team.** Fixed "TrustAgent/CommunityAgent/FinanceAgent" personas add coordination overhead you don't need at repo-size ~zero. Claude Code's real leverage early is: one main session + plan mode + short-lived task-scoped subagents (explore, code-review, test-run) it spawns itself. Revisit named agents when the codebase is big enough that context is the bottleneck (~15k+ LOC), not before. The "@AgentName" mention syntax from that thread isn't how Claude Code works anyway — subagents live in `.claude/agents/*.md` and are invoked per task.
3. **Stripe compliance detail that matters:** use Separate Charges & Transfers (funds settle to your platform account, transfer on delivery confirmation). Verify current Stripe rules on holding periods during build — don't trust any pasted apiVersion or flow blindly.

## Part 2 — Decisions to lock BEFORE building (Phase 0)

Write answers into `docs/DECISIONS.md` in the repo. Building before locking these = rework.

| # | Decision | Input | Leaning |
|---|---|---|---|
| D1 | Pricing | Feedback says $5 too low; $20/yr "Raya" positioning; 2% each side | $20/yr membership incl. fee-free selling, or 2%+2% — test both in alpha cohorts |
| D2 | Comment system redesign | Fate_archive objection | LC thread (verified checkers only) split from general comments; seller can toggle general comments off; disputes use buyer–seller chat only |
| D3 | Dropshipper policy | Fate_archive, J_.pierre | Proof-of-possession photo (handwritten tag w/ username+date) required; stock-photo detection at review |
| D4 | Name + domain | "working name TBD" | Blocks Stripe/legal/waitlist — decide now |
| D5 | Legal entity + ToS/privacy | Required before real transactions | LLC + template ToS before beta payments |
| D6 | Alpha scope | 24-contact seed list | Invite-only, 3–5 codes/user, manual listing review |

## Part 3 — Repo organization (the context layer Claude Code builds from)

```
repo/
├── CLAUDE.md                  # <200 lines: stack, conventions, loop protocol, "read docs/ first"
├── docs/
│   ├── DECISIONS.md           # locked answers from Phase 0 (D1–D6)
│   ├── USER_FEEDBACK.md       # copied from this folder — the "why" behind every feature
│   ├── ARCHITECTURE.md        # system map: Next.js ↔ Supabase ↔ Stripe ↔ PostHog, data flows
│   ├── DATA_MODEL.md          # tables, relationships, RLS policy intent (prose, not just SQL)
│   ├── ROADMAP.md             # build order below, checkboxes, current status
│   └── FEATURES/              # one spec per feature before it's built (see loop, Part 5)
├── .claude/
│   ├── agents/
│   │   ├── code-reviewer.md   # read-only: security, RLS coverage, payment-path correctness
│   │   └── db-guard.md        # read-only: every migration reviewed for RLS + index coverage
│   └── commands/              # /new-feature, /ship-check slash commands
└── src/ ...
```

CLAUDE.md must include: stack versions; "prices in cents, integers only"; "every table gets RLS before merge"; "no `getSession()` for authz — `getUser()`"; test + typecheck must pass before any commit; update `docs/ROADMAP.md` status at end of every session (persistent state lives in files, not chat).

## Part 4 — Build order (12 weeks to alpha)

Each milestone is shippable and testable on its own. Don't start N+1 until N passes its check.

**M0 — Foundation (wk 1).** Repo init, Next.js + Supabase wiring, CI (typecheck/lint/test on push), deploy pipeline to Vercel, CLAUDE.md + docs/ written. *Check: hello-world deploys green.*
**M1 — Auth + invite gate (wk 1–2).** Signup/login, invite-code tables + redemption, middleware gate, code generation (3–5/user). *Check: can't see anything without a redeemed code.*
**M2 — Listings + curation queue (wk 2–4).** Listing form (guided photo slots incl. proof-of-possession shot), image upload, auto-tag stub, 1–10 condition rubric, admin review queue (approve/reject with reason). *Check: listing goes photo → pending → approved → visible.*
**M3 — Anti-slop layer (wk 4–5).** Perceptual hash on every image at upload; duplicate-set detection across accounts; brand keyword-stuffing lint on titles/tags. This is P0 *because the feedback made it P0* — it ships before payments. *Check: re-uploading the same photo set gets auto-flagged.*
**M4 — Browse + search (wk 5–6).** Feed, filters (brand/size/condition/price), listing page. Simple recency feed now; personalization is post-alpha (P1) but log PostHog events from day one so the data exists. *Check: buyer finds an item in <30s.*
**M5 — Checkout + escrow (wk 6–8).** Stripe Connect Express onboarding for sellers, separate charges & transfers, shipping/tracking entry, delivery confirmation → transfer, dispute freeze state, webhooks. Fee logic per D1. Payments rails decision: alpha is Stripe-only; PayPal added at beta via PayPal Commerce Platform multiparty (auto fee-split + delayed disbursement) — never consumer G&S between users (bypasses fees + escrow; the model old Grailed used and abandoned). Note PayPal multiparty charges processing to the seller while Stripe charges the platform — reconcile with the flat-2% promise wording before beta. Verified constraints: Stripe has no true escrow — the pattern is manual payouts with a **90-day maximum fund hold** (design the dispute flow to resolve well inside that window); all order-state changes driven by webhooks, never checkout redirects; every money-state mutation wrapped in a DB transaction. *Check: full money loop in Stripe test mode incl. refund path.*
**M5b — Seller protection layer (built with M5/M6, policy locked July 2026).** Two-sided trust: funds auto-release 3 days after carrier-scan delivery unless buyer opens an evidence-gated dispute (photos within 72h); seller listing photos archived as swap-scam counter-evidence; ID verification required to buy as well as sell; buyer reputation first-class (purchases, dispute rate, pay speed — separate from seller score, shown to sellers before offer acceptance); accepted offers unpaid after 24h void + strike. *Check: dispute flow cannot hold funds indefinitely; seller sees buyer record pre-acceptance.*
**M6 — Chat + offers (wk 8–9).** Buyer–seller DM (Supabase Realtime), offer/accept/decline, consent-based transcript flag for disputes. *Check: negotiate → accept → checkout at agreed price.*
**M7 — Community layer v1 (wk 9–10).** Per D2: LC thread (verified-checker gated) + general comments (seller-toggleable), tier badges, link/payment-redirect autoblock, new-account rate limits. *Check: unverified account cannot comment anywhere.*
**M8 — Analytics + alpha polish (wk 10–12).** PostHog dashboards (listing CTR, checkout abandonment, time-on-page), session replay, admin metrics page, seed 24 contacts, founding-member onboarding. *Check: you can answer "which listings get clicks but no offers?" from a dashboard.*

Deferred post-alpha: personalization feed (P1, quick note #3), verified legit-checker program formalization, seller storefront pages (Bvug mitigation), AI authentication CV pass (alpha uses manual review — you ARE the CV model at this scale), reputation-tier automation.

## Part 5 — The working loop (how each milestone actually gets built)

Per feature, in Claude Code, always the same cycle:
1. **Spec** — one page in `docs/FEATURES/<name>.md`: purpose (cite USER_FEEDBACK.md line), user flow, tables touched, edge cases, acceptance criteria. Write it with Claude in plan mode; you approve.
2. **Explore** — Claude reads relevant code/docs, no edits.
3. **Plan** — implementation plan + file list + test list; you approve (plan mode).
4. **Code** — implement to the approved plan; tests written alongside.
5. **Verify** — typecheck, lint, tests, manual flow check; `code-reviewer` subagent pass on payment/auth/RLS-touching changes (non-negotiable for M1, M5, M7).
6. **Commit** — small commits, update ROADMAP.md status.

Session hygiene: one milestone-scoped session at a time; start each session with "read CLAUDE.md, docs/ROADMAP.md, and the current feature spec"; end with a status write-back. Never let chat memory be the only place state lives.

## Part 6 — What stays in Cowork vs. Claude Code

- **Cowork (this folder):** strategy docs (this file, business-models.md, USER_FEEDBACK.md), pricing analysis, alpha outreach drafts, landing-page copy, investor/partner one-pagers, feedback rounds 2+.
- **Claude Code (repo):** everything in Part 3–5. First action: copy USER_FEEDBACK.md into the repo's docs/ so build sessions can cite it.

## Part 7 — Immediate next actions (this week)

1. Lock D1–D6 with your cofounder — one sitting, write DECISIONS.md.
2. Pick the name → register domain → create Stripe + Supabase + Vercel + PostHog accounts (all free tier).
3. Reply to the 6 respondents: thank them, tell them what changed because of their input (comment toggle, dropshipper ban, pricing rethink) — this converts feedback-givers into founding members.
4. M0: init the repo with the Part 3 structure; have Claude Code write CLAUDE.md and ARCHITECTURE.md first, before any product code.
5. Start M1.
