# M1 — archive-android foundation (Kotlin / Jetpack Compose)

You are building the **Android** client for ARCHIVE, the resale marketplace whose backend lives in
`~/Projects/resale-platform` (Next.js). The iOS client (`aetiusgular/archive-ios`) is already built
and green; this is its Kotlin twin against the **same API contract**. Read this whole prompt, then
`~/Projects/resale-platform/docs/api/openapi.yaml` (the contract), `docs/MOBILE_PLAN.md`, and the
existing iOS repo at `~/Projects/archive-ios` (mirror its architecture — do not reinvent it).

## What is already done (do NOT rebuild)

- **The mobile API is finished and shared.** Branch `feat/mobile-api` in resale-platform (PR #4)
  added: bearer-token auth inside `lib/supabase/server.ts#createClient()` (every route accepts
  `Authorization: Bearer <supabase access token>`), `lib/loaders/*` shared by the RSC pages and new
  GET routes, `GET /api/mobile/config` (force-upgrade floor, public flags, links, scheme),
  `POST /api/profile` (idempotent profile create), `GET /api/content/{slug}`, the `push_devices`
  table (platform `ios|android`) + an APNs sender, and the contract file
  `docs/api/openapi.yaml` (66 paths, 39 schemas). Android consumes ALL of this unchanged.
- **`X-Client` and `min_build` are already platform-aware.** Send `X-Client: android/<versionCode>`;
  `GET /api/mobile/config` returns `min_build.android` from `MOBILE_MIN_BUILD_ANDROID`. The
  `push_devices` table already accepts `platform = 'android'`.
- **The iOS app is the reference implementation.** `~/Projects/archive-ios` has the exact session
  lifecycle, guest-gate model, deep-link parser, offer rules, error mapping, and screen-by-screen
  behaviour you are matching. When iOS and the web ever disagree, the web wins (that repo's
  `docs/ARCHITECTURE.md` has the full parity map).

## Part A — backend deltas (small; do these first in resale-platform)

Work on `feat/mobile-api` (or a short branch off it). These are the only backend changes M1-Android
needs; run `pnpm verify` and the `code-reviewer` subagent on them (money/config are protected paths).

1. **Generalize the native return branch.** The hosted Stripe/Identity return routes
   (`app/api/stripe/connect/return`, `.../connect/refresh`, `app/api/idv/return`) currently branch on
   `searchParams.get('client') === 'ios'`. Change the check to "any non-empty `client` that isn't
   `web`" so `?client=android` also 302s into the `archive://…` deep link. The scheme is shared
   (both apps register `archive://`), so the redirect target is identical — this is a one-line guard
   per route plus a test. Update `docs/api/openapi.yaml` if the parameter description names iOS only.
2. **Confirm `GET /api/mobile/config` emits `min_build.android`** and that `lib/api/native.ts`
   parses `X-Client: android/<n>` (it is written to read the platform prefix; add a unit assertion if
   one is missing). No schema change expected.
3. **Do NOT add an FCM sender.** Android push delivery is M3 (needs a Firebase project +
   `google-services.json`, a founder step). M1 only registers the device token; the existing
   `POST|DELETE /api/notifications/devices` already accepts `platform: "android"`.

Everything else — checkout, boosts, offers, orders, sell, settings, saved, content — is done and
identical to what iOS calls.

## Part B — archive-android

GOAL: a compiling Compose app that reproduces the shell's screens against the live API, matching the
iOS client's behaviour.

**Reference shell:** `~/Downloads/frontend-android` (Compose, ~2.9k LOC, package
`supply.archive.android`). It already has the ARCHIVE design tokens (`Tok` light/dark), the `Mono`/
`Sans` composables, every atom (`MonoButton`, `SquareCheck`, `Chip`, `SizeCell`, `UnderlineLink`,
`MonoNavBar`, `ArchiveHeader`, `UnderField`, `BoxField`, `HairRow`, `SectionLabel`,
`bottomBorder`/`topBorder`), a 6-tab bar, chromeless push screens, and a mock `AppState` with a
manual `stack` of sealed `Screen`s. It has NO networking, DI, nav library, image loader, or Supabase.
Keep its layout and tokens; replace `AppState`'s mock data with API-backed stores. It is not a git
repo — you are creating one.

### B1. Repo + Gradle
`gh repo create aetiusgular/archive-android --private`; clone to `~/Projects/archive-android`.
Two-module Gradle build (this is the ArchiveCore split — keep the contract layer pure so it tests on
plain JVM, the cheap CI job):

- **`:core`** — `kotlin("jvm")` + `kotlin("plugin.serialization")`, **no Android dependency**.
  Ktor client-core + kotlinx-serialization-json. This is the analog of iOS's `ArchiveCore`.
- **`:app`** — the Android/Compose app, `namespace`/`applicationId` `supply.archive.android`,
  `minSdk 26`, `compileSdk`/`targetSdk 35`, JVM 17, `versionCode 1`, `versionName "0.1.0"`
  (match the iOS build). Compose BOM 2024.09.00, Material3, AGP 8.5.2, Kotlin 2.0.20 (as the shell
  pins them; bump only if needed). Add a Gradle **wrapper** (`gradle wrapper --gradle-version 8.9`);
  the reference ships none.

App dependencies: **supabase-kt** (`auth`/gotrue, `realtime`, `storage` modules + a Ktor
Android/OkHttp engine) — pin the current 3.x, resolve exact versions from the supabase-kt docs /
Maven, do not guess; **Coil** 2.x (image loading, the Nuke analog); **androidx.browser** (Custom
Tabs, the ASWebAuthenticationSession analog); `androidx.lifecycle:lifecycle-viewmodel-compose`;
`kotlinx-coroutines`. `.gitignore`: `.gradle/`, `build/`, `local.properties`, `*.keystore`,
`.idea/`, `Local.*`. Secrets/config: read `API_BASE_URL`, `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
`STRIPE_PUBLISHABLE_KEY` from a gitignored `secrets.properties` into `BuildConfig` via
`defaultConfig` (+ a checked-in `secrets.properties.example`) — the analog of iOS's `Local.xcconfig`.
Ship `AGENTS.md` + `CLAUDE.md` (rules below), `README.md`, `docs/ARCHITECTURE.md`, `docs/HANDOFF.md`,
`.github/workflows/android.yml`.

### B2. `:core` — the contract layer (mirror `ArchiveCore` file-for-file where sensible)
- **Models**: `@Serializable` data classes for every response in `openapi.yaml`. Cents are `Int`.
  Dates stay **`String`** (ISO-8601; Supabase emits microseconds Kotlinx can't parse) and are parsed
  lazily by a `Iso8601` helper. Use explicit `@SerialName` for the snake_case↔camelCase mix — do NOT
  set a global naming strategy (it would also rewrite map keys like saved-search `min_price`).
  Configure the `Json { ignoreUnknownKeys = true; explicitNulls = false }`.
- **`ApiClient`** over Ktor: base URL, a `TokenProvider` for the bearer, `X-Client: android/<build>`,
  `Accept: application/json`. Map the error contract (`{ error, code }`) to a sealed `ApiError`
  (`Unauthorized(code)`, `Forbidden(message, code)`, `NotFound`, `Conflict`, `Unprocessable`,
  `RateLimited(retryAfter)`, `BadRequest`, `Server`, `Transport`, `Decoding`) with a `userMessage`.
- **`Endpoints`**: every path the app calls, one place (copy the list from
  `ArchiveCore/API/Endpoints.swift`). **Addresses take the envelope** `{ address: {…}, is_default? }`
  (lib/addresses#cleanAddress), not a bare row — this bit iOS, get it right the first time.
- **`BrowseQuery`**: the URL contract (q, dept, cat, subcat, size, brand, color, min/max_price,
  verified/authenticated/dropped/sold, sort, my_sizes, offset, include=facets), chips, scope label,
  and the saved-search round trip. Plus `Taxonomy` and `SizeScales` (pure data).
- **Formatters**: `Money.format(cents)`, `Money.rate(bps)`, `RelativeTime` (ago/saved/dayLabel/clock/
  shortDate/countdown), `TextFormat`. Match the web strings exactly.
- **Tests** (`:core:test`, plain JVM, JUnit/kotlin-test): decoding against real fixtures captured
  from the dev server (copy the JSON from `archive-ios/Packages/ArchiveCore/Tests/.../Fixtures/`),
  endpoint path/method/body assertions (incl. the address envelope), error mapping, and an
  `ApiClient` header/auth test using **Ktor `MockEngine`** (the URLProtocol-stub analog). This module
  must build and test with **no Android SDK**.

### B3. `:app` — foundation
- **DI**: an `AppContainer`/`AppEnvironment` built once in the `Application`, holding
  `AppConfig` (from `BuildConfig`), `ApiClient`, `AuthService`, `RealtimeService`, `StorageUploader`,
  `PushService`, `Router`, `SessionStore`, theme store. Manual DI keeps `:core` pure (matches iOS);
  Hilt is acceptable but not required.
- **`SupabaseAuthService`** (implements `TokenProvider`): supabase-kt Auth. Email/password, sign-up,
  Google via `signInWith(Google)` (or OAuth through a Custom Tab returning `archive://auth-callback`),
  native Sign in with Google is fine; password reset + update; expose the session as a
  `StateFlow`/`Flow` the store observes. The access token it refreshes is the API bearer.
- **`SessionStore`** (ViewModel-scoped, `StateFlow<Phase>`): boot → `GET /api/mobile/config`
  (`min_build.android` → `UpgradeRequired`) → observe auth state → `GET /api/me`; `profile == null` →
  `POST /api/profile` → `Onboarding`; `banned` → `Banned`; else `Member`; `401` → sign out → `Guest`.
  `requireAuth(context) { action }` runs the action when signed in, else presents the gate sheet and
  runs it after the next `/api/me` succeeds. This is the web's `GuestAction`/`/enter?next=` behaviour.
- **`Router`**: replace `AppState.stack`/`Tab` with a real navigator holding `StateFlow`s (keep the
  manual stack model the shell already uses — it maps cleanly, and matches iOS's per-tab stacks). Add
  a `DeepLink` parser for `archive://…` **and** web-style paths (notification `url`, config `links`):
  `/listings/{id}`, `/sellers/{u}`, `/messages/{id}?counter=`, `/orders/{id}`,
  `/settings/review?order=`, `/sell?draft=`, `/browse?…`, `/stripe/connect/return`, `/idv/return`.
  Register the `archive` scheme in `AndroidManifest.xml` (`<intent-filter>` with
  `<data android:scheme="archive"/>`, `android:launchMode="singleTask"`, handle in
  `onCreate`/`onNewIntent`). Add the `INTERNET` permission.
- **Design system**: keep `Theme.kt` tokens/atoms; **bundle the fonts** — drop Archivo (300/400/500)
  and IBM Plex Mono (300/400) `.ttf` into `app/src/main/res/font/` (SIL OFL; the iOS repo has the same
  files under `ArchiveIOS/Resources/Fonts/` with the licenses) and swap the `Mono`/`Sans` helpers to a
  bundled `FontFamily`. Add the loading/empty/error atoms iOS has (`LoadingBlock`, `SkeletonGrid`,
  `EmptyBlock`, `ErrorBlock`, `ErrorStrip`, `Banner`) and a Coil `RemoteImage`/`ListingImage`.
- **Services**: `RealtimeService` (supabase-kt Realtime `messages` INSERT channel per conversation,
  as a `Flow<Message>`); `StorageUploader` (`product-images` bucket, `avatars/{uid}/…` and
  `listings/{uid}/…` prefixes, downscale + re-encode to strip EXIF); `PushService` (FCM token →
  `POST /api/notifications/devices` platform `android`; the FCM *delivery* sender is M3, and getting a
  token needs the Firebase step, so gate this and don't block M1 on it); `WebAuthFlow` (Chrome Custom
  Tab for the hosted Connect/Identity URLs, returning through the `archive://` intent).

### B4. Screens wired (one `XViewModel` + `StateFlow` per feature; screens hold no networking)
Port each shell screen, replacing mock `AppState` reads with the view model. Match the iOS behaviour
exactly (that repo is the spec):
- **Browse** (facets, chip rail, filter takeover, sort, MY SIZES → `PUT /api/settings/sizes`, save
  search, infinite scroll with the **guest gate at page 2** — `offset≥24` as a guest returns 401
  `auth_required`, open the gate), **Listing detail** (gallery, specs, measurements, seller line,
  save, MESSAGE/OFFER → `POST /api/conversations` then the thread, BUY → checkout, bump/boost/edit for
  the owner), **Seller profile**, **Saved** (items/searches/sellers, unsave, alerts, follow,
  `POST /api/saves/visit`), **Inbox + Thread** (Realtime, send with de-dupe, offers
  create/accept/decline/counter with the counter-chain rules, consent, report, read cursor),
  **Notifications** (list, mark read/all, inline offer actions, push banner), **Account hub**,
  **Orders** + **Order detail** (confirm/ship/deliver), **Review**, **Addresses** (the envelope!),
  **Sizes**, **Notification prefs**, **Payouts** (`GET /api/stripe/balance` + Connect via Custom Tab),
  **Phone**, **Profile edit** (+ avatar upload), **Identity** (`GET /api/idv/status`, start via Custom
  Tab), **Fee tiers**, **Info pages** (`/api/content` for terms/privacy/help/fees; About/Trust are
  static copy), **Auth gate sheet** + full auth (email/Google, reset), **Onboarding** (3 steps:
  account → sizes → verify). **Checkout, Boost, and the Sell wizard** show the server preview and hand
  off to the web via a Custom Tab (PaymentSheet + uploads are M2) — nothing is a dead end. Every list
  screen has loading/empty/error states. Guest mode identical to iOS/web.

### B5. Tests
`:app` unit tests (JUnit + coroutines-test) against a `MockApi` (the `MockAPI.swift` analog): Browse
VM (facets, paging, guest gate on page 2, chips, optimistic save), Thread VM (read cursor,
send/de-dupe, offer + counter rules), `SessionStore` (gate resumes the action, first sign-in →
`POST /api/profile` → onboarding, upgrade floor, 401 → sign-out), `DeepLink` parsing. `:core:test`
green. Robolectric only if a test needs Android types; prefer pushing logic into plain view models.

## Acceptance
- `./gradlew :core:test` green (plain JVM). `./gradlew :app:lintDebug :app:testDebugUnitTest
  :app:assembleDebug` green. CI (`.github/workflows/android.yml`) runs both on `ubuntu-latest` — no
  Mac needed, unlike iOS.
- App boots to Browse as a guest against a local `pnpm dev` server (or a deployed API), signs in with
  email, and loads Saved/Inbox/Notifications/Account with real data on a device or emulator.
- First commit + push to `aetiusgular/archive-android`, **no Claude/AI attribution** (see rules).

Then in both repos: VERIFY → RECORD → DECIDE. Rewrite `docs/HANDOFF.md`; print
`HANDOFF COMPLETE → start a fresh session and run: M2` when done.

---

## Rules (binding — put these in AGENTS.md/CLAUDE.md)
- **No Claude/AI attribution in git.** No `Co-Authored-By`, no `Generated with`, no session links, in
  commits or PRs. (Founder preference; the iOS repo and resale-platform follow the same rule.)
- **Never commit secrets.** `secrets.properties` is gitignored; only public values (Supabase anon
  key, Stripe publishable key, URLs) ever appear, and only in `BuildConfig`. Server secrets never
  exist in this repo.
- **Cents are `Int`; the device never does fee math.** Display server amounts; post user-typed ones.
- **Auth is the Supabase session.** `ApiClient` sends the token as `Authorization: Bearer`; the server
  validates with `getUser()`. Roles come from `/api/me`, never from decoding the JWT on device.
- **Tokens only.** Colours from `Tok`, type from `Mono`/`Sans`. No literal colours in screens, no
  Material theming, no shadows/gradients, radius 0, 1px hairlines.
- **Contract changes happen in resale-platform first** (openapi.yaml + a `:core` test), never invented
  in the app.

## Environment & tooling
- **`~/Downloads/frontend-android`** is the reference shell (read it first). The iOS repo
  `~/Projects/archive-ios` is the behavioural spec; read its `docs/ARCHITECTURE.md` and the matching
  `Features/*` view models before writing each screen.
- **Building:** Android builds run on Linux, so CI on `ubuntu-latest` (Android SDK preinstalled) is
  the primary verification — no macOS runner. For local iteration, run Gradle in a Docker image with
  the Android SDK (Docker Desktop is on the Mac; the container's proxy may block Google/Maven repos,
  so the Mac-Docker path is safest), or use the Mac directly if `$ANDROID_HOME`/Android Studio is
  present (check first). `:core` builds/tests with a JDK alone.
- **Git/transfer** (if authoring in the cloud container): tar the tree → `device_commit_files` into
  `~/Projects/resale-platform/_to_delete/archive-android.tgz` (gitignored) → a `ship-android.sh` on
  the Mac that extracts over `~/Projects/archive-android`, commits, pushes, and prints the run id.
  The Mac's `/usr/bin/git` shim is blocked until `sudo xcodebuild -license accept` is run; until then
  use `/Library/Developer/CommandLineTools/usr/bin/git`. `gh` is authed on the Mac as `aetiusgular`.

## Founder actions (cannot be automated)
1. Fill `app/secrets.properties` from the example (API base URL, Supabase URL + anon key, Stripe
   publishable key). For an emulator, `API_BASE_URL = http://10.0.2.2:3000`; for a device, the Mac's
   LAN IP. (Cleartext to a dev server: add a debug `networkSecurityConfig` permitting localhost/LAN.)
2. Supabase Auth: the `archive://auth-callback` redirect URL already exists from iOS; add the Android
   OAuth client if using Google native sign-in.
3. **M3, not now:** a Firebase project + `google-services.json` for FCM, and the FCM sender in
   resale-platform's `lib/notify`.
4. Merge resale-platform's `feat/mobile-api` and apply migration `0046` (`pnpm exec supabase db
   push`) if not already done for iOS.
