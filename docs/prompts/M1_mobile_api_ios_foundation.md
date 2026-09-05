# M1 — Mobile API contract + archive-ios foundation

Two repos, one prompt. Part A runs in `resale-platform` on branch `feat/mobile-api`. Part B
creates and fills `~/Projects/archive-ios`. Part A must be green before Part B's screens are wired.

```
READ ONLY (resale-platform): CLAUDE.md, AGENTS.md, docs/MOBILE_PLAN.md,
docs/MOBILE_ARCHITECTURE_AUDIT.md, lib/supabase/server.ts, lib/supabase/service.ts,
lib/notify/*.ts, lib/browse/filters.ts, lib/sizes.ts, lib/fees.ts, lib/orders.ts, lib/offers.ts,
lib/sellers/stats.ts, lib/tier-progress.ts, lib/tier-dashboard.ts, lib/idv/*.ts, lib/auth/username.ts,
app/api/browse/route.ts, app/api/conversations/route.ts, app/api/idv/start/route.ts,
app/api/stripe/connect/route.ts, app/api/stripe/connect/return/route.ts,
app/api/notifications/subscribe/route.ts, and ONLY the page files being refactored in A3
(read each one when you extract it, not before). supabase/migrations/20240101000026_notifications.sql
for the push table shape. tests/unit/* for test conventions.

READ ONLY (iOS shell): ~/Downloads/frontend-ios/** (11 Swift files, README, project.yml).

PLAN FIRST (fable), execute on the same model — this touches auth.
```

## Part A — resale-platform (`feat/mobile-api`)

GOAL: every capability a browser user has is reachable by a native client holding a Supabase
access token, with no second implementation of any business rule.

TASKS

A1. **Bearer auth in `lib/supabase/server.ts`.** `createClient()` reads
`Authorization: Bearer <jwt>` via `headers()` from `next/headers`. With a bearer, return a
supabase-js client built with `NEXT_PUBLIC_SUPABASE_ANON_KEY` and
`global.headers.Authorization = 'Bearer <jwt>'`, `auth: { persistSession: false,
autoRefreshToken: false, detectSessionInUrl: false }`. Without one, the existing cookie client.
Export `requireUser()` → `{ supabase, user }` or throws a typed `Unauthorized` the new routes
convert to 401. Do not touch the 79 existing route prologues. Unit tests: bearer detected,
missing bearer falls back, malformed header ignored (mock `next/headers` and the supabase
factories).

A2. **Loaders.** Create `lib/loaders/{viewer,browse,listing,seller,saved,inbox,thread,order,
settings,sell,checkout,boost,verification,content}.ts`. Each exports a pure async function
taking `{ supabase, service?, user }` plus params and returning a JSON-serialisable DTO with a
named exported type. Move `app/messages/inbox.ts` into `lib/loaders/inbox.ts` and update its
importers. Keep every query, filter, flag check, and formatting rule exactly as the page has it
today; this is a move, not a redesign. Where the page uses the service-role client, the loader
does too, after the same authorization the page performs (order party check before the
service read, own-`user.id` scoping for the profile row).

A3. **Pages consume loaders.** `app/browse/page.tsx`, `app/listings/[id]/page.tsx`,
`app/sellers/[username]/page.tsx`, `app/saved/page.tsx`, `app/messages/page.tsx`,
`app/messages/[id]/page.tsx`, `app/orders/[id]/page.tsx`, `app/settings/settings-shell.tsx`,
`app/sell/page.tsx`, `app/sell/new/page.tsx`, `app/checkout/[listingId]/page.tsx`,
`app/boost/[listingId]/page.tsx`, `app/onboarding/verify/page.tsx`, `app/banned/page.tsx`. Each
page keeps its JSX and passes the loader's DTO fields where it used local variables. No visual
change. `app/api/browse/route.ts` calls the browse loader.

