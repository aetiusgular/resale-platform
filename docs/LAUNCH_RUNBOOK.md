# LAUNCH_RUNBOOK.md — step-by-step: from today's working tree to live trusted testers

**Written 2026-08-24, current as of G13 (open signup, no invites).** This is the single
ordered path; follow it top to bottom. It consolidates `LAUNCH.md` (env + Stripe cutover),
`LAUNCH_SEQUENCE.md` (flag order), and `LAUNCH_SERVICES.md` (vendors), and **supersedes
their stale bits**, noted inline. Launch model: **open signup, zero promotion** — you hand
the URL to trusted testers directly. No invite system exists anymore.

Legend: 🧑 = founder/human-only step (never delegate). 💻 = terminal on your Mac.
🌐 = dashboard clicks. Every step ends with a verify.

---

## Phase 0 — Close out the working tree (~30 min, 💻)

1. **Regen Supabase types** so `types.ts` matches the post-0041 DB:
   `unset SUPABASE_ACCESS_TOKEN && pnpm exec supabase login`, then your usual
   `pnpm exec supabase gen types typescript --linked > lib/supabase/types.ts` →
   `pnpm verify` still green.
2. **Commit in two pieces:** the already-staged orders-page fix first
   (`git commit -m "fix(orders): fetch listing snapshot via service role after party check"`),
   then `git add -A && git commit` for G13 (migration 0041 + 16 edits + G13 docs +
   ui-verifier tweak ride along).
3. **code-reviewer gate** on the auth diff (middleware, `/api/auth/callback`, `/enter*`,
   `/onboarding/account`, migration 0041) — run it in claude CLI. Fix-forward anything it finds.
4. **`git push`** — clears the backlog (4 e2e commits from 08-18 + everything from today).
   Verify: `git status -sb` shows `## main...origin/main` with no ahead/behind.
5. **If not already done: the decline-retry money test** on a fresh listing (dev, test keys,
   `stripe listen` up): 4000-0000-0000-0002 → decline + `[webhook] payment attempt failed`
   warn → same page 4242 → order page → mark delivered → exactly ONE transfer. This is the
   last money-path gate; do it before strangers' flaky cards do it for you.

## Phase 1 — Founder decisions (🧑, blocking everything user-facing)

6. **Domain: DEFERRED (decision 2026-08-24)** — testing 1–2 weeks on the free
   `<project>.vercel.app` URL. What you pick instead: the **Vercel project name**, since it
   becomes the URL testers see (renaming the project later changes the URL, so pick
   something you can live with; the brand name + real domain come after the test window).
   Wherever this runbook says `yourdomain.com`, substitute `https://<project>.vercel.app`.
7. **Legal: entity + Terms of Service + Privacy Policy.** You hold other people's money in
   escrow — have these exist before real users, even trusted ones. When written, wire the
   About/Terms/Privacy footer links on `/enter` (currently decorative).
8. **Decide: recs engine live on day one, or week two?** Day-one = do Phase 7 before
   Phase 8 (~a day of setup). Week-two = skip Phase 7 now; the feed falls back to default
   order and nothing breaks. With ~24 testers the lost telemetry is small — either is fine.

## Phase 2 — Vendor accounts (🧑🌐, ~1–2 hrs total)

9. **Vercel account** (Hobby is fine for alpha).
10. **Resend: DEFERRED with the domain** — verifying a sender requires a domain you own,
    so `NOTIFICATIONS_ENABLED` stays OFF during the vercel.app window (testers coordinate
    in the group chat; the bell/emails arrive with the domain). When the domain lands:
    account → verify sending domain → `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM`.
11. **Web push keys** (💻, no vendor): `npx web-push generate-vapid-keys` → save the pair
    for `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY`, plus
    `VAPID_SUBJECT=mailto:you@yourdomain.com`.
