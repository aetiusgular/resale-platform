# recs-engine API contract (verified against source 2026-07-26)

Verified from `~/Documents/Claude/Projects/agora/recs-engine/src/recs/`:
`telemetry/app.py`, `feed/app.py`, `schemas/{events,listings,feed}.py`.
Treat this as the integration source-of-truth for G1. Secrets stay SERVER-SIDE.

## Ingest API — `RECS_INGEST_URL` (default :8000)

**`POST /v1/events:batch`** → `202 {"accepted": n}`
- Body: **non-empty JSON array** of event objects (≤ `max_batch_events`, ≤ `max_body_bytes`).
- **Exactly one distinct `device_id`** across the batch, else `400`.
- Auth header **`X-Device-Token`** = `hex(HMAC_SHA256(device_id, RECS_INGEST_HMAC_SECRET))`.
  MUST be computed SERVER-SIDE (thin Next route handler) — never in the browser.
- Rate-limited per device/minute → `429` + `Retry-After: 30`.
- Redis down → **`503`** ("event buffer unavailable"). **Fail-soft**: on 503/network error,
  drop/queue-locally and move on — never surface an error to the user, never block UI.
- Ingest only shape-checks the envelope (`extra="allow"`); bad per-kind fields are NOT
  rejected here — they DLQ downstream. So send correctly-shaped events regardless.

### Event envelope (every event)
`event_id` (UUIDv7 string), `session_id` (str ≥8), `user_id` (str|null), `device_id` (str ≥8),
`client_ts` (ISO-8601, **tz-aware**), `schema_version` = `1`, `type` (kind).
Full schemas are `extra="forbid"` — send exactly the declared fields, no extras.

### 12 event kinds (`type`) + extra fields
- `impression_start` {item_id, position≥0, viewport_pct 0..1}
- `impression_end` {item_id, dwell_ms≥0, max_viewport_pct 0..1}
- `heartbeat` {item_id?, visible: bool}
- `scroll_depth` {page (1..64), depth_pct 0..1, velocity_bucket: slow|medium|fast}
- `click_detail` {item_id, source: feed|search|profile|external}
- `like` | `unlike` | `save` | `unsave` {item_id}
- `comment` | `inquiry` {item_id, length_bucket: short|medium|long}
- `search` {query_hash (1..128), filters: Record<string,string>}

## Feed API — `RECS_FEED_URL` (default :8001), all `Authorization: Bearer <RECS_FEED_API_TOKEN>`

- **`GET /v1/feed?user_id=&device_id=&cursor=`** → `{ items: [{item_id, score, source: taste|explore|trending, matched_attributes: string[]}], cursor, space: clip_base|aesthetic }`.
  One of `user_id`/`device_id` required. Unknown/expired cursor → 404/410 → restart pagination.
  Hydrate `item_id`s from Supabase, render in order, show `matched_attributes` as "because you like…" chips.
- **`GET /v1/aesthetics`** → `{ aesthetics: [{key, display_name}] }` (16).
- **`POST /v1/users/{user_key}/seed`** body `{ aesthetics: [key,...] }` → `204`.
- **`POST /v1/identity/merge`** body `{ device_key, account_key }` → `204`.
- `user_key` = `u:{user_id}` when authenticated, else `d:{device_id}`.

## Listings ingestion — Redis stream `listings:changes` (NO HTTP endpoint exists)

recs-engine consumes a `ListingChange` discriminated union (on `kind`) from Redis XADD.
**There is no `POST /v1/listings`** — ADAPTER NEEDED: add a thin `POST /v1/listings`
webhook to recs-engine (validate → XADD to `listings:changes`) on a recs-engine branch,
OR have the platform produce to Redis directly. HTTP adapter is cleaner.

- `created` | `updated` { kind, listing_id (UUID), payload, photo_paths (**≥1**, ≤16), primary_index≥0 }
- `sold` { kind, listing_id }
- `deleted` { kind, listing_id }
- `payload` (ListingPayload): brand (1..128), era?, designer?, material?, category (1..64),
  subcategory?, price (>0 float), size?, condition?, aesthetic_tags: string[], seller_rating (0..5|null), listed_at (tz-aware ISO).

### PHOTO HANDLING (key decision)
recs-engine's indexer reads photos via `preprocess.load_image` (local paths). Platform photos
are Supabase Storage URLs. ADAPTER NEEDED: extend recs-engine `load_image` to also fetch
http(s) URLs, and pass photo URLs in `photo_paths`. Backfill existing listings once via
`scripts/backfill.py` or repeated webhook calls.

## Two permitted recs-engine adapters (separate recs-engine branch; do NOT touch scoring/decay/feed)
1. `preprocess.load_image` → also fetch http(s) URLs (for Supabase-hosted photos).
2. `POST /v1/listings` webhook (validate → XADD `listings:changes`) — since none exists.

## Platform env (server-side secrets only; behind `RECS_ENABLED`)
`RECS_ENABLED`, `RECS_INGEST_URL`, `RECS_FEED_URL`, `RECS_FEED_API_TOKEN`, `RECS_INGEST_HMAC_SECRET`.
Never expose the HMAC secret or feed token to the browser. Platform must work fully with `RECS_ENABLED=false`.
