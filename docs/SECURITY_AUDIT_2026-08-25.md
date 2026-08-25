# Pre-launch security audit — resale-platform

Date: 2026-08-25
Scope: full repo. Exposed API endpoints, database access paths (RLS, service-role, injection), and payment-gateway (Stripe Connect) info-theft vectors. Reviewed against current published exploits for Next.js 15 App Router, Supabase/PostgREST, and Stripe Connect separate-charges-and-transfers. Launch model considered: open signup, small trusted-tester window first, more features flag-flipped on at full launch.

## Verdict

The core is production-grade. There is no unauthenticated data-mutation endpoint, no injection path into the database, and no way for a buyer or seller to steal payment info or manipulate what they pay. Auth, the Stripe money path, and RLS coverage are all sound.

One real hole to close before anyone who is not you touches the site: every logged-in user can read every other user's profile row, which includes home/return addresses and phone numbers. It is a small, well-scoped fix. One more item (automatic reversal of a seller payout on refund/chargeback) is fine for the trusted-tester window but must be built before full launch.

Recommendation: fix Finding 1 before you invite testers. Push to Vercel is otherwise clear. Build Finding 2 before opening to the general public.

---

## Findings, ranked

### 1. HIGH — Any logged-in user can read every profile's PII (addresses, phone)

What: `profiles` has `GRANT SELECT ON profiles TO authenticated` on all columns (migration 0000, never narrowed), and its row policy `profiles_public_read_username` is `USING (true)` with no role restriction. Permissive policies are OR-ed, so an authenticated user's row filter resolves to true. Net effect: any user with a valid session can call the PostgREST data API directly with their own JWT and the public anon key:

```
GET /rest/v1/profiles?select=id,username,phone,shipping_address,ship_from_address,stripe_connect_account_id,payouts_enabled
```

and receive those columns for every user on the platform. The exposed columns include buyer home addresses (`shipping_address`), seller return addresses (`ship_from_address`), phone numbers, Stripe Connect account IDs, and payout status.

Why it exists: the anon role was already fixed for exactly this. Migration 0012 (`b8_hardening`) did `REVOKE SELECT ON profiles FROM anon; GRANT SELECT (id, username) ON profiles TO anon;`. The same treatment was never applied to the `authenticated` role, so the broad grant from migration 0000 is still live. This is the same class as the widely-reported 2025 Supabase incidents where an over-permissive policy plus a broad grant turned the anon/authenticated key into a data-exfiltration tool.

Blast radius in the trusted-tester window: low, because testers are people you trust, but it is real PII (home addresses) and it is trivially readable by any one of them.

Fix (ready to apply, needs a migration + one page change + db-guard + native verify, then a remote `supabase db push`):

```sql
-- Migration: harden profiles SELECT for the authenticated role.
-- Mirror the anon fix (0012): the "public" profile columns only. Sensitive
-- columns (addresses, phone, connect id, payout status, ban state) are read
-- for the OWNER via the service role in app code, never cross-user.
REVOKE SELECT ON profiles FROM authenticated;
GRANT SELECT (
  id, username, role, id_verified, id_verification_status,
  tier, verified_checker, checker_category, is_moderator,
  lifetime_sales_count, elite_program_eligible, created_at
) ON profiles TO authenticated;
```

Because column grants are role-wide (not per-row), the owner can no longer read their own sensitive columns through the user client. One place does that today: `app/settings/page.tsx` selects `phone, phone_verified_at, shipping_address, ship_from_address, stripe_connect_account_id, payouts_enabled` with the user client. Switch that single read to the service-role client (the file already imports it). The webhook and checkout already read those columns via the service role, so nothing else changes. Verify after: log in as user A, request user B's `phone`/`shipping_address` over the REST API, confirm you get null/empty; confirm settings still renders your own address.

### 2. HIGH at full launch — No automatic seller-payout reversal on refund or chargeback

