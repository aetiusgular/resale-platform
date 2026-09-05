# UI/UX Redesign — Feature & Page Blueprint

A complete functional inventory of the platform, built from the live `app/` routes, `app/components`, and the `*_ENABLED` feature flags. This is the **WHAT** — pages, layout blocks, features, and states. It does **not** prescribe visual design; that's what you'll define per-artboard in Claude Design.

**How to use this:** each screen below is one Claude Design artboard (some need a desktop + mobile variant, flagged). Under each, "Layout blocks" are the regions to lay out, "Elements" are the interactive pieces inside them, and "States" are the variants that need their own visual treatment (empty, loading, error, gated). Global chrome (§1) wraps every authenticated screen — design it once. The flag matrix (§13) tells you what's live now vs. designed-for-later.

---

## 1. Global chrome (design once, reuse everywhere)

**Site header** — `site-header.tsx`
- Layout blocks: brand/logo · primary nav · search entry · right cluster (notifications, avatar/menu OR sign-in).
- Guest state: nav + prominent **Sign in** button (opens auth modal, not a route).
- Authed state: nav + search + notification bell + avatar menu.
- States: guest / authed / scrolled (sticky condensed?) / mid-page search-active.

**Mobile tab bar** — `mobile-tabbar.tsx` (mobile only)
- Persistent bottom nav. Decide the 4–5 anchor destinations (likely: Browse · Saved · Sell · Messages · Account).
- States: active tab, unread badge (messages/notifications), Sell as emphasized center action.

**Auth modal** — `auth-modal.tsx` + `auth-modal-provider.tsx`
- A modal (not a page) that can front any screen. Modes: **login**, **sign-up / invite-code entry**, **forgot password**.
- Elements: email/password, OAuth buttons (Google, Apple — *flag-gated*), invite-code field, waitlist fallback, error/validation lines.
- States: default · loading · invalid code · wrong credentials · OAuth-only.

**Notification system** — `notification-bell.tsx` + `push-subscribe.tsx`
- Bell with unread count → dropdown/panel of notifications (offers, sales, messages, moderation, price drops).
- Push-permission prompt surface.
- States: empty · unread · read · push-enabled vs not. *(Flag: NOTIFICATIONS_ENABLED)*

**Avatar menu** — `avatar-menu.tsx`
- Dropdown: profile, orders, saved, settings, payouts, sign out, admin (if privileged).

**Shared atoms** — `listing-card.tsx`, `skeletons.tsx`, `guest-action.tsx`, `legal-doc.tsx`, `prefetch-link.tsx`
- **Listing card** is the single most reused element — appears in browse, seller profile, saved, recs. Design its states first: default · boosted · bumped · sold · price-dropped · saved(♥ active) · your-own-listing.
- Skeleton/loading placeholders for every list surface.
- **Guest action** = the "sign in to do X" interception pattern (save, message, buy, offer).
- Toasts / feedback, empty states, error states — define the reusable versions.

---

## 2. Entry & onboarding flow

**`/enter`** — invite/entry gate
- Blocks: brand moment · invite-code entry · waitlist capture · sign-in link.
- States: code valid → continue · invalid · waitlist joined.

**`/enter/login`** — dedicated login page (full-page counterpart to the modal).

**`/enter/forgot`** & **`/reset-password`** — password recovery
- Request-reset form → confirmation → set-new-password form. States: sent · token valid/expired · success.

**`/onboarding/account`** — account basics (username, display name, avatar).

**`/onboarding/setup`** — quick preferences (sizes, categories/aesthetics you follow, seed for recs).

**`/onboarding/verify`** — identity verification handoff — `app/onboarding/verify/*`
- ID-verification (Stripe Identity / Persona) start + status. *(Flag: VERIFICATION_ENABLED)*
- States: not started · in progress · verified · failed.

**`/banned`** — terminal state screen for banned accounts (message + appeal/contact path).

---

## 3. Discovery

