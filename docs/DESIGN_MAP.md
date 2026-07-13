# DESIGN_MAP.md
## Design reference inventory — one row per .dc.html export

Source: `design-reference/` (copied from `/Users/tonyg/Desktop/Secondhand fashion design system`).
Token source: `design-reference/tokens/` + `design-reference/styles.css`.
UI kits: `design-reference/ui_kits/`.
Components: `design-reference/components/`.
Guidelines: `design-reference/guidelines/`.

> The ui-verifier subagent opens these files directly in Playwright for side-by-side comparison with live routes.
> Never import design-reference files into app code.

---

| File | Screen | Route(s) | Build Prompt | Notes |
|------|--------|----------|--------------|-------|
| `Browse Results.dc.html` | Browse / search feed | `/` (authenticated), `/browse` | **B4** | Left filter rail, sort, full-text search, listing cards, pagination, mobile drawer variant |
| `Checkout & Orders.dc.html` | Checkout flow + order status | `/checkout`, `/orders`, `/orders/[id]` | **B5** | PaymentIntent, escrow timeline, auto-release countdown, PROTECTED card, dispute flow |
| `Create Listing.dc.html` | Sell flow — 4-step wizard | `/sell`, `/sell/[step]` | **B2** | Image slots (FRONT/BACK/TAG/DETAIL/FLAW/POSSESSION), rubric selector, fee math |
| `Listing Detail.dc.html` | Single listing page | `/listings/[id]` | **B2** (shell), **B7** (community section) | Gallery, purchase panel, TRUST STRIP, seller block, LC/comments placeholder (B7) |
| `Messages.dc.html` | Inbox + conversation thread | `/messages`, `/messages/[id]` | **B6** | Realtime chat, pinned listing bar, counterparty record, offer UI, link-blocking system lines |
| `Onboarding.dc.html` | Signup + invite code flow | `/enter`, `/onboarding/[step]` | **B1** | Code entry, waitlist, ID-verification placeholder, quick-setup, generated invite codes screen |
| `Seller Profile.dc.html` | Public seller profile | `/sellers/[username]` | **B2** (stub), enriched **B4** | Active listings grid, trust indicators, review aggregate |
| `Settings.dc.html` | Account + payout settings | `/settings`, `/settings/[section]` | **B5** (Stripe Connect), **B1** (profile basics) | Stripe Express onboarding, saved payment methods, address, size preferences, notification prefs |

---

## Token extraction notes

All tokens extracted from `design-reference/tokens/` and mapped into `tailwind.config` (via `app/globals.css @theme`):

| Token file | Key tokens | Code location |
|-----------|-----------|---------------|
| `tokens/colors.css` | `--bg` `--ink` `--ink-soft` `--line` `--accent` `--alert` | `app/globals.css` → `--color-{name}` |
| `tokens/typography.css` | 3 font families, scale 12/14/16/20/28/40, tracking, leading | `app/globals.css` → `--font-{ui,serif,mono}`, `--text-{xs..2xl}` |
| `tokens/fonts.css` | Google Fonts import (Inter/EB Garamond/Space Mono) | `app/layout.tsx` via `next/font/google` |
| `tokens/spacing.css` | 8px grid, content-max 1280, gutter 24, radius 2px, control-h 44px | `app/globals.css` → `--spacing-*`, `--radius`, `--control-h` |
| `tokens/base.css` | Base element resets | `app/globals.css` (body, h*, a, hr, ::selection, :focus-visible) |
| `styles.css` | Assembled token sheet (same values as tokens/ files) | Reference only — tokens imported directly from source files |

## Component inventory

`design-reference/components/` subdirectories:
- `actions/` — button variants, icon buttons
- `feedback/` — toasts, error states, empty states
- `forms/` — inputs, selects, checkboxes, radio groups
- `listing/` — listing card, image slots, condition rubric
- `navigation/` — nav bar, filter rail, mobile drawer

`design-reference/ui_kits/` — assembled screen compositions.

## Guidelines

`design-reference/guidelines/`:
- `brand-voice.html` — tone, copy rules
- `colors-core.html`, `colors-accent.html`, `colors-alert.html` — color usage rules
- `spacing-scale.html`, `spacing-layout.html` — grid rules
- `surface-rules.html` — elevation, shadow policy
- `type-casing.html` — capitalisation rules
