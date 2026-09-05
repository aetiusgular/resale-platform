> **Superseded 2026-09-05.** The founder chose native (SwiftUI on iOS, Compose on Android), one repo
> per platform, API-first against this backend. The current plan is `docs/MOBILE_PLAN.md`; the
> audit behind it is `docs/MOBILE_ARCHITECTURE_AUDIT.md`. This file is kept for the Apple-commission
> analysis (§ below), which still applies.

# IOS_PLAN.md — mobile app strategy (July 2026)

## Recommendation: Expo (React Native), not Swift

### Why
1. **Stack reuse.** The web app is Next.js + TypeScript + Supabase + Stripe. Expo
   uses the SAME `@supabase/supabase-js` client, the SAME TS types generated from
   the DB, the SAME business logic (lib/fees.ts, lib/orders.ts, lib/antislop-*),
   and Stripe ships an official `@stripe/stripe-react-native` SDK. A Swift build
   duplicates every one of those in a second language.
2. **Team shape.** Two founders, neither a full-time iOS engineer, agentic build
   process that is fluent in TS/React. Swift means a second toolchain, second
   review culture, second set of agent prompts — and no code sharing.
3. **Both platforms.** Your seller cohort is not iOS-exclusive. Expo ships iOS +
   Android from one codebase; Swift ships iOS only, and Android later doubles the
   cost again.
4. **Performance is a non-issue here.** RN's weak spot is heavy graphics/compute.
   A resale marketplace is lists, images, forms, and chat — RN handles this class
   of app fine in 2026.

**Choose Swift only if** the product later depends on iOS-specific capability
(advanced camera/AR authentication capture, Vision-framework on-device
inspection, Apple Wallet passes) or you hire an iOS specialist. Nothing in the
current roadmap requires it.

---

## ⚠️ APPLE COMMISSION — affects the PRICING MODEL, decide before building

Apple requires In-App Purchase (30% / 15% small-business) for **digital goods and
subscriptions** bought inside the app. It does NOT apply to **physical goods** —
those may (and must) use a normal payment processor like Stripe.

Consequences for us:
- ✅ **Item purchases (2% + 2% escrow flow) are physical goods → Stripe, no Apple cut.**
  The core marketplace transaction is unaffected. This is why Grailed/eBay/Depop
  run Stripe/PayPal in-app.
- ❌ **A membership fee ($20/yr, pricing option B) sold in-app is a digital
  subscription → Apple takes 30%** (15% under the Small Business Program, <$1M/yr).
  A $20 membership nets ~$17 on iOS.
- Mitigations, in order of preference:
  1. **Keep membership OUT of the app.** Sell it on the web; the app can read
     entitlement but must not link to external purchase (Apple's anti-steering
     rules have loosened in the US post-Epic, but stay conservative until counsel
     reviews).
  2. Price the membership so 15% is tolerable, and enroll in the Small Business
     Program (<$1M revenue = 15%).
  3. Drop membership entirely and run the flat-2% model (option A), which is
     Apple-clean end to end.
- **Action:** this is a business decision, not a technical one — take it before
  the app ships, and get it into the D1 pricing decision record.

---

## Architecture

```
repo/                     (current Next.js app — unchanged)
mobile/                   (new Expo app)
packages/shared/          (extract over time — NOT day one)
  ├── types (generated from Supabase)
  ├── fees.ts, orders.ts (pure logic, no DOM)
  └── api client wrappers
```
Do NOT attempt a full monorepo refactor up front. Start `mobile/` standalone,
importing the Supabase-generated types; extract shared logic only when a second
consumer proves the need.

**Key libraries:** expo-router (file-based routing, mirrors Next.js mental model)
· @supabase/supabase-js + expo-secure-store (token persistence — NOT AsyncStorage
for auth tokens) · @stripe/stripe-react-native (PaymentSheet; reuses the same
PaymentIntents our B5 backend already creates) · expo-image (fast image lists)
· expo-notifications (offers, messages, price drops — the single biggest reason
sellers install a native app at all).

**Backend: zero new work.** Every API route, RLS policy, webhook, and RPC already
built serves the app unchanged. The app is a second client, not a second backend.

---

## Phased plan

**Phase 0 — PWA stopgap (1 week, do this FIRST).**
After HF5's mobile overhaul, add a web manifest + icons so the site installs to the
home screen. Founders get an app-like experience immediately; you learn what mobile
users actually do before investing in native. Push notifications on iOS PWAs are
supported (iOS 16.4+) but flaky — treat as bonus.

**Phase 1 — Expo skeleton (2–3 weeks).** Auth (invite gate → login), browse +
search, listing detail, saved. Read-only paths first: no money, lowest risk.

**Phase 2 — Transactions (2–3 weeks).** Stripe PaymentSheet checkout against the
existing PaymentIntent flow, order tracking, offers + messages (Supabase Realtime
works in RN unchanged). Escrow/dispute UI mirrors web.

**Phase 3 — Native-only value (2 weeks).** Push notifications (offer received,
message, price drop, item sold), camera-first listing flow (the 6-slot photo
system is dramatically better with a native camera), share sheet.

**Phase 4 — Submit.** TestFlight to the 24 founders → App Store review. Budget 1–2
weeks for review friction; the common rejections for marketplaces are (a) IAP
violations — see above, (b) missing account deletion (Apple requires in-app
account deletion), (c) inadequate moderation/reporting for user content — our
comment flagging + block flows must be exposed in-app.

**Prerequisites regardless of path:** Apple Developer account ($99/yr, enroll
early — verification can take days), app icons/splash from the design system,
privacy nutrition labels, and an in-app account-deletion flow (Apple hard
requirement; we don't have one yet — add to the web app too).

---

## Cost/time summary
- Expo path: ~8–10 weeks part-time to App Store + Android for free.
- Swift path: ~12–16 weeks, iOS only, no code reuse, and a second toolchain for
  an agentic workflow currently tuned for TS.

**Decision: Expo.** Revisit only if authentication capture goes deep on native
camera/Vision APIs.
