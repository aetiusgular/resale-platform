# HANDOFF.md
## Current state: M1 (mobile API + iOS foundation) BUILT · `feat/mobile-api` (PR #4) awaiting founder review · archive-ios repo live

**Last updated:** 2026-09-05
**Next prompt:** founder merges `feat/mobile-api`, applies migration 0046 (`pnpm exec supabase db push`),
runs the archive-ios app once against `pnpm dev` (see `~/Projects/archive-ios/docs/HANDOFF.md`), then
`docs/prompts/M2_mobile_money_and_selling.md` — Part A here (checkout/boost intents for
PaymentSheet, dispute + review photo uploads, sell wizard routes), Part B in archive-ios.

## M1 Part B — archive-ios (2026-09-05)

Repo: `aetiusgular/archive-ios` (private), clone at `~/Projects/archive-ios`. SwiftUI, iOS 17,
XcodeGen, Swift 5 mode. `Packages/ArchiveCore` mirrors `docs/api/openapi.yaml` (DTOs, `Endpoints`,
`APIClient` with bearer + `X-Client`, `BrowseQuery`); 24 tests green on Linux and macOS. Every M1
screen is written against the routes added in M1a; checkout, boost and the sell wizard show the
server preview and hand off to the web until M2. CI: `.github/workflows/ios.yml` (Linux `swift test`,
macOS xcodegen + xcodebuild + simulator tests). State and open items: that repo's `docs/HANDOFF.md`.