12. **Google OAuth** (per `docs/GOOGLE_OAUTH_SETUP.md`) — unaffected by the missing domain,
    since the redirect URI Google sees is the SUPABASE callback: Cloud Console → OAuth
    consent screen (External; scopes email/profile/openid) → Credentials → OAuth client ID
    (Web) → **Authorized redirect URI =**
    `https://rwabzxfyndpsqpmfmrim.supabase.co/auth/v1/callback` → copy client ID + secret.
    Then Supabase 🌐 → Authentication → Providers → Google → enable + paste. Then
    Authentication → URL Configuration → Site URL = `https://<project>.vercel.app`;
    Redirect URLs allowlist: `http://localhost:3000/api/auth/callback` AND
    `https://<project>.vercel.app/api/auth/callback`.
    Consent-screen note: in "Testing" mode only listed test users can sign in — either add
    your ~24 testers' emails as test users, or publish the app (unverified-app warning is
    fine for trusted testers). Verify locally first: flag on in `.env.local`, restart dev,
    `/enter/login` Google button round-trips.
13. **Stripe live-mode prep** (🧑): dashboard → Live mode → complete/confirm the Connect
    platform profile → enable **Stripe Identity** on the account (used by
    `VERIFICATION_ENABLED` later; G11 repointed off Persona —
    **LAUNCH_SERVICES.md's Persona row is superseded**).
14. Skip for launch: EasyPost/Shippo (Wave D stays off — floor-priced shipping + manual
    ship works), Twilio phone OTP (overkill for trusted testers; add before open signups).

## Phase 3 — Deploy to Vercel

15. **Create `vercel.json`** in the repo root (💻), commit + push — this registers the
    crons (they're a hard launch blocker: without process-transfers, sellers don't get paid):
    ```json
    {
      "crons": [
        { "path": "/api/cron/process-transfers", "schedule": "0 * * * *" },
        { "path": "/api/cron/boost-expiry",      "schedule": "30 * * * *" },
        { "path": "/api/cron/tier-expiry",       "schedule": "0 9 * * *" }
      ]
    }
    ```
    (**Supersedes LAUNCH.md §6's pg_cron section** — transfers run via Vercel cron hitting
    `/api/cron/process-transfers`, guarded by `CRON_SECRET`, which the route REFUSES to run
    without. tier-expiry no-ops until `NOTIFICATIONS_ENABLED=true`.)
16. **Import the repo into Vercel** 🌐 (Add New → Project → aetiusgular/resale-platform;
    Next.js autodetected; pnpm from the lockfile). First deploy can fail until env vars land — fine.
17. **Set env vars** (Project → Settings → Environment Variables, Production). Full list:
    | Var | Value/source |
    |---|---|
    | `NEXT_PUBLIC_SUPABASE_URL` / `NEXT_PUBLIC_SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API |
    | `STRIPE_SECRET_KEY` (sk_live_…) / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (pk_live_…) | 🧑 HUMAN-ONLY, Phase 4 |
    | `STRIPE_WEBHOOK_SECRET` | 🧑 from the live webhook endpoint, Phase 4 |
    | `NEXT_PUBLIC_POSTHOG_KEY` / `NEXT_PUBLIC_POSTHOG_HOST` | PostHog project |
    | `SENTRY_DSN` (+ optional `NEXT_PUBLIC_SENTRY_DSN`, `SENTRY_AUTH_TOKEN/ORG/PROJECT`) | Sentry project |
    | `CRON_SECRET` | generate: `openssl rand -hex 32` — Vercel sends it as the Bearer token to cron routes |
    | `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED=true` | Google button on |
    | `RESEND_API_KEY` / `NOTIFY_EMAIL_FROM` | from step 10 (used when notifications flip on) |
    | `VAPID_PUBLIC_KEY` / `NEXT_PUBLIC_VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` / `VAPID_SUBJECT` | from step 11 |
    | All feature flags | leave UNSET/false for now — flipped one wave at a time in Phase 6 |
18. **Domain: skipped for now** — note your exact `https://<project>.vercel.app` URL; it's
    the string that goes into Supabase URL config (step 12) and the Stripe webhook (step 20).
    HTTPS is automatic on vercel.app.
19. **Supabase production hardening** 🌐: enable PITR / daily backups (Add-ons); run
    `SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;` in the
    SQL editor → must return 0 rows.

## Phase 4 — Stripe LIVE cutover (🧑 HUMAN-ONLY, per LAUNCH.md §2)

20. Stripe dashboard (Live mode) → Developers → Webhooks → **Add TWO endpoints**, both at
    `https://<project>.vercel.app/api/webhooks/stripe` (corrected 2026-09-05, go-live audit
    P0-3; **supersedes the one-endpoint instruction and LAUNCH.md's older list**):
    - **"Events on your account"** → `payment_intent.succeeded` · `payment_intent.payment_failed`
      · `charge.refunded` · `identity.verification_session.verified` ·
      `identity.verification_session.canceled` · `identity.verification_session.requires_input`.
    - **"Events on Connected accounts"** → `account.updated`. The sellers' Express accounts are
      connected accounts, so their `account.updated` events are Connect events and NEVER reach
      an "Events on your account" endpoint. This event is what sets `profiles.payouts_enabled`;
      without it every listing approval and every checkout returns 422. (`stripe listen` forwards
      both kinds to one URL with one secret, which is why local runs never showed this.)
    `charge.dispute.created` is not handled yet (audit Finding 2); add it to the first endpoint
    when the handler ships.
21. Copy each endpoint's signing secret → `STRIPE_WEBHOOK_SECRET` (your account) and
    `STRIPE_CONNECT_WEBHOOK_SECRET` (Connected accounts) in Vercel. The route tries both.
    Belt and braces: `/api/stripe/connect/return` also retrieves the account from Stripe when the
    seller comes back from onboarding and syncs `payouts_enabled` through the same code path.
22. Enter `sk_live_…` / `pk_live_…` in Vercel. **Redeploy** (env changes need it).

## Phase 5 — Production smoke (you + a second account, before anyone else)

23. Sign up on prod (`/enter` → Create account). Make yourself admin: Supabase SQL editor →
    `UPDATE profiles SET role='admin' WHERE username='<you>';` (LAUNCH.md §5 stands:
    **never run seed-founders against prod** — and post-G13 it seeds no codes anyway;
    testers just sign up).
24. **Full money smoke with real money, small amount** (this is the point of no return —
    live keys mean real charges): list a cheap item from account A → approve it in
    `/admin/queue` → buy it from account B with a real card → dev-log equivalent: Stripe
    dashboard shows the PI, webhook deliveries 200, order page PAID & HELD → mark
    shipped/delivered → confirm exactly ONE transfer to the seller's Connect account after
    the escrow window (or via the cron) → then refund the charge from the Stripe dashboard
    to make yourselves whole.
25. Verify the rest of the checklist: Google sign-in round-trips on prod; PostHog live view
    shows events; trigger a test error → lands in Sentry; Vercel → Crons shows the three
    jobs with 200s (or `curl -H "Authorization: Bearer $CRON_SECRET" https://yourdomain.com/api/cron/process-transfers`).

## Phase 6 — Flag flips (env → redeploy → smoke, ONE at a time)

26. `NOTIFICATIONS_ENABLED=true` — **DEFERRED until the domain lands** (needs Resend's
    verified sender, step 10). When flipped: advance a test order → seller gets the email,
    bell populates.
27. `IDENTITY_LOCKS_ENABLED=true` and `COLLUSION_HOLD_ENABLED=true` — pure additive safety,
    no vendor, enforce only on collisions.
28. `VERIFICATION_ENABLED=true` (Stripe Identity was enabled in step 13) — dormant until a
    seller nears $5k trailing sales, so flipping early is harmless and forgetting it is not.
29. Stays OFF at launch: `SHIPPING_LABELS_ENABLED` (G12 built but needs EasyPost — post-launch),
    `RECS_ENABLED` (unless Phase 7), `REVIEWS/FOLLOWS/BOOSTED_POSTS/BUMP/SAVED_SEARCH_ALERTS`
    (need liquidity), `PHONE_VERIFICATION_ENABLED` (pre-open-signup, not pre-alpha).
    `TIER_DASHBOARD_ENABLED` is display-only — flip whenever.

## Phase 7 — OPTIONAL: recs engine live for day one (else do in week 2)

30. fashion-CLIP ONNX export on the Mac (D-07) — **before any indexing**, else re-embed later.
31. Hetzner VPS per `recs-engine/ops/vps/README.md` (CX32): compose up, Caddy domains
    (`INGEST_DOMAIN`/`FEED_DOMAIN` DNS → box), rclone offsite backup remote configured —
    non-negotiable, the box holds the event archive.
32. Vercel env: `RECS_INGEST_URL`, `RECS_FEED_URL`, `RECS_FEED_API_TOKEN`,
    `RECS_INGEST_HMAC_SECRET` (must match the box).
33. Backfill: `RECS_ENABLED=true pnpm tsx scripts/recs-backfill.ts --confirm` (run against prod env).
34. Flip `RECS_ENABLED` + `NEXT_PUBLIC_RECS_ENABLED` → redeploy → browse feed comes from the
    engine; telemetry flows from user #1.

## Phase 8 — Open the doors

35. Final once-over from your phone: signup → browse → listing → message → (mobile tab bar,
    G13 landing).
36. Send the URL to the trusted list (the ~24 contacts in `docs/USER_FEEDBACK.md` §6) —
    they sign up like anyone; appoint the two moderators via the admin route once their
    accounts exist (`/api/admin/profiles/[id]/moderator`).
37. Watch-cadence for week one: Stripe dashboard (payments/disputes) daily · Sentry alerts ·
    PostHog live · `/admin/queue` for listing approvals (listings need approval before they're
    live — you ARE the moderation team) · Vercel cron logs. Escrow auto-releases 3 days after
    delivery; disputes freeze it.

---

## When the real domain arrives (week 2+, after the name is chosen)

A ~30-minute migration; testers' vercel.app links keep working throughout:

1. Buy the domain → Vercel → Project → Domains → add it → DNS records at registrar → ✓ +
   auto-SSL. Vercel serves BOTH domains; optionally set the custom one as primary
   (vercel.app then redirects to it).
2. Supabase → Auth → URL Configuration: Site URL → the new domain; ADD
   `https://newdomain.com/api/auth/callback` to the redirect allowlist (keep the vercel.app
   entry during transition).
3. Stripe → the live webhook endpoint → **edit its URL in place** to the new domain — the
   signing secret is preserved, no env change needed.
4. Resend: verify the sending domain → set `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM` in Vercel
   → flip `NOTIFICATIONS_ENABLED=true` (+ push works too, VAPID keys from step 11) → redeploy.
5. **Turn on search (SEO):**
   - Vercel env: update `NEXT_PUBLIC_APP_URL=https://newdomain.com` (build-time — canonicals,
     og:url, and sitemap URLs all derive from it, alongside the Stripe/IDV redirects) and set
     `SEO_INDEXING_ENABLED=true` → redeploy.
   - Make the custom domain PRIMARY (step 1) so vercel.app 308-redirects to it. If that
     redirect isn't active, add to `next.config.ts`:
     `async redirects() { return [{ source: '/:path*', has: [{ type: 'host', value: 'resale-platform-eta.vercel.app' }], destination: 'https://newdomain.com/:path*', permanent: true }] }`
   - Google Search Console: add + verify the domain property → submit `/sitemap.xml`.
   - Rich Results Test (search.google.com/test/rich-results) on one live listing URL —
     expect Product (merchant listing) + BreadcrumbList; fix anything flagged.
   - Follow-on lever: Google Merchant Center free listings (one-of-a-kind used apparel
     passes with `identifier_exists=false`).
6. Tell the testers the new URL. Done.

## Superseded / stale-doc notes
- **LAUNCH.md §2 webhook event list** (had `transfer.created`, missed identity events) → use Phase 4 step 20.
- **LAUNCH.md §6 pg_cron** → the ESCROW TRANSFER retry moved to a Vercel cron + `CRON_SECRET`
  (Phase 3 step 15). pg_cron itself is still required: `auto-release-delivered-orders`,
  `auto-deliver-stale-shipped-orders` (migration 0047), `release-expired-checkouts`,
  `expire-and-void-offers` and `expire-boosts` run in the database. Check
  `SELECT jobname, schedule FROM cron.job;` after migrating.
- **LAUNCH.md §9 / LAUNCH_SERVICES "Persona"** → Stripe Identity (G11).
- **LAUNCH_SEQUENCE Wave B invite decision** → dead (G13, open signup).
- **Any doc mentioning invite codes/waitlist** → system removed 2026-08-24.