What: the marketplace uses separate charges and transfers with a 3-day auto-release escrow. In that model, refunding the buyer's charge does not touch the transfer already sent to the seller (Stripe documents this explicitly). The webhook `handleChargeRefunded` moves the order to `refunded` and removes the listing, but never reverses the transfer, and there is no `charge.dispute.created` handler at all. So once an order auto-releases and the transfer lands in the seller's account, a buyer refund or bank chargeback debits your platform balance while the seller keeps the money. A colluding buyer and seller can do this deliberately.

Present mitigations reduce it: the 3-day hold, collusion detection, card/bank fingerprint identity locks, and ID verification. The app also deliberately scopes its own admin-initiated refunds to the pre-transfer state only (see `escrow_refund.sql` comments), so the gap is specifically post-transfer refunds and bank disputes.

Trusted-tester window: low risk, testers will not chargeback-fraud you, and you can reverse a transfer by hand in the Stripe dashboard if needed. Do not block the push on this.

Fix before full launch: add a `charge.dispute.created` webhook case that calls `stripe.transfers.createReversal(transferId, { refund_application_fee: true }, { idempotencyKey: 'rev-' + disputeId })` when the order already has a `stripe_transfer_id`; do the same on any post-transfer refund; enable `debit_negative_balances` on connected accounts; and hold payouts for brand-new sellers. This matches Stripe's own marketplace risk guidance.

### 3. MEDIUM — Rate limiting is applied unevenly

What: `checkRateLimit` is wired into checkout, listing-create, bump, and phone-start. It is not applied to comments, offers, messages, reviews, follows, saves, saved-searches, conversations, or recs/events. With open signup, comment/message/offer spam is the practical abuse vector. The limiter is also fail-open by design (a database blip disables it), which is a reasonable availability choice but worth knowing.

Phone-verify (OTP check) has no app-level limiter, but if you are on Twilio Verify the code check is rate-limited and lockout-enforced by Twilio, so that specific case is covered upstream. Confirm you are using Twilio Verify (not a self-rolled OTP compare) and it is fine.

Fix: add `checkRateLimit` to the write endpoints above before opening to the public. This is not a trusted-tester blocker.

### 4. LOW — Service-role and Stripe-secret modules are not build-time fenced

What: `lib/supabase/service.ts` and `lib/stripe.ts` are correctly keyed to server-only secrets and carry "never import client-side" comments, but nothing enforces it. A future refactor that imports either from a client component would bundle the secret into browser JS. No such import exists today (verified).

Fix: add `import 'server-only'` as the first line of both modules so an accidental client import fails the build. Add a CI or pre-commit grep of the built `.next/static` for `service_role`, `sk_`, and `whsec_` as a backstop.

### 5. LOW / informational — SECURITY DEFINER functions pin `search_path = public`, not `''`

What: the privileged SQL functions reachable by authenticated users (send_message, post_review, recommend_moderator, check_rate_limit, and others) do set `search_path`, and no schema grants `CREATE` to anon or authenticated (verified), so the search-path-hijack vector is closed. There is no dynamic SQL string concatenation anywhere in the function bodies (verified), so there is no SQL injection surface through the RPCs.

Fix (optional hardening): standardize on `SET search_path = ''` with fully schema-qualified names for defense in depth. Not exploitable as configured.

### 6. LOW — Ban enforcement can lag up to 10 minutes on page views

What: middleware caches a "gate passed" cookie for 10 minutes and skips the profile re-query on non-admin pages, so a user banned mid-session can keep browsing for up to 10 minutes. It does not let them transact: every money and action API route re-checks `isBanned` server-side via the service role. Acceptable as designed; noted for awareness.

### 7. Informational, time-sensitive — Next.js critical release lands Aug 26 (tomorrow)

Your pinned 15.5.22 clears every currently-disclosed Next.js CVE, including the middleware `x-middleware-subrequest` bypass (CVE-2025-29927, fixed in 15.2.3) and the RSC RCE (fixed in 15.5.7). Vercel has pre-announced a critical release for Aug 26, 2026 shipping as 15.5.24, which implies 15.5.22 is affected by whatever it fixes. Bump to 15.5.24 the moment it lands, ideally before or immediately after this deploy. Wire Dependabot or `npm audit` into CI; Next.js is on a monthly security cadence now.

### 8. Informational — deploy-time platform hardening (not code)

