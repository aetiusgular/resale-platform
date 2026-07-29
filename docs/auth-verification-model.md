# Auth & Verification Model (decided 2026-07-26)

The account, login, and ID-verification model for launch. This is the **Grailed-style
low-friction** posture: strong account security for everyone, but ID verification is
reserved for the cases that actually need it, because a broad ID wall kills conversion.

## Principles

1. **Security for all, ID for few.** Every account is protected by 2FA. Almost no one
   is asked for government ID — only sellers, and only when risk or scale demands it.
2. **Buyers are never ID-gated.** Browsing, buying, commenting, and messaging never
   require ID. Nothing in the buy flow asks for a document.
3. **Sellers start free and unverified.** A new seller can list and sell immediately.
   ID verification is triggered later, only by risk or by volume (below).
4. **Money safety does not depend on ID.** Escrow, Stripe Connect KYC (Stripe's own
   payout requirement), and webhook-driven state are the money guardrails — separate
   from platform ID verification.

## Account creation & login

| Capability | Decision |
|---|---|
| 2FA | **Required for everyone** at account creation. No account exists without a second factor. |
| Sign-in methods | **Google OAuth**, **phone (SMS OTP)**, and **email** — user's choice. |
| Provider | Supabase Auth (Google provider + phone provider via Twilio + email). |
| Session authz | Server reads `getUser()` (never `getSession()`) for any authorization decision. |

Notes:
- Phone (SMS OTP) can double as the second factor for email/Google accounts, so "2FA
  required" and "phone login" reuse the same Twilio-backed channel.
- Google OAuth, phone provider, and email are **Supabase dashboard configuration** plus
  a Google Cloud OAuth credential and a Twilio account (see `docs/LAUNCH_SERVICES.md`).
  No account can bypass the second-factor step in the signup UI.

## Seller ID verification (Persona)

A seller must complete **Persona** ID verification only when **either** trigger fires:

1. **RISK** — a trust & safety flag: repeated bad ratings, or complaints about
   scamming / shipping fraud / refund abuse (buyer *or* seller side). Until ratings
   [G9] and T&S signals [G6] exist, this is driven by a **manual admin flag**
   (`riskFlagged` passed into the policy).
2. **VOLUME** — trailing-12-month **sales ≥ $5,000** (`SELLER_VERIFICATION_SALES_CENTS
   = 500_000` cents), reusing the fee engine's trailing-volume resolver (seller side).

Until a seller trips a trigger, they sell normally with no document ever requested.
When a trigger fires, selling / payouts are held pending Persona verification.

### ⚠️ Compliance flag (not legal advice)

The US **INFORM Consumers Act** requires **marketplaces** to verify a **high-volume
seller** — defined as **$5,000 in gross revenue AND 200+ transactions in a continuous
12-month period**. We trigger on the **$5,000** half *alone* (ignoring the 200-transaction
condition), which means we verify **more** sellers than the statute strictly requires —
the conservative, never-under-verify direction. Before US launch, confirm the final
threshold with a lawyer; if you ever want to match the statute exactly rather than
exceed it, add the 200-transaction AND-condition to the volume trigger.

## What this repo already contains

- `lib/idv/verification-policy.ts` — the decided policy as code:
  - `SELLER_VERIFICATION_SALES_CENTS = 500_000`
  - `salesTriggersVerification(cents)` — pure, inclusive-at-threshold boundary.
  - `sellerRequiresIdVerification(service, sellerId, { riskFlagged })` — risk flag
    short-circuits (no DB read); otherwise resolves trailing seller volume and compares.
- `tests/unit/verification-policy.test.ts` — boundary + risk-path tests.

## Build sequencing (what's left, and what it depends on)

| Piece | Where it runs | Depends on |
|---|---|---|
| 2FA-required signup enforcement | Supabase config + signup UI (on-computer) | Supabase project settings |
| Google OAuth login | Supabase + Google Cloud creds (Founder) | Google Cloud OAuth app |
| Phone (SMS OTP) login + 2FA | Supabase phone provider + Twilio (Founder) | Twilio account |
| Persona verification flow + webhook | on-computer code + Persona account (Founder) | Persona API key |
| **Volume** trigger wiring into sell/payout gate | on-computer code | already buildable (policy exists) |
| **Risk** trigger (automatic) | on-computer code | ratings **[G9]** + T&S signals **[G6]** |
| Remove/relax old comment ID-gate | on-computer code | product decision above (commenting is never ID-gated) |

The **volume** path is fully buildable now (the policy + trailing-volume resolver both
exist). The **automatic risk** path is blocked on G9 (ratings) and G6 (T&S signals);
until those land, a manual admin `riskFlagged` covers the risk trigger.

All auth/UI code (2FA enforcement, OAuth/phone screens, Persona webhook, comment-gate
removal) is built **on-computer** and must pass the **code-reviewer** subagent before
commit (auth + money-adjacent surface).
