# Business Model v2 — analysis & impact on the current build

Analysis of "Marketplace Business Model.pdf" (the Tiered Velocity Marketplace) against
what's built today. TL;DR: the **fee values** are a trivial change, but the doc adds four
genuinely new mechanics to the fee engine (order-count gate, $0.30 floor, single-item cap,
30-day status lock) and a **whole anti-fraud workstream** — one part of which (IMEI/MAC
device locking) is **not possible on a web platform** and needs a product decision.

---

## 1. Fee architecture — what changes

### 1a. Tier rates: uniform −0.50% across the board (trivial)
Every tier in the doc is exactly 50 bps below the current build. Nothing structural — just
new constants.

| Tier | Volume band | Rate each side (doc) | Current build | Δ |
|---|---|---|---|---|
| 1 Base | $0–999 | 5.0% (500 bps) | 5.5% (550) | −50 |
| 2 | $1,000–2,999 | 4.0% (400) | 4.5% (450) | −50 |
| 3 | $3,000–4,999 | 3.5% (350) | 4.0% (400) | −50 |
| 4 | $5,000–9,999 | 3.0% (300) | 3.5% (350) | −50 |
| 5 Elite | $10,000+ | 2.0% (200) | 2.5% (250) | −50 |

Change: `FEE_TIERS` bps values + `BASE_FEE_BPS 550→500` in `lib/fees.ts`; update
`fees.test.ts`. **Money-critical → code-reviewer.** Because fees are snapshotted per order,
existing orders are unaffected — only new checkouts get the new rate. Note F3 is already
**merged to main** (not flag-gated), so this is an edit to live money code.

### 1b. NEW — order-count gate (AND logic)  ⚠️ real logic change
A tier now requires **both** trailing volume **AND** a minimum completed-order count:

| Tier | Min volume | Min completed orders |
|---|---|---|
| 2 | $1,000 | 3 |
| 3 | $3,000 | 7 |
| 4 | $5,000 | 10 |
| 5 | $10,000 | 15 |

Today `feeBpsForVolumeCents(volume)` looks at volume only. This becomes
`feeBpsForActivity(volumeCents, orderCount)` — pick the richest tier where **volume ≥ min
AND count ≥ minOrders**. And `lib/fee-tier.ts`'s `trailingVolumeCents` must **also return
the trailing completed-order count** (same query + a count). Purpose: kills single-order
wash-trading to jump tiers. Effort: S–M. **Money-critical → code-reviewer + tests.**

### 1c. NEW — $0.30 minimum fee per side ($0.60/invoice)
Add `MIN_FEE_CENTS = 30`; `sellerFeeAt`/`buyerFeeAt` become
`max(round(price·bps/10000), 30)`. Protects against a per-transaction loss after the fixed
payment-processor cost on micro-items (the doc's Scenario B: a $10 item nets +$0.08 instead
of a loss). Effort: S. **Money-critical → code-reviewer + tests.**

### 1d. NEW — single-item cap (velocity protection)  ⚠️ needs a rule decision
"No single transaction contributes more than **20%** of the volume required to unlock the
next tier" — a $10,000 watch counts only $2,000 toward tier progress. This changes
`trailingVolumeCents` to cap **each order's contribution before summing** (select per-order
`item_cents`, apply `min(item_cents, cap)`, then sum) — it's no longer a plain SUM.
**Ambiguity to resolve:** "20% of the next tier's required volume" is slightly circular
(which next tier, relative to whom?). Simplest defensible rule: a **flat cap = 20% of the
Elite threshold = $2,000 per order** toward volume. Confirm this or give the exact formula.
Effort: M. **Money/anti-fraud → code-reviewer + tests.**

### 1e. NEW — 30-day status lock + grace  ⚠️ biggest architectural change
Today tiering is **stateless** — recomputed from trailing volume at each checkout. The doc
requires: when a user reaches a higher tier they **keep it ≥30 days even if rolling volume
drops**, plus dashboards and 14-day "expiring volume" warnings. That means **persisting tier
state**: e.g. `profiles.buyer_tier`, `buyer_tier_locked_until`, `seller_tier`,
`seller_tier_locked_until` (or a `tier_state` table), a **tier updater** that runs on each
completed order (recompute → upgrade + set a 30-day lock), and the resolver returns the
**better of** (current-volume tier, still-locked tier). Effort: M–L (migration + updater +
resolver rework). **db-guard + code-reviewer.**

### 1f. Safe-Zone warnings (14-day expiry push) + dual dashboards (UX)
"$500 of your Tier-4 volume expires in 14 days" push + "Buying Power / Selling Power"
progress circles. The push needs **G2 notifications** (bucket 2) + a scheduled job that finds
each user's soonest-expiring volume (an order created ~351 days ago). The dashboards are new
profile UI over the tier state from 1e. Effort: M, **depends on 1e + G2.** ui-verifier.

---

## 2. Anti-scam architecture — feasibility

### Layer 1 — Hardware-locked identity (registration)
- **SIM-linked phone / block VOIP & burners — FEASIBLE.** Twilio **Lookup Line Type
  Intelligence** is a live product that classifies a number as mobile / landline / **VOIP**,
  used exactly to block fake signups before sending an OTP. Combine with Twilio **Verify**
  (SMS OTP) and a **unique constraint on the verified phone** (one number = one account).
  This *extends* the auth decision already speced (phone 2FA via Twilio) with a pre-OTP
  line-type check. On-computer + Twilio account.