A4. **Routes.** Per `docs/MOBILE_PLAN.md` §2.2: `GET /api/me`, `GET /api/browse` (public at
`offset=0`, `include=facets`), `GET /api/listings/[id]`, `GET /api/sellers/[username]`,
`GET /api/saved`, `GET /api/conversations` (inbox DTO), `GET /api/conversations/[id]`,
`GET /api/orders/[id]`, `GET /api/settings/profile`, `GET /api/settings/orders`,
`GET /api/settings/review`, `GET /api/sell/catalog`, `GET /api/sell/new`,
`GET /api/checkout/preview`, `GET /api/boosts`, `GET /api/idv/status`, `POST /api/idv/start`,
`GET /api/idv/return`, `POST /api/stripe/connect/link`, `client=ios` handling in
`GET /api/stripe/connect/return`, `POST /api/profile`, `GET /api/mobile/config`,
`GET /api/content/[slug]`, `POST|DELETE /api/notifications/devices`. Existing GET/POST behaviour
on shared paths is unchanged (adding a method to a file is additive). All new routes use
`requireUser()` where auth is needed and the existing status-code conventions.

A5. **Push.** Migration `supabase/migrations/20240101000046_push_devices.sql`: `push_devices`
(id, user_id FK profiles ON DELETE CASCADE, platform check in ('ios','android'), token text,
app_build text, locale text, created_at, updated_at, last_seen_at, UNIQUE (platform, token)),
RLS own rows, explicit grants to `authenticated` (select/insert/update/delete), indexes on
user_id and (platform, token). `lib/notify/apns.ts`: HTTP/2 client to
`api.push.apple.com` / `api.sandbox.push.apple.com`, ES256 provider token from
`APNS_KEY_ID/APNS_TEAM_ID/APNS_PRIVATE_KEY`, cached 50 minutes, payload
`{aps:{alert:{title,body},sound:'default',badge?}, url}`, fail-soft, delete the device row on 410
`Unregistered`. `dispatch.ts` push branch fans out to web-push rows and iOS devices. Run
db-guard on the migration. Do not `db push` from the cloud session.

A6. **Contract.** `docs/api/openapi.yaml` (OpenAPI 3.1) covering every route the app calls,
existing and new, with request/response schemas and one example per response. Unit test
`tests/unit/api-contract.test.ts`: every path in the spec maps to an existing
`app/api/**/route.ts` exporting that method. `.env.example`: add the APNS vars, `CRON_SECRET`,
`NEXT_PUBLIC_APP_URL`, `VAPID_*`, `TWILIO_*`, `EASYPOST_WEBHOOK_SECRET` (names only).

A7. **Docs.** `docs/IOS_PLAN.md` gets a two-line header pointing at MOBILE_PLAN.md as the
superseding decision. `docs/HANDOFF.md` rewritten. `docs/ROADMAP.md` gets M1–M3.

ACCEPTANCE (A): `pnpm verify` green (new unit tests included) · `pnpm build` green ·
`pnpm verify:ui` green on the Mac · code-reviewer pass on A1 + every new route that uses the
service client · db-guard pass on 0046 · `curl -H 'Authorization: Bearer <token>' /api/me` returns
the viewer and the same call without the header returns 401 · `GET /api/browse` as a guest returns
page 1 with facets · PR opened against `main`, no Claude attribution trailers.

## Part B — archive-ios

GOAL: a compiling SwiftUI app that reproduces the shell's screens against the live API.

TASKS

