# Session status — build backlog complete (2026-08-02)

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

1. **Recs G1** — wire the 5 steps against the local `agora/recs-engine` (docker). Dedicated
   on-computer session. `RECS_ENABLED` off; only the HMAC proxy + mapper exist.
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
