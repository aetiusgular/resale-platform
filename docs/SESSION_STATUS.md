# Session status — build backlog complete (2026-08-02)

> **Update 2026-08-12 — G10 (moderator-gated Legit Check) built on `feat/moderator-lc`.**
> General comments removed entirely; Legit Check is now moderators-only with 3-recommendation
> auto-promotion + an auto-auth bot seam. Migration `0036`. Pending native verify + gates —
> see docs/HANDOFF.md §G10. This supersedes the general-comments/seller-toggle behavior
> described in the B7 community layer.

**Branch:** `feat/recs-integration` · **Suite:** `pnpm verify` green — 0 tsc errors,
**328 unit tests**, 6 pre-existing eslint warnings (non-blocking; see bottom).

This session closed out the entire **cloud-verifiable** build backlog (bucket 1 + bucket 2).
Everything below is behind a feature flag, **default off**, so it is safe in production until
each flag is turned on. Every phase was committed separately and its migration pushed to the
remote DB (migrations `0023`–`0033` are live).

---

## Shipped this session

| Feature | What it does | Flag (env) | Migrations |
|---|---|---|---|
| **G2 notifications** | in-app + email (Resend) + web-push (VAPID), per-category prefs | `NOTIFICATIONS_ENABLED` | 0026 |
| **G4 Persona IDV** | hosted ID-verification flow + signed webhook + status; **tested live** | `VERIFICATION_ENABLED` | 0027 |
| **Branch 4 L2 — collusion hold** | capture Stripe card/bank fingerprints; pre-payout hold on buyer≈seller match | `COLLUSION_HOLD_ENABLED` | 0028 |
| **Branch 4 L1 — phone gate** | Twilio Lookup VOIP block + Verify OTP + one-number-one-account | `PHONE_VERIFICATION_ENABLED` | 0029 |
| **1f tier dashboards** | Buying/Selling Power in settings + 14-day expiring-volume warning | `TIER_DASHBOARD_ENABLED` | — |
| **1f expiry push** | daily cron warns users whose activity is about to drop a tier | `NOTIFICATIONS_ENABLED` | — |
| **Moderation console — held payouts** | collusion queue with **Release payout** (issues transfer) | (admin-only, always on) | — |
| **Escrow refund / clawback** | admin `released→refunded` **only** when funds still in escrow (no transfer yet) | (admin-only) | 0030 |
| **G8 saved-search dispatch** | on listing approval, alert users whose saved search matches | `SAVED_SEARCH_ALERTS_ENABLED` | 0031 |
| **G5 authentication badge** | high-value/flagged → review queue; admin Authenticate/Reject; badge + browse filter | `AUTH_BADGE_ENABLED` | 0032 |

Also live from earlier bucket-1 work: `BUMP_ENABLED`, `FOLLOWS_ENABLED`, `REVIEWS_ENABLED`
(migrations 0019/0020/0022/0023/0024/0025), prohibited-items scan (always on), ban enforcement.

Test count over the session: **241 → 314**.

---

## To actually turn a feature ON (per feature: flag + creds)

