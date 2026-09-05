# M3 — Native value and release

```
READ ONLY (resale-platform): CLAUDE.md, docs/MOBILE_PLAN.md, docs/api/openapi.yaml,
lib/notify/*.ts, app/api/notifications/devices/route.ts, docs/LAUNCH_RUNBOOK.md.
READ ONLY (archive-ios): CLAUDE.md, docs/HANDOFF.md, ArchiveIOS/Services/PushService.swift,
ArchiveIOS/App/DeepLinks.swift.
PLAN FIRST.
```

TASKS

1. **Push end to end**: permission prompt placed where the wireframes put it (notifications
   screen banner, not at launch); `PushService` registers the APNs token with
   `POST /api/notifications/devices` on every launch and on token change, deletes on sign out;
   notification taps route through `DeepLink`; badge count from `GET /api/me` counts. Backend:
   verify `lib/notify/apns.ts` against a sandbox device with `APNS_ENV=sandbox`.
2. **Universal links**: `apple-app-site-association` served from the web app once the domain is
   fixed; `archive://` stays as fallback. Connect/Identity return URLs switch to https.
3. **Release hygiene**: app icon and launch screen from the design system, `PrivacyInfo.xcprivacy`
   (required reason APIs, tracking = none), privacy nutrition labels draft in `docs/RELEASE.md`,
   crash reporting decision (Sentry iOS or none), build numbers from CI, `fastlane` lane or
   `xcodebuild -exportArchive` recipe for TestFlight, `minBuild` bump procedure documented.
4. **Performance pass**: image prefetch on browse, list diffing, cold-start under 1.5 s on an
   iPhone 12, no main-thread JSON decoding.
5. **Android kickoff doc**: `docs/ANDROID_PLAN.md` in resale-platform pointing at the same
   OpenAPI file; repo `archive-android` created from `~/Downloads/frontend-android`.

ACCEPTANCE: TestFlight build installed on the founder's phone receives an offer notification
sent from web and deep-links into the thread · `xcodebuild archive` green · `docs/RELEASE.md`
complete. Then VERIFY → RECORD → DECIDE.
