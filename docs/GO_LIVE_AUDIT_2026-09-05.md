# Go-live audit: platform + recs engine (2026-09-05)

Scope: `resale-platform` at `main` = `origin/main` = `459b1c0` (PR #3 `ui/mobile-web` merged, working tree clean) and `recs-engine` at `955e8e7` (`feat/platform-adapters` = `main` = `origin/main`). Method: the full verify gate and a production build run on an exact copy of `main` in a Linux container, the non-`@live` Playwright suite against a dev server with dummy Supabase/Stripe env (same setup CI uses), and a static trace of every user-facing action from its click handler through the API route to the database, Stripe or the recs engine. Every defect below cites a file and line. Nothing here was exercised against the hosted Supabase project or a live Stripe account; those checks are listed as steps for you.

## 0. Status update (same day)

P0-1, P0-2, P0-3 and P1-5 are implemented on branch `fix/launch-blockers` (commit `7432eb7`, based on `feat/mobile-api` `bd36c1f` so it merges cleanly with the mobile API work; migrations are numbered 0047 and 0048 because 0046 is `push_devices`). Not yet verified natively: run `pnpm verify && pnpm build && pnpm verify:ui`, db-guard, then `supabase db push`. Review findings carried as follow-ups: the checkout save makes the typed address the default (and therefore the ship-from/return address, per the 0045 one-book design); the 10-day auto-deliver sweep opens the dispute window without notifying the buyer (no notify path from SQL; notifications are off at launch anyway); `/api/orders/[id]/receive` does not notify the seller.

## 1. Verdict

The frontend refactor is sound. Type-check, lint, unit tests and the production build are green on `main`. Every button in the redesign has a live handler that reaches a real route, and every route reaches a real table, RPC or Stripe call. No rules-of-hooks violations, no leaked intervals, no dead fetches to missing routes.

The platform is not launch-ready as configured. Three of the defects below stop the money path in the exact configuration the runbook launches with (`SHIPPING_LABELS_ENABLED=false`, one Stripe webhook endpoint). None of them are frontend refactor regressions. Two pre-date the redesign, one is a Stripe production behavior that the local `stripe listen` harness masked. All three are small fixes.

- P0-1: orders can never leave `shipped` without EasyPost, so escrow never releases and sellers are never paid.
- P0-2: sellers cannot see the buyer's shipping address anywhere, and a buyer with no saved address produces an order with no address at all.
- P0-3: `payouts_enabled` is only ever set by a connected-account `account.updated` webhook, which in production arrives only on a Connect endpoint with its own signing secret. The code accepts one secret. Result in prod: no seller can ever be approved and no checkout can ever succeed.

The recs engine is code-complete but not deploy-ready: the production image cannot load the real encoder, the cold-start seed endpoint always returns 503, and the event archive that the backup ships offsite is never written. Also small fixes.

## 2. What was verified

| Check | Result |
|---|---|
| `tsc --noEmit` | clean |
| `eslint .` | 0 errors, 0 warnings (the 6 baseline warnings are gone) |
| `vitest run` | 42 files, 426 tests passed |
| `next build` (mocked Google Fonts, dummy env) | green, 120 routes, one pre-existing benign warning (`@supabase/supabase-js` `process.version` in the edge runtime, from middleware) |
| Playwright non-`@live` (CI mode, dummy env, 1 worker) | 69 passed, 4 skipped, 1 failed: `tests/e2e/mobile.spec.ts:47` asserts the browse dock's bottom edge equals the viewport height, but with zero listings ("Nothing in the archive matches.") the sticky dock rests above the footer at y=608 of 812. Passes with data (the previous session's mock returned listings), fails in any empty environment, which is what CI has. Expect the `verify-ui` job on `main` to be red for this one test until the assertion tolerates a short page. App behavior is correct. |
| Git | `main` = `origin/main` = `459b1c0`, no staged, unstaged or untracked files; branches `ui/archive-redesign` and `ui/mobile-web` merged |
| Hooks | no rules-of-hooks violations; effects with timers clean up (`sell-form.tsx:212`, `checkout-success-content.tsx:34`, `browse-client.tsx:554`); no `setInterval` polling anywhere |

Action coverage (all traced to a working route): signup and login (email and modal), Google and Apple buttons, logout, forgot and reset password, onboarding account/setup/verify, settings profile (avatar upload to `product-images/avatars/{uid}`, username 30-day trigger, display name), delete account, address book, sizes, notification prefs, phone OTP, payouts (Connect onboarding, balance), theme; sell catalog (EDIT, BUMP, CONTINUE, DELETE draft, RELIST, VIEW ORDER), wizard (draft create, debounced autosave, 6 photo slots with FRONT + POSSESSION required, details, measurements, fee box, publish, edit mode); browse (rail, sort, chips, MY SIZES, load more, save search), listing (BUY NOW, MAKE OFFER, MESSAGE, save, view counter, legit-check thread), checkout (PaymentIntent, card element, decline retry, success poll), orders (confirm, ship, deliver, dispute), admin (approve, reject, moderation, resolve), messages (inbox, thread, offers accept/counter/decline, read cursor, report), notifications (list, mark read, prefs, push subscribe), saved (saves, visit strip, saved searches, follows), reviews.