- Turn on Vercel Deployment Protection (Vercel Authentication) so preview URLs are not public with real environment variables.
- Confirm `CRON_SECRET` is set in Vercel. The cron handlers already fail closed without it (verified), so an unset secret disables transfers rather than exposing them, but you want it set so payouts actually run.
- Scope environment variables per environment so previews never carry production secrets.
- `productionBrowserSourceMaps` is off (verified) — keep it off, or gate maps behind Vercel Protected Source Maps.
- On Supabase prod: enable SSL enforcement, network restrictions, leaked-password protection, and org MFA; run the dashboard Security Advisor and confirm it is clean.

---

## What was verified and is solid

Attack surface, all 65 API routes:
- Every route authenticates with `getUser()` or is gated by a signature (Stripe/EasyPost webhooks) or a secret (cron, dev-seed). No route mutates data unauthenticated. `getSession()` is never used for an authorization decision anywhere in server code (it is the spoofable one).
- Admin routes gate on `role === 'admin'`, or enforce it inside the SECURITY DEFINER RPC (moderation log, moderator recommend). Privilege columns (role, is_moderator, verified_checker, id_verification_status) are not writable by the authenticated role, so no self-promotion. The moderator-grant route checks admin before writing via service role.
- IDOR checks are present where it matters: orders are scoped to `buyer_id`/`seller_id`, offer ownership is verified against the conversation buyer, delivery confirmation checks `buyer_id === user.id`.
- `dev/seed` is disabled in production by a `NODE_ENV` guard plus an optional secret.

Payment path (Stripe Connect, separate charges and transfers):
- Webhook verifies the signature over the raw body before any side effect, fails closed if the signing secret is missing, and is idempotent via a UNIQUE `order_events.stripe_event_id`. Replays return 200 and no-op.
- Fees are 100% server-computed from the `checkout_sessions` row. The client cannot set price or fee. The webhook re-checks that the PaymentIntent amount equals the session total (tamper check) before creating the order, and never uses PaymentIntent metadata as the source of truth for money.
- Double-payout is closed: a single `createOrderTransfer` helper with `idempotencyKey: transfer-<orderId>`, identical params at every call site, plus a re-check of `stripe_transfer_id` and a state machine (`transition_order`) around release.
- An orphaned payment (charge succeeded, session gone, no order) auto-refunds idempotently instead of trapping the buyer's money.
- Partial refunds are handled correctly (only a full refund voids the order).
- No raw card data touches the server (Stripe.js/Elements on the client, publishable key only). No secret is logged.

Database:
- RLS is enabled on all 32 tables. No table in the public schema is left unprotected.
- No dynamic SQL string concatenation in any function body. RPC arguments are parameterized. No SQL injection path.
- Text search uses the safe `websearch` mode. The only interpolated `.or()` filter uses the server-authenticated `user.id`, not client input.
- No `CREATE` privilege is granted to anon or authenticated on any schema.

Secrets and config:
- No secret is mis-prefixed `NEXT_PUBLIC_`. All nine public variables are genuinely public (Supabase URL, anon key, Stripe publishable key, PostHog key, VAPID public key, app URL, feature flags). The service-role key, Stripe secret key, webhook secrets, Resend/Twilio keys, VAPID private key, and cron/seed secrets are all server-only.
- CSP is set per request with a fresh `crypto.randomUUID` nonce and no `script-src 'unsafe-inline'`. The nonce is generated server-side, not read from an inbound header, so the 2026 CSP2XSS class does not apply (and 15.5.22 patches it regardless).

---

## Suggested order of operations

1. Fix Finding 1 (profiles grant + settings read). Small migration + one-line-ish page change. Apply the migration to remote Supabase, run `pnpm verify`, smoke-test cross-user profile reads. Do this before inviting testers.
2. Push to Vercel. Confirm Deployment Protection on and `CRON_SECRET` set.
3. Bump to Next 15.5.24 when it lands (Aug 26).
4. Before full public launch: build Finding 2 (dispute/refund transfer reversal), add rate limits from Finding 3, and apply the low-severity hardening (Findings 4 and 5).