- **G2 email/push:** `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `VAPID_PUBLIC_KEY`,
  `VAPID_PRIVATE_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY` (+ `NOTIFICATIONS_ENABLED=true`).
- **G4 Persona:** `PERSONA_TEMPLATE_ID`, `PERSONA_ENVIRONMENT_ID`, `PERSONA_WEBHOOK_SECRET`
  (+ `VERIFICATION_ENABLED=true`). Proven end-to-end already.
- **Branch 4 L1 Twilio:** `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`,
  `TWILIO_VERIFY_SERVICE_SID` (+ `PHONE_VERIFICATION_ENABLED=true`). Needs a **paid** Twilio
  account — the current free-trial model gates Verify/Lookup behind a ~$20 upgrade.
- **Branch 4 L2 collusion:** `COLLUSION_HOLD_ENABLED=true` (uses the live Stripe keys).
- **Crons** (`/api/cron/process-transfers`, `/api/cron/tier-expiry`): `CRON_SECRET` +
  a scheduler entry (there is no `vercel.json` yet — see follow-ups).

---

## Standing gates before any of this touches live money/users

- **db-guard** on migrations `0028`–`0032` (collusion, phone, escrow-refund state machine,
  notification alerts, authentication).
- **code-reviewer** on the money paths: release-hold + escrow-refund (`transition_order`
  `released→refunded` edge), collusion hold.
- **ui-verifier** on the moderation console and the browse page/filter.

---

## What remains (all external-infra or founder work — none cloud-verifiable here)

### 💵 Fee Model v3 (2026-08) — IN PROGRESS
✅ **Core fee math (live money code, verified: tsc green + 24 fee tests pass).** Zero buyer
   fee; seller-only tiers **8% → 7% ($3k/3 orders) → 5.5% ($10k/10) → 3.5% ($25k/15)** (both-gates
   kept); **sub-$100 orders capped at 5%** (`effectiveSellerBps`, elite keeps lower); $0.30 floor;
   seller rate inclusive of Stripe/PayPal. `orderAmountsAt` now `(price, sellerBps, shipping?,
   buyerDiscount?)` → zero buyer fee + platform-funded discount. Updated: `lib/fees.ts`,
   `fees.test.ts`, checkout route + preview, listing detail, order-buyer display.
✅ **B. Buyer milestone rewards** — `lib/rewards.ts` (+ pure `rewards-core.ts`, 6 tests): one-time
   5/10/15% coupon (cap $50/$150/$300) at $1k/$5k/$10k rolling-year, re-earnable yearly. Issued on
   order settlement (all 3 completion paths), reserved+applied at checkout (platform-funded via
   `orderAmountsAt` discount), redeemed on webhook success, restored on failure. Flag `BUYER_REWARDS_ENABLED`.
✅ **C. Elite seller program** — `lib/seller-program.ts`: trailing gross sales > $25k atomically flips
   `profiles.elite_program_eligible` (once) + notifies the seller (`elite_program` event). Wired into
   all 3 settlement paths. Admins are also alerted (`admin_elite_lead` → every role='admin'
   profile) so the outreach lead surfaces, not just the seller's congrats notice.
✅ **D. Boosted posts** — `lib/boosts.ts` (5 tests), `boosts` table, `/api/boosts` purchase (standalone
   Stripe PI, 100% platform revenue), webhook activation (`kind:'boost'` → `listings.boosted_until`),
   browse promotion via pure `applyBoostOrder` (≤2/page, "PROMOTED" badge), seller `/boost/[listingId]`
   Stripe page + owner CTA. Packages 3-day $6 · 7-day $12 · 14-day $20. Flag `NEXT_PUBLIC_BOOSTED_POSTS_ENABLED`.
   Migration `20240101000034_fee_v3_rewards_boosts.sql`. NOTE: no "PROMOTED" badge on browse
   (boosted listings float silently to the top so buyers aren't dissuaded). Expiry sweep is
   SELF-SCHEDULED in-repo via **pg_cron** (`expire_boosts()`, migration 0035, hourly) — no
   external scheduler needed, matching auto_release/checkout-cleanup. `GET /api/cron/boost-expiry`
   (CRON_SECRET) is an optional on-demand trigger over the same SQL function. (By contrast
   `process-transfers`/`tier-expiry` are HTTP + externally scheduled since they call Stripe / the
   notify system — registering those remains a founder task.)


1. **Recs G1 — Cloud Run hosting (deploy layer BUILT) + resale wiring (TODO).**
   The engine is a distributed system (2 HTTP services + 4 Redis-Streams workers + Redis +
   Qdrant), so it needs real managed infra — a laptop `docker run` on the browse hot path
   (1.5 s fail-soft timeout) would fall over. **Decision: Google Cloud Run** (App Runner is
   retiring 30 Apr 2026; Azure Container Apps is the equivalent-not-chosen).
   ✅ *Built this session* in `recs-engine/ops/cloudrun/`: a role-dispatch `entrypoint.sh`
   (one image → api | feed | worker-all | provision, binds `$PORT`, compose still works),
   Cloud-Run `Dockerfile`, `deploy.sh` (api/feed **services**, `worker-all` **worker pool**,
   provision **job**, GCS-FUSE archive volume), `env.example`, and a full `README.md` runbook.
   ⏳ *Founder infra*: create Upstash Redis + Qdrant Cloud, set 4 Secret-Manager secrets,
   `./ops/cloudrun/deploy.sh all`, then set `RECS_INGEST_URL`/`RECS_FEED_URL` (the two
   `*.run.app` URLs) + matching token/HMAC in Vercel and flip `RECS_ENABLED=true`.
   🟡 *Resale-side wiring (the "5 steps")*: ✅ **feed→browse** (`lib/recs/rank.ts`
   `applyFeedOrder` reranks the unfiltered first page from `getFeed`, fail-soft) and
   ✅ **event→ingest** telemetry (`lib/recs/telemetry.ts`: uuidv7 envelopes, batching,
   sendBeacon, impression observer → `/api/recs/events`; wired into browse for impressions,
   clicks, saves, search; gated by `NEXT_PUBLIC_RECS_ENABLED`) are built + unit-tested.
   ✅ **listing lifecycle → index** (`lib/recs/sync.ts` via `after()`: `created` on
   approve→active, `sold` on the Stripe webhook, `deleted` on moderation remove) — this is
   what gives the feed something to rank.
   ⏳ Still to wire: **identity merge** on login (`mergeIdentity` device→account) and
   **cold-start seed** at onboarding (`seedUser`); deeper **feed-native pagination** (the
   rerank only reorders the fetched page); and a one-time **backfill** of already-active
   listings when RECS flips on (re-approve, or `recs-engine/scripts/backfill.py`) — new
   approvals index automatically, but pre-existing active listings won't until backfilled.
   (No listing edit/delete routes exist yet; wire `updated`/`deleted` there when added.)
   ⚠️ *Quality gate*: engine runs on a **stub encoder** — validates infra end-to-end but recs
   aren't semantic until fashion-CLIP is exported to ONNX and mounted (runbook "Going live").
   Interim cost ≈ $15–40/mo (always-on worker pool + warm feed).

2. **G3 carrier delivery webhook** — shipped→delivered from a carrier (EasyPost/Shippo) to
   feed 3-day auto-release. Tracking capture is done; the webhook is not.
3. **L1b device fingerprinting** — deferred; needs a platform decision (native app vs. a
   probabilistic service like FingerprintJS). Web browsers can't read IMEI/MAC.
4. **Founder / compliance:** Stripe **live** cutover; **sales tax / marketplace-facilitator**
   (Stripe Tax); **1099-K** config; **entity + Terms of Service + Privacy Policy**; clear
   buyer-fee disclosure at checkout.
5. **Security PA backlog (B8):** in-memory rate limiter → pg-based; nonce-based CSP (drop
   `unsafe-inline`); `images[]` URL allowlist; UUID validation on admin path params;
   `generate_member_codes` search-path qualification.

### Small follow-ups (trivial, flagged during the build)
- **Detail-page auth badge** — the card badge is done; add `authentication_status` to the
  listing-detail select + a badge now that `0032` types exist (was skipped to keep tsc green
  before the type regen).
- **Cron scheduling** — register `/api/cron/tier-expiry` (daily) with the `CRON_SECRET`
  Bearer header wherever `process-transfers` is scheduled.
- **Saved-search scale** — dispatch scans up to 5,000 saved searches per approval and logs
  if it hits the cap; move to a DB-side match before beta.

---

## Recurring operational notes (from this session)

- **`supabase gen types` → `Unauthorized`:** a stale/placeholder `SUPABASE_ACCESS_TOKEN` is
  exported in the shell. Fix: `unset SUPABASE_ACCESS_TOKEN && npx supabase login`, then regen.
  Note the `>` redirect truncates `types.ts` to empty *before* the command runs, so a failed
  regen leaves a 0-byte file — always `wc -l` after.
- **`db push` "failed to cache migrations catalog" (pg-delta cert):** cosmetic — each
  migration still shows `Applying…` and finishes. Only the post-push catalog cache needs
  Docker running; the migration itself lands.
- **`tsconfig.tsbuildinfo`** keeps showing as modified — it's a build artifact; consider
  `git rm --cached tsconfig.tsbuildinfo` + add to `.gitignore`.
- The 6 eslint warnings are pre-existing (3× `set-state-in-effect` in checkout/community,
  3× `<img>` → `next/image` on checkout/order pages) — worth a cleanup pass, not launch-blocking.


## Security hardening (added this session)
**Security PA backlog (B8) — DONE this session:** `images[]` URL allowlist at the store step
  (lib/security/image-url, shared with the SSRF guard); in-memory → **pg-based rate limiter**
  (atomic check_rate_limit RPC, migration 0033 — the old counter was per serverless instance);
  **UUID validation** on all 7 admin path-param routes (lib/security/uuid); **nonce-based CSP**
  in middleware (dropped script-src `'unsafe-inline'`; style-src keeps it for React inline
  styles) — header + prod-build browser smoke-test verified. `generate_member_codes` search-path
  was already fixed in migration 0015. **This backlog is now cleared.**
