# LAUNCH_SEQUENCE.md — flag-by-flag go-live order

Companion to `docs/LAUNCH.md` (env vars + Stripe cutover) and `docs/LAUNCH_SERVICES.md`
(vendor list). This file is the *order* in which to turn features on, their prerequisites,
and how to verify each. Every feature ships behind a flag defaulted **off** (see
`lib/flags.ts`), so production is safe until you flip each one. All G11 migrations are already
applied to the remote DB, so flipping a flag is env-only — no schema work.

## How flags take effect (mechanics)

- **Server flags** (`FOO_ENABLED`): set the env var in Vercel → **redeploy**. Env changes only
  apply to a new deployment.
- **Client flags** (`NEXT_PUBLIC_FOO`): baked at **build time** → you MUST redeploy to bake them
  into the browser bundle. Keep each server/public **mirror in sync** or the UI and API disagree:
  - `RECS_ENABLED` ↔ `NEXT_PUBLIC_RECS_ENABLED`
  - `BOOSTED_POSTS_ENABLED` = `NEXT_PUBLIC_BOOSTED_POSTS_ENABLED`
  - `GOOGLE_AUTH_ENABLED` = `NEXT_PUBLIC_GOOGLE_AUTH_ENABLED`
- **Flip one wave at a time**, smoke-test its flow, then proceed. **Rollback** is always: set the
  env back to `false` and redeploy. Nothing here rewrites data.

---

## Wave A — Foundations (before ANY user)

Do everything in `docs/LAUNCH.md` first: Vercel env, Supabase, **Stripe LIVE keys + webhook**
(HUMAN-ONLY), PostHog, Sentry, domain. Two additions to make now so you don't touch the webhook
again later:

- When creating the Stripe webhook endpoint, subscribe to the events LAUNCH.md lists
  (`payment_intent.succeeded`, `payment_intent.payment_failed`, `account.updated`,
  `charge.refunded`) **plus** `identity.verification_session.verified`,
  `identity.verification_session.canceled`, `identity.verification_session.requires_input`
  (used by Wave E). Subscribing early is harmless while `VERIFICATION_ENABLED=false`.

No feature flags on yet.

## Wave B — Auth + comms (before opening signups)

| Flag | Prereq | Verify |
|---|---|---|
| `GOOGLE_AUTH_ENABLED` (+ `NEXT_PUBLIC_`) | Google OAuth creds configured in Supabase (see `docs/GOOGLE_OAUTH_SETUP.md`) | Google button appears on /enter; sign-in round-trips |
| `PHONE_VERIFICATION_ENABLED` | Twilio (SMS OTP) wired (`lib/phone/`) | /settings phone verify sends a code and marks verified |
| `NOTIFICATIONS_ENABLED` | Resend API key + web-push VAPID keys | placing an order emails the seller; bell populates |

Phone is the identity anchor the anti-abuse locks lean on, so turn it on before Wave C.

## Wave C — Trust locks (at/just before first transactions)

| Flag | Prereq | Notes |
|---|---|---|
| `IDENTITY_LOCKS_ENABLED` | Stripe Connect live + the webhook from Wave A (needs `account.updated` + `payment_intent.succeeded`) | Bank fingerprint HARD-locked to one account; buyer card on ≥2 accounts flags the order (no block). Only *enforces on a collision*, so safe to enable at launch. No new vendor. |
| `COLLUSION_HOLD_ENABLED` | same webhook | Pre-payout collusion hold (ship-to-self, shared instruments). Complementary; enable once real payouts flow. |

Both are pure additive safety — the worst case of leaving them off is weaker abuse defense, not
breakage. Turn them on before you have real money moving.

## Wave D — Shipping  ⚠ read this carefully

**Today, shipping PRICING is already live and needs no flag.** Every listing gets
`listings.shipping_cents` = category floor + $2 (see `lib/shipping.ts`), the buyer pays it at
checkout, and the platform keeps the margin. Sellers currently ship **manually** and enter
tracking (existing tracking-capture flow).

