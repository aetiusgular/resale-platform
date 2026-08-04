import { describe, it, expect } from 'vitest'
import type { TelemetryEvent } from '../../lib/recs/types'
import {
  uuidv7, hashQuery, Batcher,
  impressionStart, impressionEnd, clickDetail, saveEvent, unsaveEvent, searchEvent,
  type TelemetryIds,
} from '../../lib/recs/telemetry'

const UUID_V7 = /^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/
const IDS: TelemetryIds = { deviceId: 'device-123456', sessionId: 'sess-abcdef', userId: 'user-1' }
const AT = 1_710_000_000_000

describe('uuidv7', () => {
  it('is a well-formed v7 UUID (version nibble 7, RFC-4122 variant)', () => {
    const u = uuidv7(AT, () => 0.5)
    expect(u).toMatch(UUID_V7)
  })
  it('encodes time in the high bytes → later timestamps sort lexicographically after earlier ones', () => {
    const early = uuidv7(1_000, () => 0)
    const late = uuidv7(2_000_000, () => 0)
    expect(early < late).toBe(true)
  })
  it('is >= 8 chars (satisfies the engine envelope min_length) and unique per call', () => {
    const a = uuidv7(AT, Math.random)
    const b = uuidv7(AT, Math.random)
    expect(a.length).toBeGreaterThanOrEqual(8)
    expect(a).not.toBe(b)
  })
})

describe('hashQuery', () => {
  it('is deterministic 8-char hex', () => {
    expect(hashQuery('vintage helmut lang')).toMatch(/^[0-9a-f]{8}$/)
    expect(hashQuery('vintage helmut lang')).toBe(hashQuery('vintage helmut lang'))
  })
  it('differs for different queries and handles empty string', () => {
    expect(hashQuery('a')).not.toBe(hashQuery('b'))
    expect(hashQuery('')).toMatch(/^[0-9a-f]{8}$/)
  })
})

describe('event builders', () => {
  it('impression_start carries a full envelope and clamps viewport to [0,1]', () => {
    const e = impressionStart(IDS, 'item-1', 3, 1.7, AT, () => 0)
    expect(e.type).toBe('impression_start')
    expect(e.item_id).toBe('item-1')
    expect(e.position).toBe(3)
    expect(e.viewport_pct).toBe(1) // clamped
    expect(e.schema_version).toBe(1)
    expect(e.device_id).toBe('device-123456')
    expect(e.session_id).toBe('sess-abcdef')
    expect(e.user_id).toBe('user-1')
    expect(e.client_ts).toBe(new Date(AT).toISOString())
    expect(e.event_id).toMatch(UUID_V7)
  })
  it('impression_end floors dwell at 0 and rounds', () => {
    const e = impressionEnd(IDS, 'item-1', -50, 0.4, AT, () => 0)
    expect(e.dwell_ms).toBe(0)
    const e2 = impressionEnd(IDS, 'item-1', 1234.6, 0.4, AT, () => 0)
    expect(e2.dwell_ms).toBe(1235)
  })
  it('click/save/unsave/search set the right discriminant', () => {
    expect(clickDetail(IDS, 'i', 'feed', AT, () => 0).type).toBe('click_detail')
    expect(saveEvent(IDS, 'i', AT, () => 0).type).toBe('save')
    expect(unsaveEvent(IDS, 'i', AT, () => 0).type).toBe('unsave')
    const se = searchEvent(IDS, 'deadbeef', { dept: 'menswear' }, AT, () => 0)
    expect(se.type).toBe('search')
    expect(se.query_hash).toBe('deadbeef')
    expect(se.filters).toEqual({ dept: 'menswear' })
  })
})

describe('Batcher', () => {
  const ev = (): TelemetryEvent => clickDetail(IDS, 'i', 'feed', AT, () => 0)

  it('does not flush below the batch size', () => {
    const sent: TelemetryEvent[][] = []
    const b = new Batcher((e) => sent.push(e), 3)
    b.add(ev()); b.add(ev())
    expect(b.size()).toBe(2)
    expect(sent).toHaveLength(0)
  })
  it('auto-flushes when the batch size is reached and resets the queue', () => {
    const sent: TelemetryEvent[][] = []
    const b = new Batcher((e) => sent.push(e), 3)
    b.add(ev()); b.add(ev()); b.add(ev())
    expect(sent).toHaveLength(1)
    expect(sent[0]).toHaveLength(3)
    expect(b.size()).toBe(0)
  })
  it('manual flush drains, and flushing an empty queue is a no-op', () => {
    const sent: TelemetryEvent[][] = []
    const b = new Batcher((e) => sent.push(e), 100)
    b.add(ev())
    b.flush()
    expect(sent).toHaveLength(1)
    b.flush() // empty
    expect(sent).toHaveLength(1)
  })
})
