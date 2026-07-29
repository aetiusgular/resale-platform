/**
 * recs-engine wire types — mirror the verified contract (docs/recs-contract.md).
 * Kept in lock-step with recs-engine/src/recs/schemas/{events,listings,feed}.py.
 */

export type EventKind =
  | 'impression_start'
  | 'impression_end'
  | 'heartbeat'
  | 'scroll_depth'
  | 'click_detail'
  | 'like'
  | 'unlike'
  | 'save'
  | 'unsave'
  | 'comment'
  | 'inquiry'
  | 'search'

/** Envelope shared by every telemetry event. `client_ts` is tz-aware ISO-8601. */
interface EventEnvelope {
  event_id: string // UUIDv7 string
  session_id: string // >= 8 chars
  user_id: string | null
  device_id: string // >= 8 chars
  client_ts: string // ISO-8601, tz-aware
  schema_version: 1
  type: EventKind
}

export interface ImpressionStart extends EventEnvelope {
  type: 'impression_start'
  item_id: string
  position: number
  viewport_pct: number // 0..1
}
export interface ImpressionEnd extends EventEnvelope {
  type: 'impression_end'
  item_id: string
  dwell_ms: number
  max_viewport_pct: number // 0..1
}
export interface Heartbeat extends EventEnvelope {
  type: 'heartbeat'
  item_id?: string
  visible: boolean
}
export interface ScrollDepth extends EventEnvelope {
  type: 'scroll_depth'
  page: string
  depth_pct: number // 0..1
  velocity_bucket: 'slow' | 'medium' | 'fast'
}
export interface ClickDetail extends EventEnvelope {
  type: 'click_detail'
  item_id: string
  source: 'feed' | 'search' | 'profile' | 'external'
}
export interface Like extends EventEnvelope { type: 'like'; item_id: string }
export interface Unlike extends EventEnvelope { type: 'unlike'; item_id: string }
export interface Save extends EventEnvelope { type: 'save'; item_id: string }
export interface Unsave extends EventEnvelope { type: 'unsave'; item_id: string }
export interface Comment extends EventEnvelope {
  type: 'comment'
  item_id: string
  length_bucket: 'short' | 'medium' | 'long'
}
export interface Inquiry extends EventEnvelope {
  type: 'inquiry'
  item_id: string
  length_bucket: 'short' | 'medium' | 'long'
}
export interface Search extends EventEnvelope {
  type: 'search'
  query_hash: string
  filters: Record<string, string>
}

export type TelemetryEvent =
  | ImpressionStart
  | ImpressionEnd
  | Heartbeat
  | ScrollDepth
  | ClickDetail
  | Like
  | Unlike
  | Save
  | Unsave
  | Comment
  | Inquiry
  | Search

// ── Feed API ────────────────────────────────────────────────────────────────
export interface FeedItem {
  item_id: string
  score: number
  source: 'taste' | 'explore' | 'trending'
  matched_attributes: string[]
}
export interface FeedResponse {
  items: FeedItem[]
  cursor: string
  space: 'clip_base' | 'aesthetic'
}
export interface AestheticsResponse {
  aesthetics: { key: string; display_name: string }[]
}

// ── Listings ingestion (ListingChange discriminated union on `kind`) ─────────
export interface ListingPayload {
  brand: string
  era?: string | null
  designer?: string | null
  material?: string | null
  category: string
  subcategory?: string | null
  price: number // > 0
  size?: string | null
  condition?: string | null
  aesthetic_tags?: string[]
  seller_rating?: number | null // 0..5
  listed_at: string // ISO-8601, tz-aware
}
export type ListingChange =
  | { kind: 'created'; listing_id: string; payload: ListingPayload; photo_paths: string[]; primary_index?: number }
  | { kind: 'updated'; listing_id: string; payload: ListingPayload; photo_paths: string[]; primary_index?: number }
  | { kind: 'sold'; listing_id: string }
  | { kind: 'deleted'; listing_id: string }