`SHIPPING_LABELS_ENABLED` gates ONLY the live **EasyPost rate-quoting** (`lib/shipping-easypost.ts`),
and even that is a partial:

1. **To get live worst-zone quotes instead of the floor:** create an EasyPost account, set
   `SHIPPING_PROVIDER_API_KEY`, **and** wire the seller's ship-from ZIP into
   `makeEasypostRater(fromZip)` at `app/api/listings/route.ts` (currently passes `null` → always
   floor — see the TODO there). Then set `SHIPPING_LABELS_ENABLED=true`. This only improves the
   *price accuracy*; it does not buy labels.
2. **True prepaid labels do NOT exist yet.** There is no label-purchase flow in the codebase
   (no EasyPost `.buy()` anywhere). Delivering the "seller just prints a prepaid label" experience
   is a real build (buy the label at fulfillment from the collected shipping, expose it to the
   seller, capture tracking) — treat it as its own phase (e.g. **G12 — prepaid labels**), not a
   flag flip.

**Launch recommendation:** keep `SHIPPING_LABELS_ENABLED=false` for launch. Floor-based pricing
+ manual ship + tracking is fully functional. Schedule the ship-from-ZIP wiring and the
label-purchase build as post-launch work when volume justifies it.

## Wave E — INFORM ID verification (before any seller nears the threshold)

| Flag | Prereq | Notes |
|---|---|---|
| `VERIFICATION_ENABLED` | Stripe **Identity** enabled on the account + the `identity.verification_session.*` webhook events from Wave A | Dormant until a seller crosses $5k trailing sales (INFORM Act, conservative vs the 200-tx gate) — so no day-1 urgency, but it MUST be on before anyone actually crosses it. Enabling early is harmless. |

Provider is **Stripe Identity** (G11 repointed off Persona). Note: `docs/LAUNCH_SERVICES.md`
still lists "Persona" for seller verification and `docs/LAUNCH.md`'s webhook list predates the
identity events — update both when you do this wave.

## Wave F — Growth & engagement (post-liquidity)

Turn these on once you actually have users/supply; several are no-ops or noise without them.

| Flag | Prereq / depends on |
|---|---|
| `RECS_ENABLED` (+ `NEXT_PUBLIC_`) | recs-engine deployed + backfilled (see `docs/recs-hosting.md`, `recs-engine/ops/cloudrun/`). Fail-soft: off = default listing order. |
| `REVIEWS_ENABLED`, `FOLLOWS_ENABLED` | a user base (social proof) |
| `BUYER_REWARDS_ENABLED` | buyers transacting (loyalty milestones $1k/$5k/$10k) |
| `BOOSTED_POSTS_ENABLED` (+ `NEXT_PUBLIC_`) | seller supply + buyer demand (this is monetization) |
| `BUMP_ENABLED` | migration `0042` applied (creation-as-first-bump anchor). Free bump every 7 days, early via ≥10% price cut; default browse = boost → bump → recency on page 1 AND load-more; `/boost/[id]` cross-links the free bump. Listing volume worth refreshing. |
| `SAVED_SEARCH_ALERTS_ENABLED` | **requires `NOTIFICATIONS_ENABLED`** (Wave B) |
| `AUTH_BADGE_ENABLED` | authenticated-item badge/review flow |
| `TIER_DASHBOARD_ENABLED` | none — display-only; safe anytime |

---

## One-line summary of the critical path

Wave A foundations → **B** (google, phone, notifications) → **C** (identity +
collusion locks) → **E** (Stripe Identity, enable early, harmless) → open the doors. **D** shipping
stays floor-priced/manual-ship at launch; live rating + prepaid labels are follow-up builds.
**F** growth flags come on as liquidity appears. Every step: set env → redeploy → smoke-test →
next. Rollback = env back to false → redeploy.
