# HANDOFF.md
## Current state: B8 COMPLETE — ALPHA BUILD COMPLETE

**Last updated:** 2026-07-13
**Next prompt:** PA (post-alpha) — see LAUNCH.md §8 for PA backlog

---

## What was done in B8

B8 is the final alpha build milestone. All debt from B5/B6/B7 repaid, security hardened, analytics added, founder seed script complete, launch checklist written.

### Debt repaid from B5/B6/B7

- Double-lock in offer-based checkout: `accept` route guards against existing accepted offer on same listing; checkout rejects ALL non-active statuses (including `pending_escrow`)
- `shippingAddress` fields added to Stripe PI metadata (sanitized, capped, admin-only in Stripe dashboard)
- UUID validation on `conversationId`/`offerId` URL params — auth check comes first (401), then UUID check (404)
- `paypal.com/send` pattern added to message filter
- Waitlist API: persists to `waitlist` table via service_role; rate-limited 5/hr/IP; duplicate email → 200 (not error)
- Verified-seller filter in browse: PostgREST nested-table eq is unreliable; applied post-fetch in JS
- `profiles` anon grant narrowed: revoked full-row SELECT, re-granted only `(id, username)` columns
- saves route: UUID validation on `listing_id`
- CSP headers: added to `next.config.ts` via `headers()` — default-src, frame-src, form-action, base-uri, X-Content-Type-Options, X-Frame-Options, Referrer-Policy
- Saved-search JSONB: size cap (20 keys, 200 chars/value) added to API route
- comment body max 2000 chars: CHECK constraint added at DB level (migration 000012)
- Seed route: SEED_SECRET secondary guard added

### New in B8

- **Rate limiting** (`lib/rate-limit.ts`): in-memory sliding-window per-process. Applied to: auth endpoints (existing), listings upload (30/hr/user), checkout (10/hr/user), waitlist (5/hr/IP). Documented as per-instance tradeoff; pg-based upgrade in PA.
- **Sentry** (`@sentry/nextjs` v10): `instrumentation.ts` (server/edge) + `instrumentation-client.ts` (browser); env-gated (no-op without DSN); PII scrubbing in `beforeSend`; `onRouterTransitionStart` hook exported for navigation tracing.
- **Migration 000012** (`b8_hardening.sql`): `waitlist` table with UNIQUE(email), `comments.body` CHECK (≤2000 chars), REVOKE anon SELECT on profiles, GRANT SELECT (id, username) on profiles to anon.
- **Analytics** (`lib/analytics.ts`): extended AnalyticsEvent union with `checkout_started`, `checkout_completed`, `offer_made`, `offer_accepted`, `comment_posted`.
- **Admin metrics** (`app/admin/metrics/page.tsx`): GMV (released), orders by state, dispute rate, listings by status, signups last 14 days, waitlist count, members via invite.
- **Founder seed script** (`scripts/seed-founders.ts`): 24 alpha contacts + tabiwalker fixture; production guard (NODE_ENV + `--confirm`); 3 invite codes per founder; idempotent upserts.
- **docs/ANALYTICS.md**: Event catalog, funnel definitions, PostHog dashboard spec.
- **docs/LAUNCH.md**: Production checklist — Vercel env vars, Stripe LIVE cutover (HUMAN-ONLY), Supabase hardening, domain/DNS, pg_cron verify, PA backlog.
- **docs/SECURITY_REVIEW.md**: Full B0→HEAD sweep across 6 passes; 0 HIGH/CRITICAL; 4 MEDIUM (all accepted); verdict APPROVED.

### Key files modified

```
app/api/checkout/route.ts                         — Double-lock, rate limit, shippingAddress in PI metadata
app/api/conversations/[id]/messages/route.ts      — Auth-first then UUID validation
app/api/conversations/[id]/offers/route.ts        — Auth-first then UUID validation
app/api/conversations/[id]/offers/[offerId]/accept/route.ts — Double-lock guard + UUID validation
app/api/waitlist/route.ts                         — Full rewrite: DB persist + rate limit
app/api/dev/seed/route.ts                         — SEED_SECRET secondary guard
app/api/browse/route.ts                           — Verified filter applied post-fetch
app/api/saves/route.ts                            — UUID validation on listing_id
app/api/saved-searches/route.ts                   — JSONB size cap
lib/message-filter.ts                             — paypal.com/send pattern
lib/analytics.ts                                  — Extended AnalyticsEvent union
next.config.ts                                    — CSP/security headers + Sentry conditional wrap
instrumentation.ts                                — Sentry server/edge (Next.js 15 pattern)
instrumentation-client.ts                         — Sentry client + onRouterTransitionStart
tests/e2e/auth.spec.ts                            — Waitlist test: API mock via page.route()
tests/e2e/messages.spec.ts                        — (passes after auth-first fix in routes)
```

### Key files added

```
lib/rate-limit.ts
app/admin/metrics/page.tsx
scripts/seed-founders.ts                          (full rewrite)
supabase/migrations/20240101000012_b8_hardening.sql
docs/ANALYTICS.md
docs/LAUNCH.md
docs/SECURITY_REVIEW.md
tests/unit/rate-limit.test.ts
tests/unit/message-filter-paypal.test.ts
tests/unit/checkout-double-lock.test.ts
```

---

## Verify state (as of B8 close)

```
pnpm build       ✓  all routes, 0 errors
pnpm verify      ✓  133 tests, 0 errors (12 files)
pnpm verify:ui   ✓  36 passed, 3 skipped (@live)
Migration 000012 ✓  pushed to remote
Lighthouse /enter       Performance 88, A11y 98, Best Practices 96, SEO 100
Lighthouse /styleguide  Performance 94, A11y 95, Best Practices 96, SEO 100
SECURITY_REVIEW.md      0 unresolved HIGH/CRITICAL — APPROVED
```

---

## Blockers

None.

---

## PA backlog (from B8 security review)

- Replace in-memory rate limiter with pg-based counter for multi-instance correctness
- Add nonce-based CSP to eliminate `'unsafe-inline'` in script-src
- Validate `images[]` URLs against storage domain allowlist
- Add UUID validation to admin path params (profileId, commentId)
- Carrier-scan webhook (auto-confirm delivery)
- ID verification provider (Stripe Identity or Persona)
- Mobile PWA / iOS native app
- See LAUNCH.md §8 for full PA backlog

---

## Session start ritual for PA

```
Read CLAUDE.md and docs/HANDOFF.md, then read docs/LAUNCH.md for launch checklist status.
```

---

## ALPHA BUILD COMPLETE

All B0–B8 milestones complete. The codebase is ready for private alpha launch.
Follow `docs/LAUNCH.md` to deploy.