## 3. Defects

Severity: P0 blocks a core flow or money in the launch configuration. P1 is wrong behavior a tester will hit or a money-path correctness gap. P2 is polish or dormant-behind-flag.

### P0

**P0-1. Escrow never releases when labels are off.** `app/orders/[id]/order-buyer.tsx:25,60` renders CONFIRM DELIVERY and REPORT AN ISSUE only when `state === 'delivered'`. The only transition `shipped -> delivered` is the EasyPost tracker webhook (`app/api/webhooks/easypost/route.ts:56`), which returns 404 while `SHIPPING_LABELS_ENABLED=false`. `auto_release_delivered_orders()` (`supabase/migrations/20240101000009_orders.sql:448-449`) requires `state='delivered'` and `delivered_at`. The dispute route requires `delivered` too (`app/api/orders/[id]/dispute/route.ts:60`). So every manually shipped order stops at `shipped`: no release, no transfer, no dispute window. The deliver API already accepts `shipped` (`deliver/route.ts:53-63`) but collapses `shipped -> delivered -> released` in one call, which means a buyer who wants to dispute a shipped item has no path except releasing the funds. The `@live` suite passed because it calls the API directly. Pre-dates the redesign (same gating at `70df18c`).
Fix: (a) a buyer "MARK AS RECEIVED" action in `shipped` that transitions only to `delivered` (starts the 3-day clock and opens the dispute window), separate from CONFIRM AND RELEASE; (b) a fallback in `auto_release` or a cron that moves `shipped` orders to `delivered` after N days without a delivery event, otherwise a buyer who never acts means a seller who is never paid.

**P0-2. Ship-to address is never captured from checkout and never shown to the seller.** `app/checkout/[listingId]/checkout-client.tsx:70-95` posts `shippingAddress` once on mount, before the buyer types, from a `useCallback` whose deps exclude `address`. The keys it sends (`stateZip`, `fullName`) do not match what `app/api/checkout/route.ts:216-220` reads (`.state`, `.zip`), and `country` is sliced to 10 characters (the "United Sta" you saw). None of it reaches the order: `app/api/webhooks/stripe/route.ts:177-202` snapshots `profiles.shipping_address`, which is only populated by Settings -> Address. A buyer who never saved an address pays and the order has `ship_to_address = null`. The seller view (`app/orders/[id]/order-seller.tsx`, `order-frame.tsx`) renders no address at all; `page.tsx:43` selects it and drops it.
Fix: require a saved address before PAY (block when `savedAddress` is null and link to the address book, or POST the typed form to `/api/settings/addresses` before `/api/checkout`); snapshot the address into `checkout_sessions` and copy it to the order in the webhook; render `order.ship_to_address` in the seller view.

**P0-3. Seller payouts can never be enabled in production.** `lib/stripe.ts:24-28` verifies webhooks with the single `STRIPE_WEBHOOK_SECRET`. `profiles.payouts_enabled` is set only by the `account.updated` handler (`app/api/webhooks/stripe/route.ts:351-384`). For Express accounts that event is a Connect event: Stripe delivers it only to an endpoint created with "Listen to events on Connected accounts", which has its own signing secret. `docs/LAUNCH_RUNBOOK.md:117-124` instructs one endpoint. `stripe listen` forwards both kinds to one URL, which is why every local run passed. `app/api/stripe/connect/return/route.ts` says it verifies the account via API and does not (it only redirects). Downstream: approve returns 422 (`app/api/admin/listings/[id]/approve/route.ts:53-59`), checkout returns 422 "Seller cannot accept payments yet" (`app/api/checkout/route.ts:100-105`).
Fix: accept a second secret (`STRIPE_CONNECT_WEBHOOK_SECRET`; try both in `constructWebhookEvent`), register two endpoints on the same URL, and make `/api/stripe/connect/return` call `stripe.accounts.retrieve` and set `payouts_enabled` from the response as a belt-and-braces path. Also request `capabilities: { transfers: { requested: true } }` in `accounts.create` (`app/api/stripe/connect/route.ts:46-50`) instead of relying on the dashboard default.

### P1

**P1-1. Sellers are never told they need Stripe Connect before a listing can go live.** Approve requires `payouts_enabled` (above). Nothing in `app/sell/**` mentions payouts. A seller publishes, sees IN REVIEW forever, and only the admin sees the 422. Gate PUBLISH on `payouts_enabled` or show a banner on `/sell` linking to `/settings/payouts`.

