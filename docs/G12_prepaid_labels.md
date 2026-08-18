# G12 — Prepaid shipping labels (EasyPost label purchase)

Phase spec. New branch off `main` (e.g. `feat/prepaid-labels`). **Money-path + external I/O —
db-guard + code-reviewer + native `pnpm verify` required.** Gated behind the existing
`SHIPPING_LABELS_ENABLED` flag; OFF = today's manual-ship flow is completely unchanged.

## 1. What this is

G11 shipped the shipping **pricing** (buyer pays `listings.shipping_cents` = category floor + $2,
platform keeps it; seller ships manually and types a tracking number). G12 turns that collected
money into an actual **prepaid label**: the platform buys an EasyPost label at fulfillment, the
seller prints it and drops off, and tracking flows automatically. The buyer never re-pays; the
platform's margin is `shipping_cents − actual_label_cost` (≥ ~$2 by construction, since G11 priced
at the worst realistic zone and the real zone is ≤ that).

This is the one piece of the G11 shipping vision that is specced but NOT implemented — there is no
label-purchase code in the repo today (no EasyPost `.buy()` anywhere). G12 builds it.

**Scope: domestic (US) ground only.** International labels + HS/customs are explicitly out of scope
(they're the future "trained international-label" work, not this phase).

## 2. Locked decisions

1. **Sellers do not choose carrier/service** — the platform buys the cheapest enabled GROUND
   service (USPS Ground Advantage default; UPS Ground if a UPS carrier account is attached in
   EasyPost) for the same **category parcel preset** used to price the listing (`lib/shipping.ts`
   `presetFor`). Consistent with G11 "system determines shipping."
2. **One platform EasyPost account pays for labels.** The buyer's pre-collected `shipping_cents`
   funds it; the platform keeps the spread. No new charge to buyer or seller.
3. **Label is bought automatically at seller-confirm** (Fork A) — not a separate seller step.
4. **Buying a label does NOT transition to `shipped`.** Label-bought = "ready to ship"; the order
   stays `seller_confirmed` with a label attached. `shipped` is set by the seller's existing
   "Mark shipped" action (now a one-click confirm of the pre-bought tracking) OR the tracker's
   first movement. Escrow release is UNCHANGED (buyer-confirm or the 3-day auto-release cron).
5. **Everything is behind `SHIPPING_LABELS_ENABLED`.** Off (today): the manual `POST
   /api/orders/[id]/ship` carrier+tracking entry is the flow, untouched. On: label auto-bought,
   manual entry becomes the fallback when a buy fails.
6. **Full recipient address is required** and is NEW capture (§3, Fork B) — today the order keeps
   only city/state/zip ("no PII"), which cannot produce a label.

## 3. Forks to confirm before coding

**Fork A — buy trigger.** Recommendation: **auto-buy on the `paid_held → seller_confirmed`
transition** (the seller accepting the sale). Alternative: an explicit "Buy label" button. →
**Recommend auto on seller-confirm**, with a manual "retry label" button for the failure path.

**Fork B — full-address capture + verification.** A label needs `name, street1, (street2), city,
state, zip, country`. Options: (a) require the buyer to enter/confirm a complete shipping address
at checkout, validated + stored on the order; (b) require a complete, EasyPost-verified address on
the buyer's profile before they can check out. → **Recommend (a): capture a complete address at
checkout, run EasyPost address verification, store the full snapshot on the order.** Also decide
the seller **ship-from** address source: reuse `profiles.shipping_address` as ship-from, or add a
dedicated `profiles.ship_from_address`. → **Recommend a dedicated ship-from on the seller profile**
(a seller's return address ≠ their buying address).

**Fork C — label cost exceeds collected shipping** (rare: oversize / remote / AK-HI). Recommend:
**platform eats the difference**, buy the label anyway, log for preset tuning. Never re-bill the
buyer or block the sale on it. (Alternative: block + ask seller to adjust — worse UX.)

**Fork D — carrier "delivered" vs escrow.** Recommendation: the EasyPost tracker's `delivered`
status sets `orders.delivered_at` and transitions to `delivered` (starting the existing 3-day
auto-release clock), but does NOT itself release funds — release stays buyer-confirm or the cron.
→ **Recommend as stated** (carrier scan starts the clock; it doesn't skip the buyer's window).

## 4. Schema (migration 0039)

- `orders` label columns: `shipping_label_url TEXT`, `shipping_label_cost_cents INT`,
  `easypost_shipment_id TEXT`, `easypost_tracker_id TEXT`, `label_purchased_at TIMESTAMPTZ`,
  `label_refunded_at TIMESTAMPTZ`. (`carrier`, `tracking_number` already exist — reuse.)
- `orders.ship_to_address JSONB` — the COMPLETE recipient snapshot (name/street1/street2/city/
  state/zip/country) captured at checkout. (Keep the existing loose `shipping_address` for back-
  compat, or migrate to this one field — decide in review.)
- `profiles.ship_from_address JSONB` (Fork B) — the seller's return/ship-from address.
- Tracker idempotency: reuse the existing `verification_events`-style pattern OR add
  `shipping_events (provider, event_id UNIQUE, ...)`. Recommend a small `shipping_events` table so
  a replayed EasyPost webhook is a no-op.
- No fee/escrow column changes — `shipping_cents` is already collected at checkout.

## 5. EasyPost label adapter — `lib/shipping-labels.ts` (SERVER ONLY)

Reuses `presetFor` + the ground-service allowlist from G11. All guarded by `easypostConfigured()`
(from `lib/shipping-easypost.ts`); no-op/throw-safe when the flag is off.

- `buyShippingLabel({ from, to, preset }) → { shipmentId, trackerId, trackingCode, carrier,
  service, rateCents, labelUrl } | null` — create an EasyPost Shipment (from/to full addresses +
  parcel from preset), buy the lowest **enabled ground** rate, return the bought label. Rating is
  free; this call SPENDS money — only call it on the confirmed-sale path.
- `refundShippingLabel(shipmentId) → boolean` — EasyPost refund for an UNUSED label.
- `verifyAddress(addr) → { valid, normalized, messages }` — EasyPost address verification (Fork B).
- `parseTrackerEvent(event) → { trackingCode, status, deliveredAt|null, eventId }` — pure, for the
  webhook.
- `verifyEasypostSignature(rawBody, header, secret)` — HMAC verify the tracker webhook (mirror the
  old persona-signature helper's constant-time compare).

## 6. Fulfillment flow changes

- **Seller-confirm path** (the `paid_held → seller_confirmed` action): if `SHIPPING_LABELS_ENABLED`
  and both addresses are complete → `buyShippingLabel`, store label fields + `carrier`/
  `tracking_number` + `easypost_*` ids, `label_purchased_at`; register the tracker. On buy failure
  or missing address → leave the order confirmed with NO label and surface "add a tracking number
  manually" (the existing ship route) — never block the sale.
- **`POST /api/orders/[id]/ship`**: when a label exists, becomes a one-click "Mark shipped" using
  the stored tracking (no manual entry). When no label (flag off / fallback), unchanged manual
  carrier+tracking entry.
- **Seller UI** (`app/orders/[id]/order-seller.tsx`): "Print shipping label" (download `labelUrl`)
  + "Mark shipped"; show carrier + tracking. Hide the manual carrier/tracking inputs when a label
  is present.
- **Buyer UI**: tracking link once shipped (already partially present).

## 7. Tracking webhook — `app/api/webhooks/easypost/route.ts`

- Verify the EasyPost webhook signature over the RAW body BEFORE trusting anything (auth-critical).
- On `tracker.updated`: idempotent-log the event, update the order's tracking status; on
  `delivered` set `delivered_at` and transition `shipped → delivered` (Fork D). Release stays with
  the buyer-confirm / auto-release cron.
- Register the endpoint in the EasyPost dashboard; set `EASYPOST_WEBHOOK_SECRET`.

## 8. Refund / cancel handling

- Order refunded or cancelled AFTER a label was bought but BEFORE `shipped` → `refundShippingLabel`
  (unused-label refund), set `label_refunded_at`, recover the label cost. If already `shipped` →
  no label refund (it was used); the buyer refund is the existing escrow-refund path.
- Wire into the existing admin-refund / cancel transitions (mig 0024 / 0030 paths).

## 9. Disclosure / UI copy

- Seller: "Your prepaid label is ready — print it and drop off. Shipping was already paid by the
  buyer." No cost shown to the seller (the margin is platform-internal).
- Buyer: unchanged — they paid one disclosed shipping price at checkout; now they get tracking.

## 10. Edge cases

- Incomplete/unverifiable address → do NOT buy; prompt to complete; fall back to manual ship. Never
  ship to a bad address.
- `label_cost > shipping_cents` → platform eats it (Fork C); log `shipping_cents`, `rateCents`,
  category, to-zip for preset tuning.
- EasyPost down at confirm → no label, manual fallback; a "retry label" action re-attempts.
- Oversize/overweight beyond the preset → EasyPost may price high or reject; log + manual fallback.
- International destination → out of scope; block label-buy and require manual (until the intl phase).

## 11. Tests

- Pure: ground-rate selection (reuse/extend `parseCheapestGroundCents`), `parseTrackerEvent`,
  `verifyEasypostSignature` (valid/invalid/rotated), margin = `shipping_cents − rateCents`.
- Route/integration (mock EasyPost): buy-on-confirm happy path stores label + tracker; missing
  address → no buy, manual fallback; buy failure → order still confirmed, retry works; refund
  reverses an unused label; tracker `delivered` → `delivered_at` set, funds NOT released;
  webhook signature rejection.
- Flag-off: seller-confirm buys nothing; manual ship route unchanged.

## 12. Gates & files

- `db-guard` on migration `0039` (label columns, `ship_to_address`, `ship_from_address`,
  `shipping_events`).
- `code-reviewer` on `lib/shipping-labels.ts`, the seller-confirm buy path, the ship route change,
  the refund wiring, and the EasyPost webhook (money movement + external I/O + signature auth).
- `ui-verifier` on the seller print-label / mark-shipped UI and the full-address checkout capture.
- `pnpm verify` + `pnpm build` green; regen `lib/supabase/types.ts` after the migration.

## Prereqs to actually turn it on (Wave D in docs/LAUNCH_SEQUENCE.md)

EasyPost account + `SHIPPING_PROVIDER_API_KEY`; a UPS carrier account added in EasyPost (optional,
for UPS Ground); `EASYPOST_WEBHOOK_SECRET` + the tracker webhook registered; the ship-from-ZIP
wiring from G11's TODO (`makeEasypostRater(fromZip)`) so live quotes replace the floor. Then flip
`SHIPPING_LABELS_ENABLED=true`.