One contract correction surfaced while wiring the app: `POST/PATCH /api/settings/addresses` take
`{ address: {...}, is_default? }` (lib/addresses#cleanAddress), not a bare row. `openapi.yaml` is
fixed in this commit; ArchiveCore pins it with a test.

---

## M1a — Mobile API contract (2026-09-05, branch `feat/mobile-api`)

Plan and decision record: `docs/MOBILE_PLAN.md` (supersedes `docs/IOS_PLAN.md`). Audit of the web
app from a native client's view: `docs/MOBILE_ARCHITECTURE_AUDIT.md`. Contract:
`docs/api/openapi.yaml` (66 paths, 39 schemas; `tests/unit/api-contract.test.ts` asserts every
documented path/method exists as a route file).

**Auth.** `lib/supabase/server.ts#createClient()` accepts `Authorization: Bearer <supabase access
token>` (read via `next/headers`): bearer → anon-key supabase-js client with a global Authorization
header (RLS on the caller's JWT; `getUser()` still round-trips GoTrue — supabase-js honours a
custom Authorization header). No header → the @supabase/ssr cookie client as before. The 79
existing route prologues are untouched. New helpers: `requireUser()`, `UnauthorizedError`,
`lib/api/respond.ts` (`respond`, `ApiError`, `enforceRateLimit`), `lib/api/native.ts`
(`archive://` deep links, `X-Client` parsing, `MIN_BUILD`).

**Loaders (`lib/loaders/*`).** RSC page data assemblies extracted and consumed by BOTH the pages
and new GET routes, so parity holds by construction: browse, listing, seller, saved, inbox (moved
from `app/messages/inbox.ts`), thread, order, settings (+orders, +review), sell (catalog, new),
checkout (preview), boost, verification (+ban reason), viewer (`/api/me`), content. Pages
refactored: browse, listings/[id], sellers/[username], saved, messages, messages/[id],
orders/[id], settings-shell, sell, sell/new, checkout/[listingId], boost/[listingId],
onboarding/verify, banned, help. No visual change (verify:ui 73 passed).

**Routes added/changed.** `GET /api/me` · `GET /api/browse` public at `offset=0`, `include=facets`
(guests past page 1 → 401 `auth_required`) · `GET /api/listings/[id]` · `GET /api/sellers/[username]`
· `GET /api/saved` · `GET /api/conversations` now returns the inbox DTO · `GET /api/conversations/[id]`
· `GET /api/orders/[id]` · `GET /api/settings/profile` · `GET /api/settings/orders` ·
`GET /api/settings/review?order=` · `GET /api/sell/catalog` · `GET /api/sell/new?edit=|draft=` ·
`GET /api/checkout/preview` · `GET /api/boosts?listingId=` · `GET /api/idv/status` ·
`POST /api/idv/start` → `{url}` + `GET /api/idv/return?client=ios` · `POST /api/stripe/connect/link`
→ `{url}` + `GET /api/stripe/connect/{return,refresh}?client=ios` (redirect into `archive://`) ·
`POST /api/profile` (idempotent own-profile create) · `GET /api/mobile/config` ·
`GET /api/content/[slug]` (terms · privacy · help · fees) · `POST|DELETE /api/notifications/devices`.
`lib/stripe-connect.ts` extracted from the web Connect route (shared).

**Push.** Migration `20240101000046_push_devices.sql` (`push_devices`, RLS owner-scoped, explicit
grants, UNIQUE (platform, token)). `lib/notify/apns.ts` = HTTP/2 + ES256 provider JWT, no new
dependency; `lib/notify/dispatch.ts` push channel fans out to web-push rows and iOS devices,
deleting dead tokens on 410. Env: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY`,
`APNS_BUNDLE_ID`, `APNS_ENV` (see `.env.example`, which also now documents the previously
undocumented vars: `NEXT_PUBLIC_APP_URL`, `CRON_SECRET`, `VAPID_*`, `TWILIO_*`,
`EASYPOST_WEBHOOK_SECRET`, `RESEND_API_KEY`, `NOTIFY_EMAIL_FROM`, `MOBILE_MIN_BUILD_*`).

**Photos.** `lib/listings/images.ts#publicImages()` — every `images` array a loader emits carries
slots 0–4 only; the possession proof (slot 5) is exposed solely as
`ListingDetail.listing.possession_photo_url` to the seller/admin. (Previously the raw arrays were
serialised into client props on several pages.)

**Tests.** +4 unit files (bearer parsing/dispatch, APNs JWT + payload, native helpers + content,
API contract). `tests/e2e/browse.spec.ts` deliberately changed: guest `GET /api/browse` page 1 →
200 with facets; `offset=24` → 401 `auth_required` (was: any guest → 401). New dev dependency:
`yaml` (contract test parser).

**Gates.** Native on the Mac: `pnpm verify` 447 tests · `pnpm build` · `pnpm verify:ui` 73 passed /
2 skipped. code-reviewer (auth + every service-role loader + new routes): no FAIL; 12 observations,
the material ones applied (public image slots, generic 500 on profile create, 400 on malformed
device token, rate limits on the new POSTs, cache header for guest facet responses, `submitted`
pinned in idv/return, cron footgun comment, `NEXT_PUBLIC_` policy text). db-guard on 0046: PUSH,
recommendations applied (token ceiling 512, `app_build`/`locale` bounds).

**Founder fix made during verification.** `.env.local` had an inline `# comment` after
`NEXT_PUBLIC_APP_URL=…`, which Next does not strip; it made `new URL()` in `app/layout.tsx` throw
and every page 500 under Playwright. The trailing comment was removed with a targeted `sed`
(backup: `.env.local.bak-2026-09-05`). Nothing else in the file was read or changed.

**Not done here (by decision).** Admin screens stay web-only for iOS v1. `/about` and `/trust` copy
is duplicated in the app for now (their JSX-embedded text was not extracted). `lib/supabase/types.ts`
is still stale (pre-0043/0045) — loaders use explicit row types like the pages did. `docs/GO_LIVE_AUDIT_2026-09-05.md`
(untracked, founder's) was left alone.

---

## Blockers

None for merging. For M1 Part B: Xcode 26 must finish installing on the Mac (download started
2026-09-05); `brew install xcodegen`; Apple Developer App ID `supply.archive.ios` with Push +
Sign in with Apple; Supabase Auth redirect URL `archive://auth-callback`; Apple provider configured
for the native client id. Details: `docs/MOBILE_PLAN.md` §5.

---

## Earlier history

Fee/gap program, HF1–HF5 and B0–B8 notes live in git history of this file and in
`docs/SESSION_STATUS.md` / `docs/LAUNCH_ROADMAP.md`. Redesign passes: `docs/ARCHIVE_REDESIGN.md`.

## Session start ritual

```
Read CLAUDE.md and docs/HANDOFF.md, then docs/MOBILE_PLAN.md for the mobile track.
For launch checklist status, read docs/LAUNCH.md.
```