**P1-2. Transfers need available balance.** `lib/stripe.ts:55-69` creates transfers without `source_transaction`. On a new live Stripe account card funds are pending for 2 business days (often 7 for the first payout), so the first deliveries fail with `balance_insufficient`, the route returns `transferPending: true`, and the daily cron (`vercel.json`, 06:00 UTC; the route comment says hourly) retries. Sellers get paid days late and the order says released. Pass `source_transaction: <latest_charge>` (read from the PI) identically at every call site (the idempotency contract in the helper requires identical params), and run the cron hourly (Hobby plan rejects sub-daily, so this is a Pro plan item or accept the delay).

**P1-3. Refunds after transfer are never clawed back; disputes are not handled.** No `transfers.createReversal` anywhere; `charge.dispute.created` is not in the webhook switch (`app/api/webhooks/stripe/route.ts:58-78`). A chargeback on a released order is a platform loss. `charge.refunded` also ignores the `transition_order` error (`:435-441`) and sets the listing to `removed` regardless (`:444-447`). This is the open Finding 2 from the 2026-08-25 security audit. Owed before public launch, not before the tester window.

**P1-4. Offer-accepted notification sends the buyer to full-price checkout.** `lib/notify/templates.ts:20` builds `/checkout/${listingId}` with no `offerId`; the checkout page prices from the offer only when `?offerId=` is present. Via the thread's PROCEED TO CHECKOUT the link is correct. Dormant until `NOTIFICATIONS_ENABLED`, then charges list price plus shipping.

**P1-5. Legit-check thread never loads for signed-out visitors.** `app/api/listings/[id]/comments/route.ts:35-47` embeds `profiles(... is_moderator ...)` and `comment_actions(id, action)` through the anon client. Anon has no grant on `comment_actions` (`20240101000011_comments.sql:180` grants authenticated only) and no `is_moderator` column grant (`0016:11-13`, `0045:277`). PostgREST rejects the embed, the route returns non-OK, and `community-section.tsx:87-88,164` leaves "LOADING…" forever. Guest browsing shipped in `fe47ce1`, so every public listing page shows this. Fix: `GRANT SELECT (is_moderator) ON profiles TO anon; GRANT SELECT ON comment_actions TO anon` plus a public read policy, or run the GET through the service client.

**P1-6. Push subscribe always fails.** `app/api/notifications/subscribe/route.ts:25-27` upserts with `onConflict`; Postgres needs UPDATE for `ON CONFLICT DO UPDATE` and `20240101000026_notifications.sql:63` grants `SELECT, INSERT, DELETE` only. `push-subscribe.tsx:64-68` does not check `res.ok`, so the UI says PUSH ENABLED with no row. Dormant until notifications flip.

**P1-7. Saved-search ALERTS toggle is ignored.** `lib/search/dispatch.ts:50-53` selects every saved search with no `alerts_enabled` filter. Dormant until `SAVED_SEARCH_ALERTS_ENABLED`. Also that dispatcher calls `notify()` directly, so with that flag on and `NOTIFICATIONS_ENABLED` off it writes invisible rows.

**P1-8. Email CTA links are relative.** `lib/notify/templates.ts:63-64` uses `ctx.appUrl ?? ''`; only tier-expiry and search dispatch pass it. Every other email (message, offers, sale, shipped, delivered, dispute) links to `/messages/...`, dead in a mail client. Default the base to `NEXT_PUBLIC_APP_URL`.

**P1-9. REPORT in a thread is a write-only sink.** `reports` is written by `app/api/conversations/[id]/report/route.ts:26` and read nowhere (no admin view). The UI shows REPORTED ✓.

**P1-10. Seller-profile MESSAGE button lands on the inbox.** `app/sellers/[username]/page.tsx:195,197` link to `/messages?seller=`; `app/messages/page.tsx:19,33-36` handles only `?listing=`.

**P1-11. Moderation remove/restore have no status guard.** `app/api/admin/moderation/remove/route.ts:37-40` sets `removed` from any state including `pending_escrow` and `sold`; `restore/route.ts:36-39` sets `active` from any state, so a sold item can be reactivated and a `pending_review` item bypasses the payouts gate.

**P1-12. Boost re-purchase shortens an existing boost.** `app/api/webhooks/stripe/route.ts:338-347` sets `boosted_until = now + duration`, overwriting a later date, while `boost-client.tsx:152` promises an extension. Dormant behind `NEXT_PUBLIC_BOOSTED_POSTS_ENABLED`.

