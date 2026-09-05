# MOBILE_PLAN.md — native iOS (and Android) on top of resale-platform

Decision record and build plan, 2026-09-05. Supersedes `docs/IOS_PLAN.md` (July 2026), which
recommended Expo. The founder chose native: SwiftUI on iOS, Jetpack Compose on Android, one repo
per platform. The trade the July doc warned about is real and accepted: no code sharing between
the two apps, a second toolchain per platform. The mitigation is an API contract that both apps
consume unchanged, so the backend is written once.

Read with `docs/MOBILE_ARCHITECTURE_AUDIT.md` (what the web app does today and where the gaps are).

## 1. Decisions

| # | Decision | Why |
|---|---|---|
| D1 | Native SwiftUI app in its own repo `aetiusgular/archive-ios` (private), local `~/Projects/archive-ios`. Android later in `archive-android`. Not inside resale-platform. | Toolchains, CI runners (macOS vs Linux), release trains and contractor access boundaries are per platform. Vercel builds every push to this repo. See the 2026-09-05 repo discussion. |
| D2 | API-first. Every read and write the app performs goes through `app/api` routes with `Authorization: Bearer <supabase access token>`. supabase-swift is used for exactly three things: auth (session, email/password, Google via ASWebAuthenticationSession, native Sign in with Apple), Realtime (`messages` channel), and Storage uploads to `product-images`. | Keeps fees, gates, filters, and formatting rules server-side where `AGENTS.md` already requires them. Android reuses the same contract. Avoids rewriting 20 pages' query logic in Swift and again in Kotlin. |
| D3 | Reads are exposed by extracting each RSC page's data assembly into `lib/loaders/*.ts` and calling the loader from both the page and a new GET route. | Parity by construction: one function produces the web page and the API response. Existing Playwright specs cover the page half. |
| D4 | Bearer support is added inside `lib/supabase/server.ts#createClient()` by reading the request `Authorization` header via `next/headers`. Zero edits to the 79 routes. | The 82 `createClient()` call sites and 79 `getUser()` prologues stay untouched. `getUser()` still validates the token with a server round trip (the repo's rule). |
| D5 | Contract policy: additive changes only on existing paths; a breaking change gets a new path. `docs/api/openapi.yaml` is the written contract; a unit test asserts every documented path exists as a route file. Clients send `X-Client: ios/<build>`; `GET /api/mobile/config` returns `minBuild` for a force-upgrade gate. | Shipped binaries lag the backend by weeks; the backend must stay compatible with old builds. |
| D6 | Push: `push_devices` table (platform, token) beside the existing `push_subscriptions`; `lib/notify/apns.ts` sends over APNs HTTP/2 with a `.p8` token (no new dependency, Node 22 `http2` + `crypto`). `dispatch.ts` fans out to both. | One notification pipeline, two transports. Android gets an FCM branch later. |
| D7 | Payments: Stripe PaymentSheet on iOS against the unchanged `POST /api/checkout` and `POST /api/boosts` client secrets. Physical goods, so no In-App Purchase. Connect onboarding and Stripe Identity open in `ASWebAuthenticationSession` from JSON `{url}` variants with `archive://` return URLs. | Server code stays the source of truth for amounts. |
| D8 | Minimum iOS 17. Swift 6 toolchain, Swift 5 language mode for the app target, `@Observable` view models, `NavigationStack`, async/await. XcodeGen `project.yml` is committed; `.xcodeproj` is generated. Bundle id `supply.archive.ios`. | iOS 17 unlocks `@Observable`; 5-mode avoids strict-concurrency churn while the app is young. XcodeGen keeps the project file out of merge conflicts. |
| D9 | The non-UI core (`Packages/ArchiveCore`: DTOs, API client, endpoints, formatters, auth protocol) is a Swift package that compiles with `swift build` on macOS without Xcode and has its own `swift test` suite with JSON fixtures taken from the OpenAPI examples. | Xcode was not installed on the Mac at the start of this work; the contract layer is verifiable immediately, and CI can test it on any macOS runner in seconds. |
| D10 | Admin screens (`/admin/*`) stay web-only in iOS v1. | Founder tooling, desktop workflows, not in the mobile wireframes, and not something Apple review should see in a consumer app. |

## 2. Backend architecture (resale-platform, branch `feat/mobile-api`)

### 2.1 Auth

`createClient()` in `lib/supabase/server.ts` checks `Authorization: Bearer <jwt>` on the incoming
request. With a bearer it returns a supabase-js client built with the **anon key** and a global
`Authorization` header, so RLS evaluates `auth.uid()` from the token and `supabase.auth.getUser()`
validates it against GoTrue (supabase-js honours a custom Authorization header for `getUser()`).
Without a bearer it returns the existing `@supabase/ssr` cookie client. Nothing else changes:
route prologues, `isBanned`, admin checks, RPC-level authorization all keep working.

Native session lifecycle is owned by supabase-swift (Keychain storage, PKCE, refresh). Login
methods: email + password, Google (OAuth via ASWebAuthenticationSession, redirect
`archive://auth-callback`), Sign in with Apple (native credential → `signInWithIdToken`).
Signup creates the profile through `POST /api/profile` instead of a client-side insert.

### 2.2 Loaders and new routes

| Loader (`lib/loaders/`) | Page it now serves | New/changed route | Notes |
|---|---|---|---|
| `viewer.ts` | header chrome, banned page | `GET /api/me` | profile (own row via service client, scoped to `user.id`), `banned` + `banned_reason`, unread counts, public flag subset |
| `browse.ts` | `app/browse/page.tsx`, `app/api/browse` | `GET /api/browse` becomes public for `offset=0` (guests still 401 past page 1, as on web); `?include=facets` adds `totalCount`, `soldCount`, `filterCounts`, `mySizes` | one function for page 1 and load-more |
| `listing.ts` | `app/listings/[id]/page.tsx` | `GET /api/listings/[id]` | viewer-aware: `saved`, `following`, `own`, `canEdit`, seller trust line, original price, LC tally, measurements with labels, shipping, visibility rules for non-active statuses |
| `seller.ts` | `app/sellers/[username]/page.tsx` | `GET /api/sellers/[username]` | |
| `saved.ts` | `app/saved/page.tsx` | `GET /api/saved` | items, searches with `newCount`, sellers with `newThisWeek`, `sinceVisit` |
| `inbox.ts` (moves `app/messages/inbox.ts`) | `app/messages/page.tsx` | `GET /api/conversations` returns the inbox DTO (unread, preview, listing snapshot) | `POST` unchanged |
| `thread.ts` | `app/messages/[id]/page.tsx` | `GET /api/conversations/[id]` | conversation, listing, me/other, trust line, messages, offers, order events, consent flags. Does not mark read; the app calls `POST .../read` |
| `order.ts` | `app/orders/[id]/page.tsx` | `GET /api/orders/[id]` | role-aware DTO + `actions` (confirm/ship/deliver/dispute/review) + `disputeDeadlineAt`, `autoReleaseAt` |
| `settings.ts` | `app/settings/settings-shell.tsx` | `GET /api/settings/profile` (profile + prefs + derived), `GET /api/settings/orders`, `GET /api/settings/review?order=` | |
| `sell.ts` | `app/sell/page.tsx`, `app/sell/new/page.tsx` | `GET /api/sell/catalog`, `GET /api/sell/new?edit=\|draft=` | catalog + offers + payouts + fee line; prefill + `mustVerify` + `sellerBps` + `welcomeSalesRemaining` |
| `checkout.ts` | `app/checkout/[listingId]/page.tsx` | `GET /api/checkout/preview?listingId=&offerId=` | summary without creating a PaymentIntent; `state: ok \| unavailable \| own` |
| `boost.ts` | `app/boost/[listingId]/page.tsx` | `GET /api/boosts?listingId=` | packages, current boost, free-bump eligibility |
| `verification.ts` | `app/onboarding/verify/page.tsx` | `GET /api/idv/status`; `POST /api/idv/start` → `{url}`; `GET /api/idv/return?client=ios` → `archive://idv/return` | web `GET /api/idv/start` redirect unchanged |
| (no loader) | settings payouts | `POST /api/stripe/connect/link` → `{url}`; `GET /api/stripe/connect/return?client=ios` → `archive://stripe/connect/return` | web `GET /api/stripe/connect` redirect unchanged |
| (no loader) | signup, onboarding/account | `POST /api/profile` (idempotent create) | same username derivation as `lib/auth/username.ts` |
| (no loader) | app boot | `GET /api/mobile/config` (public) | `minBuild`, public flags, legal links |
| `content.ts` | `/terms /privacy /help /fees /trust /about` | `GET /api/content/[slug]` (public) | one copy of the legal and help text |
| (no loader) | push | migration `0046_push_devices.sql`; `POST/DELETE /api/notifications/devices`; `lib/notify/apns.ts` | gated by `NOTIFICATIONS_ENABLED` like the web-push route |

Error contract for all routes stays as is: JSON `{error, code?}` with the existing status
conventions (401, 403 `banned`/`verification_required`, 404 for not-found and flag-off, 409,
422, 429 + `Retry-After`, 502). Documented in the OpenAPI file so the Swift `APIError` maps them.

### 2.3 Things the app must handle that the web never had to

- 404 on a flagged route means "feature off". `GET /api/mobile/config` tells the app which flags
  are on so it can hide the entry points instead of probing.
- Listing lock at checkout: call `POST /api/checkout` when the buyer taps PAY, not when the
  screen appears.
- Return URLs for Connect and Identity are `archive://` deep links; universal links
  (`https://<domain>/...`) come with M3 once the domain is fixed.
- Push payload carries the notification `url`; the app maps `/messages/{id}`, `/listings/{id}`,
  `/orders/{id}`, `/checkout/{id}`, `/settings?section=` to screens (same paths as web).

## 3. iOS app architecture (archive-ios)

```
archive-ios/
  project.yml                      XcodeGen: app target + test target + local package
  Packages/ArchiveCore/            SPM, macOS+iOS, Foundation only. Compiles with CLT Swift.
    Sources/ArchiveCore/
      Models/                      Codable DTOs mirroring docs/api/openapi.yaml
      API/                         APIClient (actor), Endpoint builders per domain, APIError
      Auth/                        TokenProvider protocol (implemented by the app with supabase-swift)
      Formatting/                  cents → "$1,240", relative time, size/condition labels
    Tests/ArchiveCoreTests/        decoding fixtures, endpoint URL/method tests, error mapping
  ArchiveIOS/
    App/                           ArchiveApp, AppEnvironment (DI), Router (tabs + paths), DeepLinks
    Services/                      SupabaseAuthService, RealtimeService, StorageUploader,
                                   StripeCheckoutService, PushService
    DesignSystem/                  Theme.swift (tokens from the shell), atoms, fonts
    Features/                      Browse, Listing, Saved, Messages, Notifications, Sell,
                                   Account (+ settings subpages, orders, review), Auth, Onboarding,
                                   Checkout, Boost, Dispute, Seller, Info
    Resources/                     Assets, Fonts (Archivo, IBM Plex Mono), PrivacyInfo.xcprivacy
    Config/                        Debug/Release xcconfig; Local.xcconfig (gitignored) holds URLs/keys
  ArchiveIOSTests/                 view-model tests against a MockAPI
  docs/                            ARCHITECTURE.md, HANDOFF.md, RELEASE.md
  AGENTS.md, CLAUDE.md, README.md, .github/workflows/ios.yml
```

Dependencies: `supabase-swift` (Auth, Realtime, Storage), `stripe-ios` (StripePaymentSheet),
`Nuke` (image loading and caching). Nothing else.

Pattern per feature: `XScreen` (SwiftUI, tokens only, no networking) ← `XViewModel`
(`@Observable`, `@MainActor`, owns loading/error state, calls `APIClient`) ← `ArchiveCore`
endpoints. Guest mode mirrors the web: browse page 1, listing detail, seller pages are public; any
gated action presents the auth gate sheet with the item strip, then continues.

The screens ported from `~/Downloads/frontend-ios` keep their layout and token usage. Their mock
`AppState` is replaced by stores backed by the API. Screens the shell does not have (checkout,
order detail with actions, dispute, boost, seller profile, saved searches/sellers, LC comments,
settings subpages beyond the four drawn, forgot/reset password, wizard steps other than step 2)
are built from the web implementation as the spec, in the same visual language.

## 4. Phases

**M1 — contract + foundation + reading and messaging.** Backend: §2 complete, `pnpm verify`
green, code-reviewer pass on the auth change, migration 0046 through db-guard, OpenAPI file, PR
`feat/mobile-api`. iOS: repo, ArchiveCore green under `swift test`, auth (email, Apple, Google),
tabs, Browse with filters/sort/MY SIZES against `/api/browse`, listing detail, seller profile,
Saved (items, searches, sellers), inbox + thread with Realtime, send message, offers
accept/decline/counter/create, Notifications, Account hub, settings reads and the writes whose
routes already exist (profile, sizes, prefs, addresses, phone), Sell catalog with bump/relist/delete,
info pages from `/api/content`. `xcodebuild` green once Xcode is installed.

**M2 — money and selling.** Sell wizard (all steps, Storage uploads, drafts autosave, publish,
edit, relist), checkout with PaymentSheet + order polling, order detail actions (confirm, ship,
deliver, dispute with evidence upload), reviews, boost purchase, Connect onboarding and Identity
via ASWebAuthenticationSession, account deletion, LC comments + votes, follows, moderator
recommend. code-reviewer on every money screen's request path.

**M3 — native value and release.** APNs end to end (permission prompt placement per the
wireframes, token registration, deep links from notifications), universal links, App Store
assets, privacy manifest and nutrition labels, TestFlight build, `docs/RELEASE.md`. Then the
Android repo kickoff reusing `docs/api/openapi.yaml`.

Each phase ends with the repo's VERIFY → RECORD → DECIDE epilogue in both repos.

## 5. Founder actions (cannot be automated)

1. Install Xcode 26 from the App Store; then `sudo xcode-select -s /Applications/Xcode.app` and
   `brew install xcodegen`.
2. Apple Developer: create App ID `supply.archive.ios` with Push Notifications and Sign in with
   Apple capabilities; create an APNs auth key (`.p8`) and note Key ID + Team ID.
3. Supabase Auth: add `archive://auth-callback` to Redirect URLs; configure the Apple provider
   with the bundle id as an allowed client id (native flow) in addition to the web Service ID.
4. Env on Vercel for M3: `APNS_KEY_ID`, `APNS_TEAM_ID`, `APNS_PRIVATE_KEY` (the `.p8` contents),
   `APNS_BUNDLE_ID=supply.archive.ios`, `APNS_ENV=sandbox|production`, `NEXT_PUBLIC_APP_URL`.
5. Fill `ArchiveIOS/Config/Local.xcconfig` from the example (API base URL, Supabase URL + anon key,
   Stripe publishable key). These are public-safe values but stay out of git.

## 6. Out of scope for the app (deliberate)

Admin queue, moderation console, metrics (web-only). Sitemap/SEO. `/styleguide`. Dev seed route.
The `/messages?seller=` link that the web page does not handle either.

## 7. Apple review checklist (marketplace-specific)

Physical goods → Stripe is allowed, no IAP. Account deletion in-app: exists (`POST
/api/account/delete`), surfaced in Account. User-generated content: report (conversation report,
comment flag) and block equivalents must be reachable; comments are moderator-gated. Sign in with
Apple is mandatory because Google sign-in is offered. Privacy nutrition labels must list PostHog
(if added to the app) and Sentry. No web views for core flows except the two hosted Stripe flows.

## 8. Risks

- The loader extraction touches 12 pages just merged in the redesign. Mitigation: pages keep
  consuming the same variables; `pnpm verify:ui` on the Mac gates the branch.
- Bearer auth widens the API's accepted credentials. Mitigation: token is validated by GoTrue on
  every call exactly like a cookie session; browsers cannot attach a bearer cross-site without a
  CORS preflight, and the API sends no CORS headers. code-reviewer pass required.
- `lib/supabase/types.ts` is stale; loaders use explicit row types like the pages do today.
- No Xcode at the start: ArchiveCore is verified with `swift build`/`swift test`; the app target
  is verified once Xcode lands. Expect a compile fix-up pass if it lands after the code is written.