B1. **Repo.** `gh repo create aetiusgular/archive-ios --private`; clone to `~/Projects/archive-ios`.
Layout per `docs/MOBILE_PLAN.md` §3. `project.yml` (XcodeGen): app target `ArchiveIOS`
(iOS 17.0, bundle `supply.archive.ios`, Swift 5 language mode, generated Info.plist with
`CFBundleURLTypes` for scheme `archive`, `NSCameraUsageDescription`,
`NSPhotoLibraryUsageDescription`, `UIBackgroundModes: remote-notification`), unit test target,
local package `Packages/ArchiveCore`, SPM packages supabase-swift, stripe-ios, Nuke. xcconfig for
`API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `STRIPE_PUBLISHABLE_KEY` read through
`Info.plist` keys. `.gitignore`: `*.xcodeproj`, `Local.xcconfig`, `DerivedData`, `.build`.
`AGENTS.md` + `CLAUDE.md` (rules: tokens only, cents as Int, no business math on device, no
Claude trailers), `README.md` (run instructions), `.github/workflows/ios.yml` (macOS runner:
`swift test` in the package, `xcodegen generate`, `xcodebuild build CODE_SIGNING_ALLOWED=NO`).

B2. **ArchiveCore.** `Package.swift` (tools 5.9, platforms macOS 13 + iOS 17). DTOs for every
response in `openapi.yaml` (`Codable`, `Sendable`, snake_case decoding, cents as `Int`, dates as
ISO 8601 with fractional seconds). `APIClient` actor: base URL, `TokenProvider` for the bearer,
`X-Client` header, JSON decode, `APIError` (`unauthorized`, `forbidden(code)`, `notFound`,
`conflict`, `unprocessable`, `rateLimited(retryAfter)`, `server`, `transport`, `decoding`).
Endpoint builders per domain. Formatters mirroring `lib/fees.formatCents`, relative time, the
seller trust line. `swift test` fixtures: one JSON per response example from the spec.

B3. **App target.** `AppEnvironment` (api, auth, realtime, uploader, config) injected via
`Environment`. `SupabaseAuthService` implements `TokenProvider` and exposes an auth-state stream;
email/password, Google via `signInWithOAuth` + ASWebAuthenticationSession redirect
`archive://auth-callback`, native Apple via `ASAuthorizationAppleIDProvider` +
`signInWithIdToken`, `resetPasswordForEmail`, sign out. After signup call `POST /api/profile`.
Router: 6 tabs per the shell + `NavigationStack` paths, `DeepLink` parser for `archive://` and
web-style paths. Theme from the shell's `Theme.swift`; bundle Archivo + IBM Plex Mono and swap
the `mono`/`sans` helpers to `Font.custom`.

B4. **Screens wired.** Port each shell screen, replacing `AppState` mock data with view models:
Browse (facets, chips, filter takeover, sort, MY SIZES → `PUT /api/settings/sizes`, save search,
infinite scroll with the guest gate at page 2), Listing detail (gallery, specs, measurements,
seller line, save, MESSAGE → `POST /api/conversations`, BUY NOW → checkout placeholder for M2,
MAKE OFFER → thread), Seller profile (new), Saved (three tabs, unsave, alerts toggle, follow),
Inbox + Thread (Realtime, send, offers create/accept/decline/counter, consent, report, read),
Notifications (list, mark read, mark all, inline offer actions), Account hub (viewer, theme
segment, sign out, footer links), Orders list, Address book, My sizes, Notification prefs,
Payouts (balance read; CONNECT button opens the JSON link in ASWebAuthenticationSession), Phone
verify, Profile edit, Sell catalog (tabs, bump, relist, delete; NEW LISTING → wizard shell for
M2), Info pages from `/api/content`. Loading, empty, and error states on every screen using the
shell's atoms. Guest mode identical to web.

B5. **Tests.** `ArchiveIOSTests`: BrowseViewModel, ThreadViewModel, AuthGate behaviour against a
`MockAPI`. ArchiveCore tests green with `swift test`.

ACCEPTANCE (B): `swift test` green in `Packages/ArchiveCore` · `xcodegen generate` +
`xcodebuild -scheme ArchiveIOS -destination 'generic/platform=iOS' CODE_SIGNING_ALLOWED=NO build`
green on the Mac once Xcode is installed · app boots to Browse as a guest against the local
`pnpm dev` server, signs in with email, loads Saved/Inbox/Notifications/Account with real data ·
first commit + push to `aetiusgular/archive-ios`, no Claude attribution.

Then in both repos: VERIFY → RECORD → DECIDE. Print `HANDOFF COMPLETE → start a fresh session
and run: M2` when done.