**P1-13. Apple button is live with no Apple provider.** `app/components/social-auth-buttons.tsx` always renders both providers (your instruction). Until Apple is configured in Supabase (Apple Developer account, Service ID, signing key) the button fails at Supabase's `/authorize`. Either configure Apple before testers arrive or hide the button until then. `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED` / `NEXT_PUBLIC_APPLE_AUTH_ENABLED` are now dead flags; `.env.example`, `docs/GOOGLE_OAUTH_SETUP.md` and the runbook still say they control the buttons.

### P2 (fix when convenient; none block testers)

- Edit mode drops BRAND (input editable at `sell-form.tsx:462`, not sent at `:318-319`, not in `PUBLISHED_EDITABLE` at `app/api/listings/[id]/route.ts:25`); clearing subcategory or colour never persists because nulls are skipped for published rows (`:55`).
- New-account velocity cap counts drafts (`app/api/listings/route.ts:150-154` has no `.neq('status','draft')`), so abandoned autosaved drafts eat the 5/day publish limit.
- PUBLISH is not disabled while a photo upload is in flight (`sell-form.tsx:596` checks only `submitting`); autosave drops an edit made during a slow save (`:177`, `dirtyRef` never read).
- Wizard fee box ignores the sub-$100 5% cap (`sell-form.tsx:149` uses `sellerFeeAt`, checkout uses `effectiveSellerBps`): $50 shows $4.00, actual $2.50.
- Draft detail page crashes on a draft with no brand (`app/listings/[id]/page.tsx:236` `listing.brand.toUpperCase()`; brand nullable since 0045).
- Listing page links `/sell?draft=` and `/sell?edit=` (`page.tsx:192,308`); the wizard is at `/sell/new`.
- Own pending checkout is not resumable within the 30-minute lock (`checkout/[listingId]/page.tsx:47-59` returns "no longer available" on refresh).
- Offer checkouts collect $0 shipping (`app/api/checkout/route.ts:159`). Confirm that is intended.
- Rate limiting covers checkout, listings POST, bump, comments, view, phone/start. Missing: boosts (creates a PaymentIntent per call), idv/start, conversations, messages, offers, saves, saved-searches, dispute, follows, reviews, `/api/stripe/balance` (3 Stripe calls per hit). Limiter fails open (`lib/rate-limit.ts:56-59`).
- Password policy mismatch: signup 10 chars + digit (`lib/auth/username.ts:30-36`), reset 8 (`app/reset-password/page.tsx:33,67`).
- `/enter?next=` open redirect via `/\evil.com` (`app/enter/page.tsx:23` rejects only `//`); reuse `resolveNext` from the callback.
- Callback failures all render as "Google sign-in failed" (`app/enter/login/page.tsx:14-17`); a recovery link for a user with no profile row is diverted to `/onboarding/account` (`callback/route.ts:57-58`) and never reaches `/reset-password`.
- `/onboarding/setup` is orphaned (nothing links to it after signup); `quick_setup.address` is written (`setup/page.tsx:78`) and read nowhere while the UI says it pre-fills checkout.
- Settings copy contradicts behavior: "IN-APP NOTIFICATIONS ARE ALWAYS ON" (`settings-sections.tsx:849`) while the flag suppresses them entirely (every `notify()` call site is wrapped in `if (NOTIFICATIONS_ENABLED)`, so the bell is fully dark, not just email/push).
- Community LC posting requires `id_verification_status='verified'` (`0045:153-157`); with `VERIFICATION_ENABLED=false` only moderators and admins can post, and the helper copy "VERIFY YOUR ID IN SETTINGS" points at a section that does not exist.
- 48-hour review edit is unreachable (`PATCH /api/reviews` has no caller); `review-prompt.tsx:78` allows 1000 chars, route slices to 600.
- Accept-offer ignores `expires_at` and listing status (`lib/offers.ts:43-45`, `accept/route.ts:49-79`); counter race treats a 0-row update as success (`counter/route.ts:58-66`); a seller-originated offer accepted by the buyer notifies the seller to "complete checkout" (`accept/route.ts:87`).
- `/fees` says buyers pay "tax" (`app/fees/page.tsx:45`); nothing computes tax. `[SUPPORT EMAIL]` placeholder on the same page.
- `app/api/recs/events/route.ts:18` reuses one `NextResponse` object for every call; a Response body is single-use, so the second request through that path likely throws. Fail-soft route, dark while `NEXT_PUBLIC_RECS_ENABLED=false`, trivial fix.
- `lib/supabase/types.ts` is stale (no 0045 columns, no `addresses`/`reports`/`conversation_reads`) and imported nowhere (all clients are `<any>`). Regenerate it or delete it; today it only misleads.
- `_to_delete/` in `recs-engine` is untracked and not gitignored (it is gitignored in the platform repo).
- Remove/restore/reject/relist show no error state on failure in the catalog UI.
- `tests/e2e/mobile.spec.ts:56` is data-dependent (see section 2); relax it to "dock bottom is at or above the viewport bottom and the footer is below it" or give the page a listing.

