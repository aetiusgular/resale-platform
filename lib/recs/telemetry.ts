'use client'
/**
 * Client-side recs telemetry — batches interaction events and POSTs them to the
 * server proxy `/api/recs/events`, which HMAC-signs and forwards to recs-engine.
 * The browser NEVER holds the ingest secret and never talks to recs-engine directly.
 *
 * FAIL-SOFT + no-op when disabled: every public function is a guarded no-op unless
 * NEXT_PUBLIC_RECS_ENABLED is 'true' and a DOM is present. Nothing here can throw
 * into the UI. Design mirrors recs-engine's envelope contract (lib/recs/types.ts).
 *
 * The module splits into PURE cores (uuidv7, envelope builders, hashQuery, Batcher)
 * that are unit-tested, and a thin browser shell (ids, flush transport, observer).
 */
import { RECS_TELEMETRY_ENABLED } from '@/lib/flags'
import type {
  TelemetryEvent,
  ImpressionStart,
  ImpressionEnd,
  ClickDetail,
  Like,
  Unlike,
  Save,
  Unsave,
  Search,
} from './types'

// ── Pure: UUIDv7 (48-bit ms timestamp + random; version 7, RFC-4122 variant) ──
export function uuidv7(nowMs: number = Date.now(), rand: () => number = Math.random): string {
  const ts = Math.floor(nowMs)
  const b = new Array<number>(16)
  b[0] = Math.floor(ts / 2 ** 40) & 0xff
  b[1] = Math.floor(ts / 2 ** 32) & 0xff
  b[2] = Math.floor(ts / 2 ** 24) & 0xff
  b[3] = Math.floor(ts / 2 ** 16) & 0xff
  b[4] = Math.floor(ts / 2 ** 8) & 0xff
  b[5] = ts & 0xff
  for (let i = 6; i < 16; i++) b[i] = Math.floor(rand() * 256) & 0xff
  b[6] = (b[6] & 0x0f) | 0x70 // version 7
  b[8] = (b[8] & 0x3f) | 0x80 // variant 10xx
  const h = b.map((n) => n.toString(16).padStart(2, '0')).join('')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`
}

// ── Pure: stable non-crypto hash of a search query (engine stores query_hash) ──
export function hashQuery(query: string): string {
  let h = 5381
  for (let i = 0; i < query.length; i++) h = ((h << 5) + h + query.charCodeAt(i)) >>> 0
  return h.toString(16).padStart(8, '0')
}

// ── Pure: envelope + typed event builders ────────────────────────────────────
export interface TelemetryIds {
  deviceId: string
  sessionId: string
  userId: string | null
}

function base(ids: TelemetryIds, nowMs: number, rand?: () => number) {
  return {
    event_id: uuidv7(nowMs, rand),
    session_id: ids.sessionId,
    user_id: ids.userId,
    device_id: ids.deviceId,
    client_ts: new Date(nowMs).toISOString(),
    schema_version: 1 as const,
  }
}

export function impressionStart(
  ids: TelemetryIds, itemId: string, position: number, viewportPct: number,
  nowMs: number = Date.now(), rand?: () => number,
): ImpressionStart {
  return { ...base(ids, nowMs, rand), type: 'impression_start', item_id: itemId, position, viewport_pct: clamp01(viewportPct) }
}

export function impressionEnd(
  ids: TelemetryIds, itemId: string, dwellMs: number, maxViewportPct: number,
  nowMs: number = Date.now(), rand?: () => number,
): ImpressionEnd {
  return { ...base(ids, nowMs, rand), type: 'impression_end', item_id: itemId, dwell_ms: Math.max(0, Math.round(dwellMs)), max_viewport_pct: clamp01(maxViewportPct) }
}

export function clickDetail(
  ids: TelemetryIds, itemId: string, source: ClickDetail['source'],
  nowMs: number = Date.now(), rand?: () => number,
): ClickDetail {
  return { ...base(ids, nowMs, rand), type: 'click_detail', item_id: itemId, source }
}

export function likeEvent(ids: TelemetryIds, itemId: string, nowMs: number = Date.now(), rand?: () => number): Like {
  return { ...base(ids, nowMs, rand), type: 'like', item_id: itemId }
}
export function unlikeEvent(ids: TelemetryIds, itemId: string, nowMs: number = Date.now(), rand?: () => number): Unlike {
  return { ...base(ids, nowMs, rand), type: 'unlike', item_id: itemId }
}
export function saveEvent(ids: TelemetryIds, itemId: string, nowMs: number = Date.now(), rand?: () => number): Save {
  return { ...base(ids, nowMs, rand), type: 'save', item_id: itemId }
}
export function unsaveEvent(ids: TelemetryIds, itemId: string, nowMs: number = Date.now(), rand?: () => number): Unsave {
  return { ...base(ids, nowMs, rand), type: 'unsave', item_id: itemId }
}
export function searchEvent(
  ids: TelemetryIds, queryHash: string, filters: Record<string, string>,
  nowMs: number = Date.now(), rand?: () => number,
): Search {
  return { ...base(ids, nowMs, rand), type: 'search', query_hash: queryHash, filters }
}

function clamp01(x: number): number {
  if (!Number.isFinite(x)) return 0
  return x < 0 ? 0 : x > 1 ? 1 : x
}

// ── Pure: size/interval batcher. Transport is injected so it's fully testable. ─
export class Batcher {
  private queue: TelemetryEvent[] = []
  constructor(
    private readonly flushFn: (events: TelemetryEvent[]) => void,
    private readonly maxBatch = 20,
  ) {}

  add(event: TelemetryEvent): void {
    this.queue.push(event)
    if (this.queue.length >= this.maxBatch) this.flush()
  }
  size(): number {
    return this.queue.length
  }
  /** Drain the queue through the transport. No-op when empty. */
  flush(): void {
    if (this.queue.length === 0) return
    const batch = this.queue.splice(0, this.queue.length)
    this.flushFn(batch)
  }
}

// ── Browser shell ────────────────────────────────────────────────────────────
const DEVICE_KEY = 'recs_device_id'
const SESSION_KEY = 'recs_session_id'
const FLUSH_INTERVAL_MS = 5000
const ENDPOINT = '/api/recs/events'

function active(): boolean {
  return RECS_TELEMETRY_ENABLED && typeof window !== 'undefined'
}

function readStored(store: Storage | null, key: string): string | null {
  try {
    return store?.getItem(key) ?? null
  } catch {
    return null
  }
}
function writeStored(store: Storage | null, key: string, value: string): void {
  try {
    store?.setItem(key, value)
  } catch {
    /* private mode / disabled storage → in-memory only */
  }
}

let memDeviceId: string | null = null
let memSessionId: string | null = null

function deviceId(): string {
  if (memDeviceId) return memDeviceId
  const ls = typeof localStorage !== 'undefined' ? localStorage : null
  let id = readStored(ls, DEVICE_KEY)
  if (!id) {
    id = uuidv7()
    writeStored(ls, DEVICE_KEY, id)
  }
  memDeviceId = id
  return id
}
function sessionId(): string {
  if (memSessionId) return memSessionId
  const ss = typeof sessionStorage !== 'undefined' ? sessionStorage : null
  let id = readStored(ss, SESSION_KEY)
  if (!id) {
    id = uuidv7()
    writeStored(ss, SESSION_KEY, id)
  }
  memSessionId = id
  return id
}

let currentUserId: string | null = null
function ids(): TelemetryIds {
  return { deviceId: deviceId(), sessionId: sessionId(), userId: currentUserId }
}

/** Read the stored device id WITHOUT creating one — merge only folds an EXISTING anon device. */
export function currentDeviceId(): string | null {
  if (memDeviceId) return memDeviceId
  const ls = typeof localStorage !== 'undefined' ? localStorage : null
  return readStored(ls, DEVICE_KEY)
}

/**
 * Fold this device's anonymous taste profile into the now-authenticated account.
 * Fire-and-forget + fail-soft; runs at most once per (device, account) pair. No-op
 * when telemetry is disabled or the device has no stored id yet (nothing to merge).
 * The server route derives the account key from the session and holds the feed token.
 */
export function mergeRecsIdentity(userId: string): void {
  if (!active() || !userId) return
  const device = currentDeviceId()
  if (!device) return
  const ls = typeof localStorage !== 'undefined' ? localStorage : null
  const marker = `recs_merged:${userId}`
  if (readStored(ls, marker)) return
  writeStored(ls, marker, '1')
  try {
    void fetch('/api/recs/identity/merge', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ deviceId: device }),
      keepalive: true,
      cache: 'no-store',
    }).catch(() => {})
  } catch {
    /* fail-soft: identity merge never surfaces to the UI */
  }
}

// Transport: normal flush uses fetch(keepalive); unload uses sendBeacon.
function send(events: TelemetryEvent[], beacon = false): void {
  if (events.length === 0) return
  const payload = JSON.stringify({ deviceId: deviceId(), events })
  try {
    if (beacon && typeof navigator !== 'undefined' && typeof navigator.sendBeacon === 'function') {
      navigator.sendBeacon(ENDPOINT, new Blob([payload], { type: 'application/json' }))
      return
    }
    void fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
      keepalive: true,
      cache: 'no-store',
    }).catch(() => {})
  } catch {
    /* fail-soft: telemetry never surfaces to the UI */
  }
}

let batcher: Batcher | null = null
let flushTimer: ReturnType<typeof setInterval> | null = null
let initialized = false
// When true, flushes route through sendBeacon (set on unload paths, never reset).
let unloading = false

function getBatcher(): Batcher {
  if (!batcher) batcher = new Batcher((events) => send(events, unloading))
  return batcher
}

// Force whatever is queued out via sendBeacon (used on hide/unload).
function beaconFlush(): void {
  unloading = true
  batcher?.flush()
}

/** Idempotent. Sets the current user, starts the flush timer + unload hooks. */
export function recsInit(userId: string | null): void {
  currentUserId = userId
  if (!active() || initialized) return
  initialized = true
  getBatcher()
  flushTimer = setInterval(() => getBatcher().flush(), FLUSH_INTERVAL_MS)
  window.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') beaconFlush()
  })
  window.addEventListener('pagehide', beaconFlush)
}

function enqueue(event: TelemetryEvent): void {
  if (!active()) return
  getBatcher().add(event)
}

// ── Public tracking helpers ──────────────────────────────────────────────────
export function trackClick(itemId: string, source: ClickDetail['source'] = 'feed'): void {
  if (!active()) return
  enqueue(clickDetail(ids(), itemId, source))
}
export function trackSave(itemId: string): void {
  if (!active()) return
  enqueue(saveEvent(ids(), itemId))
}
export function trackUnsave(itemId: string): void {
  if (!active()) return
  enqueue(unsaveEvent(ids(), itemId))
}
export function trackSearch(query: string, filters: Record<string, string>): void {
  if (!active()) return
  enqueue(searchEvent(ids(), hashQuery(query), filters))
}

/**
 * Observe listing cards for impressions. Fires impression_start when a card
 * crosses 50% visibility and impression_end (with dwell + max visibility) when
 * it drops back below. Cards are matched by the `data-recs-item-id` attribute;
 * `data-recs-pos` supplies the feed position. Returns a disconnect function.
 */
export function observeImpressions(root: ParentNode = document): () => void {
  if (!active() || typeof IntersectionObserver === 'undefined') return () => {}
  const THRESHOLD = 0.5
  const seenStart = new Map<Element, { start: number; maxRatio: number; pos: number; id: string }>()
  const observer = new IntersectionObserver(
    (entries) => {
      const now = Date.now()
      for (const e of entries) {
        const el = e.target
        const id = el.getAttribute('data-recs-item-id')
        if (!id) continue
        const pos = Number(el.getAttribute('data-recs-pos') ?? '0') || 0
        const visible = e.isIntersecting && e.intersectionRatio >= THRESHOLD
        const rec = seenStart.get(el)
        if (visible && !rec) {
          seenStart.set(el, { start: now, maxRatio: e.intersectionRatio, pos, id })
          enqueue(impressionStart(ids(), id, pos, e.intersectionRatio))
        } else if (visible && rec) {
          rec.maxRatio = Math.max(rec.maxRatio, e.intersectionRatio)
        } else if (!visible && rec) {
          enqueue(impressionEnd(ids(), rec.id, now - rec.start, rec.maxRatio))
          seenStart.delete(el)
        }
      }
    },
    { threshold: [0, THRESHOLD, 1] },
  )
  root.querySelectorAll('[data-recs-item-id]').forEach((el) => observer.observe(el))
  return () => {
    // Emit a final impression_end for anything still visible at teardown.
    const now = Date.now()
    seenStart.forEach((rec) => enqueue(impressionEnd(ids(), rec.id, now - rec.start, rec.maxRatio)))
    seenStart.clear()
    observer.disconnect()
  }
}

/** Test/teardown helper: stop the flush timer and reset init state. */
export function recsShutdown(): void {
  if (flushTimer) clearInterval(flushTimer)
  flushTimer = null
  initialized = false
}
