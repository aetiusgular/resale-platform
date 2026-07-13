# STRIPE_TESTING.md — Stripe test mode workflow

## Overview

This project uses Stripe's test mode for all local and CI testing. No real money moves.
Live e2e tests (tagged `@live`) require a running Stripe webhook listener and specific test accounts.

---

## Stripe CLI setup

The Stripe CLI is at `~/bin/stripe`. It is NOT logged in via browser session — pass
`--api-key` with the value of `STRIPE_SECRET_KEY` on every invocation.

```bash
# Parse STRIPE_SECRET_KEY from .env.local (never echo the value)
SK=$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2)
```

---

## Webhook listener (required for @live tests)

Start the listener as a **bounded background process** before running @live specs:

```bash
SK=$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2)
~/bin/stripe listen \
  --api-key "$SK" \
  --forward-to localhost:3000/api/webhooks/stripe \
  &
STRIPE_LISTEN_PID=$!

# Run your tests here
pnpm exec playwright test --grep "@live"

# Teardown — always kill the listener
kill $STRIPE_LISTEN_PID 2>/dev/null
```

The listener prints the webhook signing secret on startup. Copy it into `.env.local` as
`STRIPE_WEBHOOK_SECRET`. This secret rotates every time the listener restarts.

**Never leave the listener running unattended.** Always bind its lifetime to the test process.

---

## Triggering events deterministically

Use `stripe trigger` to inject specific webhook events without going through the UI:

```bash
SK=$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2)

# Successful payment
~/bin/stripe trigger payment_intent.succeeded --api-key "$SK"

# Failed payment
~/bin/stripe trigger payment_intent.payment_failed --api-key "$SK"

# Charge refunded
~/bin/stripe trigger charge.refunded --api-key "$SK"

# Connect account updated (payouts_enabled)
~/bin/stripe trigger account.updated --api-key "$SK"
```

Triggered events use Stripe's built-in test fixtures. They will have synthetic IDs and
metadata — the webhook handler guards against missing metadata and handles them gracefully.

---

## Test cards

| Scenario | Card number | Exp | CVC |
|----------|-------------|-----|-----|
| Successful payment | `4242 4242 4242 4242` | `12/29` | `123` |
| Declined — insufficient funds | `4000 0000 0000 9995` | any | any |
| Declined — card error | `4000 0000 0000 0002` | any | any |
| 3D Secure required | `4000 0025 0000 3155` | any | any |
| Always authenticate | `4000 0027 6000 3184` | any | any |

Use any future expiry date and any 3-digit CVC. Billing ZIP: `12345`.

---

## Happy path (end-to-end)

Prerequisites:
- `.env.local` with `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, Supabase vars
- `TEST_BUYER_EMAIL`, `TEST_BUYER_PASSWORD` — buyer account with no active orders
- `TEST_SELLER_EMAIL`, `TEST_SELLER_PASSWORD` — seller account with `payouts_enabled=true`
- `TEST_ADMIN_EMAIL`, `TEST_ADMIN_PASSWORD` — admin account
- `TEST_LISTING_ID` — an active listing owned by the test seller

```bash
SK=$(grep '^STRIPE_SECRET_KEY=' .env.local | cut -d= -f2)
~/bin/stripe listen --api-key "$SK" --forward-to localhost:3000/api/webhooks/stripe &
LISTEN_PID=$!

RUN_LIVE_TESTS=1 pnpm exec playwright test tests/e2e/checkout.spec.ts

kill $LISTEN_PID
```

Expected sequence:
1. Buyer → `/checkout/{listing_id}` → fills address + test card → PAY
2. `payment_intent.succeeded` webhook fires → order created (`paid_held`), listing → `sold`
3. Buyer redirected to `/orders/{id}` — timeline shows PAID & HELD
4. Seller → `/orders/{id}` → CONFIRM ORDER → seller_confirmed
5. Seller → MARK AS SHIPPED (carrier + tracking) → shipped
6. Buyer → CONFIRM RECEIPT → delivered → released → Stripe transfer created
7. Assert `stripe_transfer_id` is set on the order
8. Assert transfer amount = `transfer_cents` = `item_cents - seller_fee_cents`

---

## Time-travel the auto-release check

The pg_cron `auto_release_delivered_orders()` function fires when `delivered_at < now() - 3 days`.
In tests, backdate `delivered_at` directly instead of waiting:

```typescript
const svc = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// Backdate 4 days ago
await svc
  .from('orders')
  .update({ delivered_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString() })
  .eq('id', orderId)

// Call the function directly
const { error } = await svc.rpc('auto_release_delivered_orders')
```

The function is granted to `service_role` — calling it via the service client works.

---

## Idempotency test

To verify a webhook event is not processed twice:

```typescript
// Find an existing event
const { data: ev } = await svc
  .from('order_events')
  .select('stripe_event_id, order_id')
  .not('stripe_event_id', 'is', null)
  .limit(1).single()

// Replay via transition_order with the same stripe_event_id
await svc.rpc('transition_order', {
  p_order_id: ev.order_id,
  p_to_state: 'paid_held',
  p_source: 'webhook',
  p_stripe_event: ev.stripe_event_id,  // duplicate!
  p_payload: null,
})

// Verify: still exactly 1 row with this event_id
const { count } = await svc
  .from('order_events')
  .select('*', { count: 'exact', head: true })
  .eq('stripe_event_id', ev.stripe_event_id)

expect(count).toBe(1)  // idempotent — no double write
```

---

## Cron endpoint testing

The `/api/cron/process-transfers` endpoint requires `CRON_SECRET`:

```bash
CRON_SECRET=$(grep '^CRON_SECRET=' .env.local | cut -d= -f2)
curl -H "Authorization: Bearer $CRON_SECRET" http://localhost:3000/api/cron/process-transfers
```

To test auto-release end-to-end without waiting:
1. Create an order in `delivered` state (via happy path or direct DB insert)
2. Backdate `delivered_at` (see above)
3. Call `auto_release_delivered_orders()` via service client RPC
4. Call the cron endpoint to trigger the Stripe transfer
5. Assert `stripe_transfer_id` is set on the order

---

## Dispute flow

1. Order must be in `delivered` state with `delivered_at` within 72h
2. Buyer uploads at least 1 photo to `product-images` bucket under their user path
3. Buyer submits dispute form → order → `disputed`, auto-release frozen
4. Admin → `/admin/orders/{id}/resolve` with `{ resolution: 'release' | 'refund' }`
5. On refund: Stripe refund issued; on release: Stripe transfer created

To test dispute freeze:
```typescript
// Set order to delivered, insert dispute, backdate, call cron — order must stay in delivered
```
See `tests/e2e/checkout.spec.ts` → `@live dispute freezes auto-release` for the full test.

---

## Environment variables

| Variable | Required | Notes |
|----------|----------|-------|
| `STRIPE_SECRET_KEY` | Yes | Server-only, never `NEXT_PUBLIC_` |
| `STRIPE_WEBHOOK_SECRET` | Yes | From `stripe listen` output; rotates per session |
| `STRIPE_PUBLISHABLE_KEY` | Yes | Client-safe, `NEXT_PUBLIC_` prefix |
| `CRON_SECRET` | Yes | Arbitrary secret for cron endpoint auth |
| `NEXT_PUBLIC_APP_URL` | Optional | Defaults to `http://localhost:3000` for Connect redirects |