## 4. What you need to do to go fully live

Order matters. Steps marked CODE are changes in the repo; the rest are dashboards and terminals.

### 4.1 Code fixes before testers (CODE)

1. P0-1 buyer MARK AS RECEIVED in `shipped` + fallback auto-deliver.
2. P0-2 address capture at checkout + seller ship-to display.
3. P0-3 second webhook secret + `connect/return` account retrieve + explicit `transfers` capability.
4. P1-1 payouts banner/gate on `/sell`.
5. P1-5 anon grants for the LC thread (one small migration).
6. P1-13 decision on the Apple button.
7. P1-11 status guards on moderation remove/restore (five minutes).
Each of 1 to 3 touches money paths: run the code-reviewer gate, `pnpm verify && pnpm build && pnpm verify:ui`, and for item 5 db-guard before `supabase db push`.

### 4.2 Supabase (dashboard, rwabzxfyndpsqpmfmrim)

- `pnpm exec supabase migration list`: confirm 0043, 0044, 0045 all show in the Remote column. Then regenerate `lib/supabase/types.ts` (`unset SUPABASE_ACCESS_TOKEN && pnpm exec supabase login`, then `gen types`).
- SQL editor: `SELECT tablename FROM pg_tables WHERE schemaname='public' AND NOT rowsecurity;` must return 0 rows. `SELECT jobname, schedule FROM cron.job;` must list `auto-release-delivered-orders`, `release-expired-checkouts`, `expire-and-void-offers`, `expire-boosts`. These four are pg_cron jobs and are NOT replaced by the Vercel crons (the runbook's "pg_cron replaced" note is wrong; Vercel crons cover transfers, tier expiry and a second boost sweep only).
- Auth -> URL Configuration: Site URL `https://resale-platform-eta.vercel.app`. Any redirect on that host is then allowed (GoTrue accepts redirects whose hostname equals the Site URL host), which covers `/api/auth/callback?next=...` used by signup, forgot-password and OAuth. Add `http://localhost:3000/**` for dev.
- Auth -> Providers: Google enabled with the Cloud Console client (redirect URI `https://rwabzxfyndpsqpmfmrim.supabase.co/auth/v1/callback`). Apple only if you keep the button (see P1-13).
- Auth -> Email: the code expects "Confirm email" OFF (signup auto-signs-in and inserts the profile; with confirmation ON the user sees CHECK YOUR EMAIL and the callback finishes at `/onboarding/account`). Either is workable; pick one and test it. Keep the default templates (they use `{{ .ConfirmationURL }}`, which the PKCE callback expects). Minimum password length must be 8 or lower until P2 aligns the two policies.
- Auth -> SMTP: the built-in mailer is rate-limited to a handful of emails per hour. Password resets and confirmations go through it. Custom SMTP needs a verified sending domain, so this waits for the domain; until then expect reset emails to throttle if several testers reset at once.
- Storage: nothing to create by hand. `product-images` (public, 10 MB, jpeg/png/webp) comes from migration 0005; avatar and review-photo policies from 0045 and 0005.
- Add-ons: PITR or daily backups. Security Advisor clean. Leaked-password protection on.
- Make yourself admin once on prod: `UPDATE profiles SET role='admin' WHERE username='<you>';` (`role` has no authenticated UPDATE grant since 0043, so this is SQL-editor only).

### 4.3 Stripe (Live mode)

- Activate the live account with the corporation's details (EIN, bank). Complete the Connect platform profile. Enable Stripe Identity only if you plan to flip `VERIFICATION_ENABLED`.
- Connect settings: Express accounts must have `transfers` requested by default, or ship the code change in P0-3.
- Webhooks: TWO endpoints, both at `https://resale-platform-eta.vercel.app/api/webhooks/stripe`.
  - "Events on your account": `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.refunded`, `identity.verification_session.verified`, `identity.verification_session.canceled`, `identity.verification_session.requires_input`. Signing secret -> `STRIPE_WEBHOOK_SECRET`.
  - "Events on Connected accounts": `account.updated`. Signing secret -> `STRIPE_CONNECT_WEBHOOK_SECRET` (new, P0-3).
  - `charge.dispute.created` has no handler yet (P1-3); add it to the first endpoint when the handler exists.
- Keys: `sk_live_...` -> `STRIPE_SECRET_KEY`, `pk_live_...` -> `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`.
- Payouts: expect `balance_insufficient` on the first transfers until card funds settle (P1-2), or ship `source_transaction`.
- Card payments only via Card Elements; no Apple Pay, Link or wallets are wired. Fine for alpha.
- Smoke with real money once (LAUNCH_RUNBOOK Phase 5 step 24), then refund yourselves.

### 4.4 Vercel (project resale-platform-eta, Hobby)

Set these in Production and redeploy (NEXT_PUBLIC_* are build-time):

Required now: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_CONNECT_WEBHOOK_SECRET` (after P0-3), `NEXT_PUBLIC_APP_URL=https://resale-platform-eta.vercel.app` (Connect return URLs, Identity return URL, email links and canonicals all derive from it; unset means `http://localhost:3000`, which Stripe live rejects), `CRON_SECRET` (`openssl rand -hex 32`; the three cron routes refuse to run without it).
Recommended: `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST`, `SENTRY_DSN` (Sentry wraps the build only when set; `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` only for source-map upload).
Leave unset for the tester window: every feature flag, `RESEND_*`, `VAPID_*`, `TWILIO_*`, `SHIPPING_PROVIDER_API_KEY`, `EASYPOST_WEBHOOK_SECRET`, `RECS_*`, `SEO_INDEXING_ENABLED`.
Do not set: `SUPABASE_DB_PASSWORD` (the app never reads it), `SEED_SECRET`, `TEST_*`, `NODE_ENV`.
Crons: `vercel.json` registers process-transfers 06:00, boost-expiry 07:00, tier-expiry 09:00 UTC, daily (Hobby rejects sub-daily). They register on the next successful production deploy; check Project -> Crons afterwards.
Deployment Protection off (testers need the public URL). Hobby blocks deploys of commits authored by anyone but you (relevant when your UI collaborator joins).

### 4.5 Flags, in order, one redeploy each (later)

`IDENTITY_LOCKS_ENABLED` and `COLLUSION_HOLD_ENABLED` (no vendor, safe now) -> `TIER_DASHBOARD_ENABLED` (display only) -> `VERIFICATION_ENABLED` (after Identity is enabled in Stripe) -> with the domain: `NOTIFICATIONS_ENABLED` + `RESEND_API_KEY` + `NOTIFY_EMAIL_FROM` + the four `VAPID_*` (fix P1-4, P1-6, P1-8 first) -> `PHONE_VERIFICATION_ENABLED` + three `TWILIO_*` before open signups -> `SHIPPING_LABELS_ENABLED` + `SHIPPING_PROVIDER_API_KEY` + `EASYPOST_WEBHOOK_SECRET` + the EasyPost tracker webhook registered at `/api/webhooks/easypost` -> `RECS_ENABLED` then `NEXT_PUBLIC_RECS_ENABLED` (section 5) -> `BUMP_ENABLED`, `NEXT_PUBLIC_BOOSTED_POSTS_ENABLED`, `SAVED_SEARCH_ALERTS_ENABLED` (fix P1-7), `FOLLOWS_ENABLED`, `REVIEWS_ENABLED`, `BUYER_REWARDS_ENABLED`, `AUTH_BADGE_ENABLED` when there is liquidity -> `SEO_INDEXING_ENABLED` only at real-domain cutover with the updated `NEXT_PUBLIC_APP_URL`.

### 4.6 Google and Apple

Google: Cloud Console OAuth client (Web), authorized redirect URI is the Supabase callback above, consent screen External. In Testing mode only listed test users can sign in; either add your testers or publish (unverified warning is acceptable for trusted testers). Paste client ID and secret into Supabase. No Vercel env needed any more; the button always renders.
Apple: Apple Developer Program ($99/yr), an App ID + Services ID, a Sign in with Apple key, the Supabase callback as the return URL, then enable the provider in Supabase. Or hide the button (P1-13).

### 4.7 Legal and company

The corporation exists, so `[COMPANY LEGAL NAME]`, `[PHYSICAL ADDRESS]`, `[ARBITRATION VENUE COUNTY]`, `[LEGAL EMAIL]`, `[SUPPORT EMAIL]`, `[PRIVACY EMAIL]`, `[REPORT PHONE NUMBER]`, `[DMCA AGENT ...]` and `[EFFECTIVE DATE]` in `docs/legal/*.md` can be filled now (17 + 5 occurrences of the company name across the two pages). `[PLATFORM]` and `[DOMAIN]` wait for the name. Then `node scripts/generate-legal.mjs` regenerates `/terms` and `/privacy` and removes the alert-coloured marks. `lib/seo.ts` `SITE_NAME` is still "Resale Platform" (the wordmark says ARCHIVE). Attorney review, DMCA agent registration, CDTFA registration and the INFORM build gaps remain owed per `docs/legal/LEGAL_COMPLIANCE_NOTES.md`.

### 4.8 Docs to fix

`docs/HANDOFF.md` is dated 2026-08-18 and describes G11 on a feature branch as the current state. `docs/LAUNCH_RUNBOOK.md` still has Phase 0 items that are done, the one-endpoint webhook instruction (wrong, P0-3), "pg_cron replaced" (wrong), "mobile tab bar" (gone), and the Google-flag instruction (dead). `.env.example` lists four variables nothing reads (`EMAIL_PROVIDER_API_KEY`, `PUSH_PROVIDER_API_KEY`, `IDV_PROVIDER_API_KEY`, `IDV_PROVIDER_WEBHOOK_SECRET`) and omits fifteen the code does read (`NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `VAPID_PUBLIC_KEY`, `NEXT_PUBLIC_VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`, `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_VERIFY_SERVICE_SID`, `EASYPOST_WEBHOOK_SECRET`, `IDENTITY_LOCKS_ENABLED`, `COLLUSION_HOLD_ENABLED`, `PHONE_VERIFICATION_ENABLED`, `TIER_DASHBOARD_ENABLED`); its RECS block points at Cloud Run URLs while `ops/vps` is the day-one path. Your local `.env.local` still carries three `PERSONA_*` keys that nothing reads since G11.

## 5. Recs system

### 5.1 What it is, as built

Two FastAPI services plus four workers behind Caddy on one box (`recs-engine/ops/vps/docker-compose.prod.yml`): ingest `:8000` (`POST /v1/events:batch` HMAC device token, `POST /v1/listings` HMAC body signature), feed `:8001` (`GET /v1/feed`, `GET /v1/aesthetics`, `POST /v1/users/{key}/seed`, `POST /v1/identity/merge`, all Bearer token), Redis 7 streams (`events:raw`, `listings:changes`, `interactions:scored`), Qdrant 1.12.4 with one collection `items_v1` (three named 512-d cosine vectors `clip_base`, `aesthetic`, `graph_struct`, INT8, alias `items`), workers for scoring, profiles, indexing (encoder) and graph. Qdrant and Redis are containers in the compose file; there is no Qdrant Cloud account or API key to buy.

Platform side: `lib/recs/client.ts` (1.5 s timeout, returns null on any failure), `lib/recs/telemetry.ts` (browser batches, 5 s / 20 events, posted to `/api/recs/events` which signs server-side), listing sync at approve, restore, remove, refund, resolve, paid and refunded, `scripts/recs-backfill.ts`, cold-start picker in `/onboarding/setup`. Wire contract checked endpoint by endpoint against the engine's pydantic schemas: no drift. Fail-soft holds: browse renders default order when the feed is null, checkout and the Stripe webhook never call the engine on the request path, sync runs in `after()`.

### 5.2 Honest expectation at alpha

Turning it on at launch buys telemetry from user one. It does not buy visible personalization yet:
- `app/browse/page.tsx:100-115,197-200` fetches the feed only for signed-in users on the unfiltered first page and reorders only the 25 rows that page already loaded. Feed IDs not in those rows are dropped. So the effect is a reshuffle of the newest listings.
- The encoder is `stub` (deterministic hash vectors) until the fashion-CLIP ONNX export runs on your Mac (D-07). Indexing on the stub forces a re-embed later.
- `fusion_mode=jaccard` and `graph_struct=mirror` stay dormant by design (D-08/D-11 gates), and the feed process builds an empty attribute graph (`src/recs/feed/app.py:69`), so `matched_attributes` is always empty.
- Training has no input yet (5.3, item 3).

### 5.3 Engine defects to fix before deploying (CODE, recs-engine)

1. **Real encoder cannot load in the production image.** `onnxruntime` is only in the `[train]` extra (`pyproject.toml:37-48`); `Dockerfile:9` installs core deps only; `src/recs/embedding/runtime.py:21-23` raises `DependencyUnavailable("onnxruntime is not installed")`. With `RECS_ENCODER__KIND=onnx` the indexing worker crash-loops. Add `onnxruntime>=1.18` to core `dependencies`.
2. **Seed endpoint always 503.** `create_feed_app()` is launched via uvicorn `--factory` with no args (`docker-compose.prod.yml:88`), so `seeder=None` and `POST /v1/users/{key}/seed` raises `DependencyUnavailable` (`feed/app.py:150-151`). The onboarding aesthetic picker silently does nothing. Load `TextSeeder.from_npz(...)` in the factory from an env-configured path and ship the npz that `scripts/embed_taxonomy.py` produces.
3. **Event archive is never written.** `ArchiveConsumer` (`src/recs/streaming/archive.py:96`) is instantiated only in tests; `python -m recs.scoring` runs scoring + sweeper only (`scoring/__main__.py:21-35`). `backup.sh` ships an empty `data/events`. Raw events survive only in Redis (`events:raw`, maxlen 5M, AOF), so a box loss loses all telemetry and training has no source. Add the consumer to a worker's supervised set.
4. **Provision command in the docs fails.** `ops/vps/README.md:73,92` runs `provision.py` via the `api` service, which sets only `RECS_REDIS__URL` (`docker-compose.prod.yml:82`), so Qdrant resolves to localhost. Run it via `feed` (which has `RECS_QDRANT__URL`) or add the var to `api`.
5. Dev defaults are valid prod secrets (`config.py:33` `dev-secret-change-me`, `:225` `dev-feed-token`); refuse them unless an explicit override is set.
6. `/metrics` and `/healthz` are public through Caddy; block `/metrics` in the Caddyfile.

Platform side (CODE, resale-platform): `app/api/recs/events/route.ts:21-36` forwards client-supplied `user_id` with no `getUser()`, so any client can poison any profile; overwrite `user_id` server-side. `lib/recs/listing-map.ts:35-39` sends all six slots including the POSSESSION photo to the engine; slice to the four product photos. Seller edits of an active listing never send `updated` (`app/api/listings/[id]/route.ts:76`). Anonymous impressions never flush on the timer because `recsInit` is gated on `userId` (`browse-client.tsx:405-410`). To make personalization visible, hydrate the feed IDs with an `.in('id', ...)` query and prepend them instead of reordering the page.

### 5.4 Steps to get recs live (after 5.3)

1. Mac: `cd recs-engine && pip install -e ".[train]"` then `python scripts/export.py --base patrickjohncyh/fashion-clip --out models/clip_base.onnx` (needs Hugging Face access to that model and a working torch). Keep the file; it is the only artifact that must exist before the first backfill.
2. Hetzner: one CX32 (4 shared vCPU, 8 GB, ~$8/mo) on Ubuntu LTS, SSH keys only. Install Docker Engine + compose plugin + rclone. `ufw allow 22,80,443/tcp && ufw enable`. Never publish Redis or Qdrant ports (Docker bypasses ufw; the compose file publishes only Caddy).
3. DNS: two A records to the box, `ingest.<host>` and `recs.<host>`. These are API hostnames no user sees, so any domain you already control works; the brand domain is not a dependency here. Caddy provisions TLS on first request.
4. Box: clone the private repo (deploy key or a fine-grained token) to `/opt/recs-engine`, `cd ops/vps`, `cp env.example .env`, fill `INGEST_DOMAIN`, `FEED_DOMAIN`, `RECS_INGEST__HMAC_SECRET` and `RECS_FEED__API_TOKEN` (each `openssl rand -hex 32`), `RECS_ENCODER__KIND=onnx`, `RECS_ENCODER__BASE_ONNX_PATH=/app/models/clip_base.onnx`, `RCLONE_REMOTE`. `mkdir -p models data/events backups/qdrant-snapshots`, `scp` the ONNX into `models/`.
5. `docker compose -f docker-compose.prod.yml up -d --build`, then `docker compose -f docker-compose.prod.yml run --rm feed python scripts/provision.py ensure` (feed, not api). `provision.py status` must show the `items` alias.
6. Backups: `rclone config` a Hetzner Storage Box (~$4/mo) or Cloudflare R2 remote, name it in `.env`, `crontab -e` -> `20 4 * * * /opt/recs-engine/ops/vps/backup.sh >> /var/log/recs-backup.log 2>&1`. Not optional: the box holds the only copy of the event archive.
7. Vercel: `RECS_INGEST_URL=https://ingest.<host>`, `RECS_FEED_URL=https://recs.<host>`, `RECS_FEED_API_TOKEN`, `RECS_INGEST_HMAC_SECRET` (must equal the box), then `RECS_ENABLED=true` (runtime flag, enables feed fetch, sync and the proxies).
8. Backfill from the Mac with prod env in the shell (`NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, the four `RECS_*`): `RECS_ENABLED=true pnpm tsx scripts/recs-backfill.ts --dry-run` then `--confirm`. It posts every `active` listing with photos and exits 2 on any failure.
9. `NEXT_PUBLIC_RECS_ENABLED=true` in Vercel and redeploy (build-time; gates browser telemetry).
10. Verify: `curl -H "Authorization: Bearer $RECS_FEED_API_TOKEN" https://recs.<host>/v1/aesthetics` returns 16 aesthetics; `docker compose exec redis redis-cli XLEN events:raw` grows while you browse; `provision.py status` shows point counts.
11. Later: training runs off-box on a rented GPU against the parquet archive (once 5.3 item 3 exists); the D-07/D-08/D-11 gates decide when any of it affects the feed.

## 6. Bottom line

Frontend: confirmed. Backend as wired: three blockers in the launch configuration (escrow release, ship-to address, Connect webhook), all pre-existing, all small. Vendor side: Supabase needs URL config + Google + a confirm-email decision, Stripe needs live activation + two webhook endpoints, Vercel needs `NEXT_PUBLIC_APP_URL` + `CRON_SECRET` confirmed. Recs: four engine fixes, one VPS, one ONNX export, one backfill; expect telemetry, not visible personalization, at alpha.