**`/` → `/browse`** — main feed / search (root redirects here)
- Blocks: **filter rail** (left on desktop, drawer on mobile) · **active-filter chip rail** · **sort control** · full-text search · results grid of listing cards · pagination/infinite scroll.
- Result header: query echo ("N results FOR …"), active-filter count.
- States: results · loading (skeleton grid) · no results / empty search · guest vs authed (save/heart behavior) · recs-injected rows *(Flag: RECS_ENABLED)*.
- Mobile variant: filter **drawer** + sort sheet + horizontal chip rail. **(needs mobile artboard)**

### Filter rail — full spec (§3a)
Each filter is a collapsible **FilterSection** (▾/▴). Every option row shows a live **result count** (mono). Design one section pattern, then these facets top-to-bottom:

1. **My sizes** (personalization block, top) — toggle "hide listings that aren't your size" (accent when on) + edit/"set your sizes →" link. Guest state: replaced by a sign-in prompt card with an **Add my sizes** button (opens sizes popup). *(key: `my_sizes`)*
2. **Department** — single-select rows: `menswear · womenswear · unisex`, each with count. *(key: `dept`)*
3. **Category** — rows: `Outerwear · Tops · Bottoms · Footwear · Accessories · Tailoring · Denim · Knitwear`, each with count; open by default when active. *(key: `cat`)*
4. **Size** — free-text input (alpha sizes, e.g. "M", "42"), applies on blur. *(key: `size`)*
5. **Designer** — free-text brand input ("brand name"), applies on blur. *(key: `brand`)*
6. **Price** — min `$` + max `$` numeric inputs. *(keys: `min_price`, `max_price`)*
7. **Condition** — compact **1–10 scale** of tappable numbers (selecting N = "N and up", filled state), plus a **7+ ONLY** quick toggle; open by default. *(key: `cond`)*
8. **Seller location** — *placeholder section for alpha* (design the empty/coming-soon state).
9. **Show only** — checkbox group, open by default: **Authenticated** *(key: `authenticated`)* · **Verified** *(key: `verified`)* · **Price dropped** *(key: `dropped`)*. Authenticated/Verified tie to the trust system *(Flag: AUTH_BADGE_ENABLED)*.
10. **Followed searches** — *placeholder section* ("your followed searches appear here") *(Flag: SAVED_SEARCH_ALERTS_ENABLED)*.

**Sort control** — dropdown/sheet: `Newest · Price ↑ (price_asc) · Price ↓ (price_desc)` (extend as needed).

**Active-filter chips** — removable chips (label + ×) for every applied filter: free-text query, department, category, `Size: X`, brand, `Min $X`, `Max $X`, `Condition N+`, Verified, Authenticated, Price dropped. Include a **Clear all** action and an active-count. Desktop: chip row above the grid; mobile: horizontal scroll rail above results.

**Save this search** — CTA to persist the current filter set as a saved search (guests get the sign-in prompt) *(Flag: SAVED_SEARCH_ALERTS_ENABLED)*.

Filter states to design: default/collapsed · expanded · option selected (with count) · guest-gated (my sizes, save search) · placeholder/coming-soon (seller location, followed searches) · zero-count option · mobile drawer open.

**`/sellers/[username]`** — public seller profile — `app/sellers/[username]/*`
- Blocks: seller header (avatar, username, trust indicators, verified badge, follow button) · active-listings grid · review aggregate.
- Elements: **Follow** button *(Flag: FOLLOWS_ENABLED)* · review score summary *(Flag: REVIEWS_ENABLED)*.
- States: own profile vs others · verified vs not · no listings · new seller (no reviews).

**`/saved`** — saved items / searches / sellers — HF4
- Blocks: tabbed view — **Items · Searches · Sellers**.
- Items: grid with price-drop and sold overlays, × to unsave.
- Searches: saved-search rows with alert toggle *(Flag: SAVED_SEARCH_ALERTS_ENABLED)*.
- Sellers: followed-sellers list *(Flag: FOLLOWS_ENABLED)*.
- States: each tab has its own empty state · mobile 375 variant. **(needs mobile artboard)**

---

## 4. Listing detail & selling