- **Device ID fingerprinting (IMEI/MAC) — NOT POSSIBLE on web.** ⚠️ Browsers do **not**
  expose IMEI or MAC addresses (privacy — they never have). The doc's "log out of Seller,
  log into Buyer on the same physical phone → collusion flag" is a **native-mobile-app**
  capability. On a web platform your realistic options are: (a) build **native iOS/Android
  apps** to read device identifiers (large scope), or (b) a **browser fingerprinting service**
  (e.g. Fingerprint/FingerprintJS Pro) — *probabilistic* device identification, materially
  weaker than a hardware ID but the web-standard approach. **Decision needed** (§4).

### Layer 2 — Collusion block engine (transaction level) — mostly FEASIBLE
Flag/block an order when buyer and seller match on:
- **Shared payout bank / routing** — Stripe exposes a stable **`fingerprint`** on external
  bank accounts; store it and compare. ✅
- **Shared card billing name / zip** — Stripe payment methods expose a card **`fingerprint`**
  + billing details; compare. ✅
- **Ship-to-self (dest = origin)** — normalize + compare buyer shipping vs seller address. ✅
This is a new pre-payout check that extends **G6** (flag → hold payout / block). Uses Stripe
fingerprints (must be captured + stored). code-reviewer.

### Layer 3 — Single-item cap = §1d above.

---

## 3. What the build already satisfies
- **Payout holding until delivered / escrow** — done: the order state machine holds funds
  and auto-releases 3 days after `delivered`, with a dispute window. The doc's "Next Step 1"
  is essentially built.
- **Refunds/cancels don't inflate velocity** — done: `trailingVolumeCents` already excludes
  `cancelled`/`refunded` (`NON_COUNTING_STATES`). The new order-**count** gate (1b) inherits
  the same exclusion, so fake returns won't pad the count either. The doc's "Next Step 2" is
  largely covered — just confirm the count query uses the same filter.
- **Asymmetric per-side rolling-365d tiers** — done (the core of F1–F3): each side is already
  rated on its own trailing activity. The doc's headline architecture is what you already
  shipped; v2 tunes the numbers and adds the four mechanics above.

---

## 4. Competitive context (research)
The v2 rates are competitive-to-aggressive, which fits the "high acquisition + retention"
goal. All-in 2026 marketplace fees for comparison: **Grailed ≈ 12%** (9% commission + 2.9%
+$0.30 processing, seller-side), **eBay ≈ 13.25%**, **Mercari ≈ 10%**, **Poshmark 20%**,
**Depop 0% seller commission + 3.3% +$0.45** (they moved the burden to buyers/processing).
Your model takes **10% combined at base (5 buyer / 5 seller), falling to 4% combined (2/2)
at Elite** — splitting across both sides (each side sees a smaller number) and rewarding
loyalty with real discounts. That base take is in line with Mercari and below Grailed/eBay;
the Elite take undercuts everyone. Charging **both** sides is less common (most charge the
seller), though Depop/Mercari have added buyer-side fees, so it's not out of step. No legal
blocker to buyer-side fees; just disclose clearly at checkout.

---

## 5. Consolidated change list

| # | Change | Files | Effort | Gate | Blocker |
|---|---|---|---|---|---|
| 1a | Tier rates −50 bps + base 5.0% | `lib/fees.ts`, `fees.test.ts` | S | code-reviewer | — |
| 1b | Order-count AND-gate | `lib/fees.ts`, `lib/fee-tier.ts`, tests | S–M | code-reviewer | — |
| 1c | $0.30 min fee / side | `lib/fees.ts`, tests | S | code-reviewer | — |
| 1d | Single-item 20% cap | `lib/fee-tier.ts`, tests | M | code-reviewer | **rule decision** |
| 1e | 30-day status lock (stateful tiers) | migration + resolver + updater | M–L | db-guard, code-reviewer | — |
| 1f | Safe-Zone push + dashboards | cron + notify + profile UI | M | code-reviewer, ui-verifier | **G2 (bucket 2)** + 1e |
| L1a | SIM/VOIP-blocked phone signup | Supabase + Twilio Lookup/Verify | M | code-reviewer | Twilio acct |
| L1b | Device fingerprinting | native app **or** FingerprintJS | L | code-reviewer | **product decision** |
| L2 | Collusion block engine | Stripe fingerprints + address compare, extends G6 | M–L | code-reviewer | Stripe fingerprint capture |

Most of 1a–1e is **cloud-buildable + verifiable** as pure logic (like the fee cores already
shipped); 1e adds a migration. L1/L2 are on-computer + accounts. None of this needs the
platform "live" to build and verify — same pattern as bucket 1.

## 6. Decisions I need from you (before building)
1. **Single-item cap rule (1d):** confirm "flat $2,000 per order (20% of the $10k Elite
   threshold)", or give the exact formula if it's per-tier.
2. **Device fingerprinting (L1b):** native mobile apps (real device IDs, big scope) **or** a
   web fingerprinting service (FingerprintJS-grade, probabilistic)? Web alone cannot read
   IMEI/MAC — this is a hard platform limit, not a build gap.
3. **Confirm the numbers:** rates −50 bps as tabled, order-count gates 0/3/7/10/15, $0.30
   floor, 30-day lock.
4. **Stateful tiers (1e):** OK to move tiering from stateless-recompute to persisted tier
   state? (Required for the lock, dashboards, and expiry warnings.)

## 7. Suggested sequencing
Do the **fee-engine v2** first as one branch — 1a+1b+1c together (they're all `lib/fees.ts`
+ `lib/fee-tier.ts` + tests, one coherent money change, one code-review), then **1d** once
the cap rule is confirmed, then **1e** (stateful lock, its own migration). The **anti-fraud**
layers (L1/L2) are a separate workstream that fits alongside the G4/G6 auth+T&S work already
in flight — L2 especially is a natural extension of the G6 moderation spine. 1f + safe-zone
warnings wait on G2 notifications.
