# LAUNCH.md — Production checklist for alpha launch

## 1. Vercel environment variables

Set these in the Vercel dashboard (Project → Settings → Environment Variables).
Never enter these via CLI or agent — especially the Stripe live keys.

| Variable | Description | Who sets it |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL | Founder |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon (public) key | Founder |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key (server only) | Founder |
| `STRIPE_SECRET_KEY` | **LIVE** Stripe secret key (sk_live_…) | **HUMAN-ONLY** |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | **LIVE** Stripe publishable key (pk_live_…) | **HUMAN-ONLY** |
| `STRIPE_WEBHOOK_SECRET` | Webhook signing secret from Stripe dashboard | **HUMAN-ONLY** |
| `NEXT_PUBLIC_POSTHOG_KEY` | PostHog project API key | Founder |
| `NEXT_PUBLIC_POSTHOG_HOST` | PostHog host (https://us.i.posthog.com) | Founder |
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry DSN (client-side error reporting) | Founder (optional) |
| `SENTRY_DSN` | Sentry DSN (server-side) | Founder (optional) |
| `SENTRY_AUTH_TOKEN` | For source map upload in CI | Founder (optional) |
| `SENTRY_ORG` | Sentry org slug | Founder (optional) |
| `SENTRY_PROJECT` | Sentry project name (default: resale-platform) | Founder (optional) |

## 2. Stripe LIVE cutover steps

**HUMAN-ONLY — never delegate to agent or CLI:**

1. Log into Stripe dashboard → switch to Live mode.
2. Create a new Connect platform profile on the main account (if not done).
3. Go to Developers → Webhooks → Add endpoint:
   - URL: `https://your-domain.com/api/webhooks/stripe`
   - Events to listen for:
     - `payment_intent.succeeded`
     - `payment_intent.payment_failed`
     - `transfer.created`
     - `account.updated` (for Connect onboarding)
4. Copy the webhook signing secret → paste as `STRIPE_WEBHOOK_SECRET` in Vercel.
5. Enter `sk_live_…` as `STRIPE_SECRET_KEY` in Vercel.
6. Enter `pk_live_…` as `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` in Vercel.
7. Trigger a test transaction with a real card to verify the webhook fires.

## 3. Supabase production hardening

- [ ] Enable Point-in-Time Recovery (PITR) in Supabase dashboard → Project Settings → Add-ons
- [ ] Enable daily backups (included in Pro plan)
- [ ] Confirm pg_cron extension is active: `SELECT * FROM cron.job;` should show the process-transfers job
- [ ] Run `supabase db push --yes` from a machine with `SUPABASE_ACCESS_TOKEN` set (not in production)
- [ ] Confirm RLS is enabled on all tables: run `SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;` → should return 0 rows

## 4. Domain + DNS

- [ ] Register domain (HUMAN-ONLY)
- [ ] Point domain DNS to Vercel (add CNAME records in registrar)
- [ ] Verify domain in Vercel dashboard
- [ ] SSL cert auto-provisioned by Vercel

## 5. Seed script production guard

The `scripts/seed-founders.ts` script has two production guards:
1. Refuses to run when `NODE_ENV=production`
2. Requires `--confirm` flag

**DO NOT run the seed script against the production DB.** Founder accounts
should be created manually or via the admin UI. The seed script is dev/staging only.

## 6. pg_cron verification

Connect to production Postgres and verify the cron job for auto-transfer exists:
```sql
SELECT jobname, schedule, command FROM cron.job;
-- Expected: process-transfers | every 5 minutes | SELECT process_ready_transfers()
```

## 7. Pre-launch checklist

- [ ] All Vercel env vars set (table above)
- [ ] Stripe LIVE keys entered (HUMAN-ONLY)
- [ ] Stripe webhook endpoint created + secret saved
- [ ] Supabase PITR enabled
- [ ] Domain DNS pointing to Vercel
- [ ] Admin user created (set `role = 'admin'` via Supabase dashboard)
- [ ] Smoke test: sign up → onboarding → browse → listing detail
- [ ] Smoke test: checkout flow with Stripe test card (switch to live mode after)
- [ ] PostHog events firing (check PostHog live view)
- [ ] Sentry catching errors (trigger a test error)
- [ ] pg_cron job verified

## 8. PA (post-alpha) backlog

Items NOT in scope for alpha but required before public launch:

| Item | Priority | Notes |
|---|---|---|
| Carrier-scan webhook (USPS/UPS/FedEx) | P0 for public | Auto-confirm delivery; currently manual |
| PayPal via Commerce Platform | P1 | Multi-party payments, auto fee-split |
| ID-verification provider (Stripe Identity or Persona) | P0 for public | Currently manual |
| Personalization feed | P1 | PostHog events collected from day 1 |
| Saved-search alerts (email) | P1 | Schema exists, notifications TBD |
| Reverse-image stock-photo detection | P1 | External API (Google Vision/TinEye) |
| Mobile PWA polish / iOS native app | P0 for public | Majority of traffic is mobile |
| Price-drop notifications | P1 | Schema exists; email/push TBD |
| Bulk listing tools / cross-listing API | P2 | Pro-dealer subscription value |
| Verified storefront pages | P2 | Bvug mitigation |
| BNPL (Affirm/Klarna via Stripe) | P2 | Revenue line |
| Prepaid shipping labels (Shippo/EasyPost) | P1 | Revenue line |

## 9. Launch-blocker priorities (2026-07-26)

**Must-have before real users + money:**
- Stripe LIVE cutover (§2) — HUMAN-ONLY.
- Legal: entity + Terms of Service + Privacy Policy (founder/lawyer).
- **Seller ID verification via Persona** — buyers require NO ID (Grailed model; avoids
  conversion loss). Gate point + INFORM-Act high-volume trigger: see revised model in
  docs/LAUNCH_ROADMAP.md (G4). Reuses the trailing-volume resolver from the fee work.
- **Account security**: Google OAuth + email + phone (Supabase phone auth) at signup,
  TOTP 2FA (Supabase MFA). Do NOT ID-gate buyers or general commenting.
- Notifications (email + push) — offers / sales / new messages (G2).
- Deploy: Vercel + `supabase db push` + domain (§1–4, 7).

**Strong should-have:**
- Carrier delivery webhook (auto-confirm delivery → 3-day escrow release) — §8 P0.
- Trust & safety moderation console (primitives exist: flags, phash, disputes, buyer_strikes).

**Post-launch (ship with flag OFF):** recs (RECS_ENABLED), bump, saved-search alerts,
follows/reviews, Authenticated badge, real fashion-CLIP.

**Services:** see docs/LAUNCH_SERVICES.md.