**`/listings/[id]`** — single listing — `app/listings/[id]/*`
- Blocks: **image gallery** · **purchase panel** (price, Buy, Make Offer, Save) · **TRUST STRIP** · **seller block** · **community section**.
- Purchase panel elements: Buy now → checkout · Make offer · Save (♥) · Message seller (`message-seller-button.tsx`) · Bump (owner only, `bump-button.tsx`) *(Flag: BUMP_ENABLED)*.
- Trust: verified/authenticated marks, condition score with **condition popover** (`condition-popover.tsx`).
- **Community section** (`community-section.tsx`): comments thread + **Legit Check** panel — agree/flag on comments, LC-moderator-only replies, auto-authentication signals.
- States: available · sold · your own listing · pending-purchase (locked) · boosted · flagged/removed · guest (all actions route through guest-action).

**`/sell`** — create-listing wizard — `sell-form.tsx`
- Multi-step: image slots (**FRONT / BACK / TAG / DETAIL / FLAW / POSSESSION**) → details (title, brand, size, category) → **condition rubric** selector → pricing with **live fee math** → review & publish.
- Fee panel: shows tier-based fee, welcome-ramp discount, shipping-margin math.
- States: draft · per-step validation · image upload (uploading/failed/duplicate-detected via pHash) · fee recalculation · publish success (→ first-bump). **(needs mobile artboard)**

**`/boost/[listingId]`** — paid boost purchase — `app/boost/[listingId]/*`
- Blocks: boost tiers/durations · price · confirm-and-pay.
- States: eligible · already boosted (countdown) · payment. *(Flag: BOOSTED_POSTS_ENABLED)*

---

## 5. Checkout & orders (escrow)

**`/checkout/[listingId]`** — payment
- Blocks: order summary · **escrow explainer** · payment (Stripe PaymentIntent) · shipping address · fee breakdown.
- States: form · processing · card declined / retry · identity-lock challenge *(Flag: IDENTITY_LOCKS_ENABLED)* · offer-accepted price path.

**`/checkout/success`** — post-purchase confirmation — `app/checkout/success/*`
- Confirmation + what-happens-next (escrow timeline preview, link to order).

**`/orders`** — order list (buyer + seller views)
- Rows with status pills; filter by role/status. Empty state. **(needs mobile artboard)**

**`/orders/[id]`** — order detail — `app/orders/[id]/*`
- Blocks: **escrow timeline** (paid → shipped → delivered → auto-release countdown) · **PROTECTED** status card · shipping/tracking · action buttons by role.
- Actions: seller → **Ship** (buy prepaid label *(Flag: SHIPPING_LABELS_ENABLED)*) / mark shipped · buyer → **Confirm delivery** · either → **Open dispute**.
- States: each escrow stage · hold (collusion) *(Flag: COLLUSION_HOLD_ENABLED)* · disputed · refunded · released.

**`/orders/[id]/dispute`** — dispute flow
- Reason selection · evidence/notes · submission. States: open · under review · resolved.

---

## 6. Messaging

**`/messages`** — inbox
- Conversation list with counterparty, last message, unread, **pinned-listing** context. Empty state.

**`/messages/[id]`** — conversation thread — `app/messages/[id]/*`
- Blocks: **pinned listing bar** (the item in question) · realtime message stream · composer · **offer UI**.
- Offer UI: make / **counter** / accept / decline inline (ties to `/conversations/[id]/offers/*`).
- System lines: link/contact-blocking notices (PayPal/phone/email stripped), consent prompts.
- States: active · offer pending/accepted/declined · blocked-message system line · consent-required gate · counterparty banned. **(needs mobile artboard)**

---

## 7. Account & settings

**`/settings`** — account hub — `settings-client.tsx`
- Sections: profile basics · **address** (`address-form.tsx`) · **size preferences** · **phone verification** (`phone-verify.tsx`, *Flag: PHONE_VERIFICATION_ENABLED*) · **notification preferences** · **tier dashboard** (`tier-dashboard.tsx`, *Flag: TIER_DASHBOARD_ENABLED*).
- Tier dashboard: current tier, progress to next, fee benefits, expiry.

