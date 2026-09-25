# HANDOFF.md
## Current state: VS1 (visual search P1) BUILT on `feat/visual-search` · container verify green · db-guard + code-reviewer pending · M1a merged earlier

**Last updated:** 2026-09-24
**Next prompt:** merge `feat/mobile-api` after the founder's own review, apply migration 0046
(`pnpm exec supabase db push` — db-guard PASS recorded below), then run
`docs/prompts/M1_mobile_api_ios_foundation.md` **Part B** in the new repo `~/Projects/archive-ios`
(`aetiusgular/archive-ios`). Part B needs Xcode 26 installed on the Mac for `xcodebuild`; the
`Packages/ArchiveCore` package builds with Command Line Tools alone.

---

## VS1 — Visual search P1: hash index + `POST /api/search/image` (2026-09-24, branch `feat/visual-search`)

Plan: `~/Documents/Claude/Projects/agora/VISUAL_SEARCH_ANALYSIS.md` (build-vs-buy), `VISUAL_SEARCH_ROADMAP.md`,
`VISUAL_SEARCH_BUILD_PROMPTS.md` (V1 engine, P1 platform, P2 UI, P3a/P3b). Engine half is on recs-engine
`feat/visual-search` (5 commits after `955e8e7`): `photos` collection, worker fan-out, `POST /v1/search/image`.

**Migration 0053 `image_hash_bits`.** pgvector (`extensions` schema) + `image_hashes.hash_bits bit(256)`
STORED generated from `hash` (NULL for a legacy non-hex row) + HNSW `bit_hamming_ops` index +
`similar_image_hashes(query_hex, max_distance, max_rows, exclude_listing, exclude_seller)` SECURITY DEFINER,
`service_role` EXECUTE only, live listings (`active`, `pending_review`) only. Verified on a local Postgres 16
with pgvector 0.8.1 (planner uses the index; anon denied). Needs **db-guard + `pnpm exec supabase db push`**
(founder, native). Supabase's pgvector must be >= 0.7 for bit vectors (it ships 0.8.x).

**Route `POST /api/search/image`** (`app/api/search/image/route.ts`, Node runtime, `respond`/`ApiError`
contract): raw JPEG/PNG/WebP body (<= 5 MB, magic-byte sniffed) → blockhash via sharp → `similar_image_hashes`
(the "same photo" tier) + recs-engine `POST /v1/search/image` (embedding tiers) in parallel → merge → hydrate
BrowseListing cards (active + public photo only) → `{ listed, category, engine, exact, match, close }`.
JSON `{ listing_id, photo_index }` = "search with this listing's photo" (stored hash + indexed vector, no
upload). Guests allowed (`VISUAL_SEARCH_GUESTS`, default true), `enforceRateLimit` 20/min by user id or IP,
404 when `VISUAL_SEARCH_ENABLED` is off, fail-soft to the hash tier when the engine is unreachable
(`engine: 'unavailable'`). The image bytes are never stored or logged.

**Lib** `lib/visual-search/{config,image,client,merge}.ts` (merge + sniffing are pure and unit-tested).
**Near-dup detection** in `app/api/listings/route.ts` now calls `similar_image_hashes` per new hash instead
of scanning 5,000 `image_hashes` rows (same thresholds and `listing_flags` evidence; the antislop TODO is
closed). **Contract:** `/api/search/image` + `VisualSearchHit`/`VisualSearchResponse` in `docs/api/openapi.yaml`.
**Flags/env:** `VISUAL_SEARCH_ENABLED`, `NEXT_PUBLIC_VISUAL_SEARCH_ENABLED`, `VISUAL_SEARCH_GUESTS` in
`lib/flags.ts` / `.env.example`; the engine URL + token reuse `RECS_FEED_URL` / `RECS_FEED_API_TOKEN`.

**Gate (container copy of `main` 57ffd05 + this branch):** tsc clean · `eslint .` clean · vitest 52 files /
541 tests (19 new). `pnpm build` not run here (founder, native, dev server stopped).

**Next:** db-guard + push 0053 · code-reviewer on the route (new public upload surface) and the RPC · merge
after the founder review · VS2 (UI: camera control in the header search, `/search/image` results page,
mobile capture, "search with this photo" on the PDP gallery) per `VISUAL_SEARCH_BUILD_PROMPTS.md` P2 ·
flags stay off until the recs VPS serves `/v1/search/image` and `scripts/calibrate_visual.py` has set
`RECS_VISUAL__EXACT_COS` / `MATCH_COS`.

---

## M1a — Mobile API contract (2026-09-05, branch `feat/mobile-api`)

Plan and decision record: `docs/MOBILE_PLAN.md` (supersedes `docs/IOS_PLAN.md`). Audit of the web
app from a native client's view: `docs/MOBILE_ARCHITECTURE_AUDIT.md`. Contract:
`docs/api/openapi.yaml` (66 paths, 38 schemas; `tests/unit/api-contract.test.ts` asserts every
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
