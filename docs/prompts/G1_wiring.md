# G1 wiring — platform integration (on-computer)

Wire the recs-engine client into the platform, all behind `RECS_ENABLED` and fail-soft.
The client (`lib/recs/client.ts`) already returns null/false when disabled/unreachable,
so **every step below is buildable and `pnpm verify`-green without a live recs-engine** —
only the final end-to-end round-trip needs the host. Nothing here touches money/auth;
run **code-reviewer** on the new route handlers per the roadmap.

## Already built + verified (cloud, pure, on branch)
- `lib/recs/listing-map.ts` — `toListingChange(row, 'created'|'updated')` (null when no
  photos), `listingSold`/`listingDeleted`, `centsToPrice`, `photoPaths`. Maps a
  `listings` row → the recs `ListingChange`. `tests/unit/recs-listing-map.test.ts` (9).
- (prior) `lib/recs/{client,config,hmac,keys,types}.ts` + `POST /api/recs/events` proxy.

## What needs live infra vs not
- **No host needed (build + verify now):** every step 1–5 below. Unit-test the pure
  pieces; assert `RECS_ENABLED=false` ⇒ zero behavior change; the fail-soft (engine
  down) path is just the unreachable case and is testable by pointing at a dead URL.
- **Host needed (one-time E2E, not a build blocker):** telemetry actually lands in
  Redis `events:raw`; a synced listing becomes a Qdrant point; `GET /v1/feed` returns
  real taste-ordered items. Do this once against the `docs/recs-hosting.md` VM, then
  flip `RECS_ENABLED=true` in prod.

## 1. Listings sync (create / update / sold / delete)  ← uses listing-map
In each server-side listing mutation, after the DB write commits, fire-and-forget:
```ts
import { toListingChange, listingSold, listingDeleted } from '@/lib/recs/listing-map'
import { postListingChange } from '@/lib/recs/client'
// on create/approve→active and on update:
const change = toListingChange(row, 'created') // or 'updated'
if (change) void postListingChange(change)     // fail-soft; never await-block the response
// on sold:   void postListingChange(listingSold(id))
// on delete: void postListingChange(listingDeleted(id))
```
Call sites: the listing create path (or admin approve→active, since only `active`
listings should index — decide which state transition emits `created`), the seller
update path, the order path that flips a listing to sold, and the delete path.
**Never let a recs failure roll back or delay the platform's own write.**
Verify: unit-test that the right change is produced per transition; with the flag off,
`postListingChange` early-returns false and nothing is sent.

## 2. Telemetry batching hook (client → /api/recs/events)
A small client hook that buffers `TelemetryEvent`s and flushes a batch to the existing
`POST /api/recs/events` proxy (which HMAC-signs server-side). Flush on: batch size (~20),
a timer (~5s), and `visibilitychange`/`pagehide` (use `navigator.sendBeacon` for the
unload flush). One `device_id` per batch (persist a UUID in a cookie/localStorage;
`user_id` from session when signed in). Emit `impression_start/end` (dwell), `click_detail`,
`like/save`, `search` from the feed/listing UI. All no-ops when the endpoint 202s empty
(flag off). Verify: unit-test the buffer (batch size flush, timer flush, one device_id,
drop when empty); no host needed — the proxy returns 202 regardless.

## 3. Feed-driven discovery (GET /v1/feed)
A server component / route that calls `getFeed({ userId, deviceId, cursor })`; on null
(disabled/unreachable/expired cursor) **fall back to the current default listing order** —
this is the whole point of fail-soft. On success, hydrate the returned `item_id`s from
Supabase (preserve feed order), render `matched_attributes` as "because you like…" chips,
and page with `cursor` (restart on 404/410). Gate the whole recs path on `feedReady()`.
Verify: with the flag off (or a dead URL) the page renders the default order unchanged.

## 4. Cold-start aesthetic picker + seed
On first session (no profile yet), call `getAesthetics()` → show the 16-choice picker →
`seedUser(userKey, keys)` where `userKey = userKeyFor(userId, deviceId)` (`u:`/`d:`).
Skip silently if `getAesthetics()` returns null. Verify: unit-test the userKey selection;
picker only shows when aesthetics load.

## 5. Identity merge on login
When an anonymous device signs into an account, call
`mergeIdentity(d:{device_id}, u:{user_id})` once so the anon taste profile folds into the
account. Fire-and-forget, fail-soft. Verify: called once on the auth transition; no-op
when disabled.

## Acceptance
`pnpm verify` green with new unit tests; `RECS_ENABLED=false` ⇒ byte-identical behavior
to today (default order, telemetry proxy 202s empty, no feed calls); code-reviewer on the
`/api/recs/*` + feed route handlers. Live E2E (telemetry→Redis, listing→Qdrant point,
feed ordering, fail-soft on kill) is a separate one-time check against the hosted VM.
```