**`/settings/payouts`** — seller payouts — `app/settings/payouts/*`
- Stripe Express Connect onboarding + status · payout method · balance/history entry.
- States: not connected · onboarding incomplete · active · restricted.

---

## 8. Trust, rewards & tiers (cross-cutting — surfaces on multiple screens)

- **Verification / auth badge** — badge on cards, listing detail, seller profile, onboarding verify. *(Flags: VERIFICATION_ENABLED, AUTH_BADGE_ENABLED)*
- **Buyer rewards** — earn/redeem surface; touches checkout + account. *(Flag: BUYER_REWARDS_ENABLED)*
- **Seller tiers & fees** — tier drives fee math on sell + checkout + settings dashboard.
- **Recommendations** — aesthetic/identity-based rec rows in browse + onboarding seed. *(Flag: RECS_ENABLED)*

Design the **badge / trust-mark system** and the **status-pill system** as shared components — they recur across cards, listing detail, orders, and profiles.

---

## 9. Admin & moderation (separate visual mode — internal)

**`/admin/queue`** — listing approval queue — `app/admin/queue/*` (approve/reject).
**`/admin/moderation`** — moderation console — `app/admin/moderation/*` (ban/unban, remove/restore, authenticate/reject-auth, refund, release-hold).
**`/admin/metrics`** — internal metrics dashboard.

These can share a stripped-down admin chrome distinct from the consumer app. Lower design priority unless you want them in-scope now.

---

## 10. Legal & static

**`/fees`** — public fee schedule (tiers, shipping margin, examples).
**`/terms`** & **`/privacy`** — legal docs (`legal-doc.tsx` renderer).
**`/styleguide`** — internal design-system reference page (regenerate to match the new system).

---

## 11. Responsive coverage

Screens with an existing dedicated mobile treatment (build both artboards): **browse** (filter drawer), **saved** (375), **sell** wizard, **messages** thread, **orders**, plus the global **mobile tab bar**. Everything else should at least degrade cleanly, but these five are where mobile layout genuinely differs.

## 12. Suggested artboard build order

1. Global chrome + listing card (unblocks everything).
2. Browse (desktop + mobile).
3. Listing detail.
4. Sell wizard.
5. Checkout → success → order detail (the money path).
6. Messages inbox + thread.
7. Saved, seller profile.
8. Onboarding + auth modal.
9. Settings + payouts.
10. Admin, legal, styleguide.

## 13. Live vs. flag-gated (what to design now vs. later)

| Feature system | Flag | Design priority |
|---|---|---|
| Shipping prepaid labels | `SHIPPING_LABELS_ENABLED` (**default on**) | Now |
| Core browse/listing/checkout/orders/messages | — (always on) | Now |
| Verification / auth badge | `VERIFICATION_ENABLED`, `AUTH_BADGE_ENABLED` | Now (identity is core to trust) |
| Notifications + push | `NOTIFICATIONS_ENABLED` | Now |
| Seller tiers dashboard | `TIER_DASHBOARD_ENABLED` | Now |
| Phone verification | `PHONE_VERIFICATION_ENABLED` | Soon |
| Saved-search alerts | `SAVED_SEARCH_ALERTS_ENABLED` | Soon |
| Recommendations | `RECS_ENABLED` | Soon |
| Follows | `FOLLOWS_ENABLED` | Later |
| Reviews | `REVIEWS_ENABLED` | Later |
| Boosted posts | `BOOSTED_POSTS_ENABLED` | Later |
| Bump | `BUMP_ENABLED` | Later |
| Buyer rewards | `BUYER_REWARDS_ENABLED` | Later |
| Collusion hold / identity locks | `COLLUSION_HOLD_ENABLED`, `IDENTITY_LOCKS_ENABLED` | Later (mostly backend + status states) |
| Google / Apple OAuth | `GOOGLE_AUTH_ENABLED`, `APPLE_AUTH_ENABLED` | When enabled (auth modal buttons) |

Design the "Now" and "Soon" surfaces fully; for "Later" features, at minimum design the card/detail **states** they introduce (boosted card, sold overlay, review score, follow button) so switching a flag on doesn't require a redesign.
