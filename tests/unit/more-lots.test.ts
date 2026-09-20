import { describe, it, expect } from 'vitest'
import { MORE_LOTS_LIMIT, orderMoreLots } from '../../lib/loaders/more-lots'

const lot = (id: string, category: string, department: string) => ({ id, category, department })
const here = { id: 'self', category: 'Tops', department: 'womens' }

describe('orderMoreLots — the rail under a listing', () => {
  it('puts the same category first, the listing\'s own department ahead of the other', () => {
    const same = [lot('a', 'Tops', 'mens'), lot('b', 'Tops', 'womens'), lot('c', 'Tops', 'mens'), lot('d', 'Tops', 'womens')]
    const fill = [lot('x', 'Bottoms', 'womens'), lot('y', 'Footwear', 'mens')]
    expect(orderMoreLots(same, fill, here).map((l) => l.id)).toEqual(['b', 'd', 'a', 'c', 'x', 'y'])
  })

  it('keeps the incoming (newest-first) order inside every group', () => {
    const same = [lot('n1', 'Tops', 'womens'), lot('n2', 'Tops', 'womens'), lot('n3', 'Tops', 'womens')]
    expect(orderMoreLots(same, [], here).map((l) => l.id)).toEqual(['n1', 'n2', 'n3'])
  })

  it('never includes the listing itself, even if a query returns it', () => {
    const same = [lot('self', 'Tops', 'womens'), lot('a', 'Tops', 'womens')]
    const fill = [lot('self', 'Tops', 'womens'), lot('x', 'Bottoms', 'mens')]
    expect(orderMoreLots(same, fill, here).map((l) => l.id)).toEqual(['a', 'x'])
  })

  it('never repeats a lot that shows up in both result sets', () => {
    const same = [lot('a', 'Tops', 'womens')]
    const fill = [lot('a', 'Tops', 'womens'), lot('x', 'Bottoms', 'mens')]
    expect(orderMoreLots(same, fill, here).map((l) => l.id)).toEqual(['a', 'x'])
  })

  it('ignores a wrong-category row that leaks into the same-category set', () => {
    const same = [lot('odd', 'Bottoms', 'womens'), lot('a', 'Tops', 'mens')]
    expect(orderMoreLots(same, [lot('x', 'Footwear', 'mens')], here).map((l) => l.id)).toEqual(['a', 'x'])
  })

  it('caps the rail at the limit, same category taking the seats first', () => {
    const same = Array.from({ length: 6 }, (_, i) => lot(`s${i}`, 'Tops', 'womens'))
    const fill = Array.from({ length: 6 }, (_, i) => lot(`f${i}`, 'Bottoms', 'mens'))
    const out = orderMoreLots(same, fill, here)
    expect(out).toHaveLength(MORE_LOTS_LIMIT)
    expect(out.map((l) => l.id)).toEqual(['s0', 's1', 's2', 's3', 's4', 's5', 'f0', 'f1'])
    expect(orderMoreLots(same, fill, here, 3).map((l) => l.id)).toEqual(['s0', 's1', 's2'])
  })

  it('returns an empty rail when there is nothing else active', () => {
    expect(orderMoreLots([], [], here)).toEqual([])
  })
})

// ── loadMoreLots — the query assembly, with a fake PostgREST builder ─────────
import { loadMoreLots } from '../../lib/loaders/more-lots'
import type { User } from '@supabase/supabase-js'

type QueryLog = { table: string; filters: Array<[string, string, unknown]> }

/**
 * Fake supabase client. Each `from(table)` records its filter chain and resolves (await → then)
 * to the rows configured for that table. `listings` reads pick their rows from `opts.listings`
 * by the recorded category/department eq/neq, matching loadMoreLots's three-tier fan-out.
 */
function makeClient(opts: {
  listings?: Array<Record<string, unknown>>
  saves?: string[]
  priceHistory?: Array<{ listing_id: string; old_price_cents: number; changed_at: string }>
  listingsError?: boolean
  throwOn?: string
}) {
  const calls: QueryLog[] = []
  const client = {
    from(table: string) {
      if (opts.throwOn === table) throw new Error(`boom:${table}`)
      const log: QueryLog = { table, filters: [] }
      calls.push(log)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const b: any = {
        select: () => b,
        order: () => b,
        limit: () => b,
        eq: (col: string, val: unknown) => { log.filters.push(['eq', col, val]); return b },
        neq: (col: string, val: unknown) => { log.filters.push(['neq', col, val]); return b },
        in: (col: string, val: unknown) => { log.filters.push(['in', col, val]); return b },
        then: (resolve: (v: unknown) => void) => {
          if (table === 'listings') {
            if (opts.listingsError) return resolve({ data: null, error: { message: 'col renamed' } })
            const cat = log.filters.find((f) => f[1] === 'category')
            const dept = log.filters.find((f) => f[1] === 'department')
            const rows = (opts.listings ?? []).filter((r) => {
              if (cat) { const hit = r.category === cat[2]; if ((cat[0] === 'eq') !== hit) return false }
              if (dept) { const hit = r.department === dept[2]; if ((dept[0] === 'eq') !== hit) return false }
              return true
            })
            return resolve({ data: rows, error: null })
          }
          if (table === 'price_history') return resolve({ data: opts.priceHistory ?? null, error: null })
          if (table === 'saves') return resolve({ data: (opts.saves ?? []).map((listing_id) => ({ listing_id })), error: null })
          return resolve({ data: null, error: null })
        },
      }
      return b
    },
    _calls: calls,
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return client as any
}

const member = { id: 'me' } as unknown as User
const rawLot = (over: Record<string, unknown>) => ({
  id: 'x', title: 'T', brand: 'B', category: 'Tops', department: 'womens', size: 'M',
  condition_score: 8, price_cents: 5000, saves_count: 1, is_price_dropped: false,
  authentication_status: 'none', images: [], created_at: '2026-09-01T00:00:00Z', seller_id: 's1',
  profiles: { username: 'u', id_verification_status: 'verified' }, ...over,
})

describe('loadMoreLots — DTO + data safety', () => {
  it('never emits the possession proof (slot 5), even when photo slots are sparse', async () => {
    const client = makeClient({ listings: [rawLot({ id: 'a', images: ['front', '', '', '', '', 'POSSESSION'] })] })
    const { lots } = await loadMoreLots({ supabase: client, user: null, listing: here })
    expect(lots).toHaveLength(1)
    expect(lots[0].images).toEqual(['front'])
    expect(lots[0].images).not.toContain('POSSESSION')
  })

  it('marks the viewer\'s own lot and never others as own', async () => {
    const client = makeClient({ listings: [rawLot({ id: 'a', seller_id: 'me' }), rawLot({ id: 'b', seller_id: 's2' })] })
    const { lots } = await loadMoreLots({ supabase: client, user: member, listing: here })
    expect(lots.find((l) => l.id === 'a')?.own).toBe(true)
    expect(lots.find((l) => l.id === 'b')?.own).toBe(false)
  })

  it('scopes the saves read to the current user and returns their saved ids', async () => {
    const client = makeClient({ listings: [rawLot({ id: 'a' })], saves: ['a'] })
    const { savedIds } = await loadMoreLots({ supabase: client, user: member, listing: here })
    expect(savedIds).toEqual(['a'])
    const savesCall = client._calls.find((c: QueryLog) => c.table === 'saves')
    expect(savesCall.filters).toContainEqual(['eq', 'user_id', 'me'])
  })

  it('does not read saves for a guest', async () => {
    const client = makeClient({ listings: [rawLot({ id: 'a' })], saves: ['a'] })
    const { savedIds } = await loadMoreLots({ supabase: client, user: null, listing: here })
    expect(savedIds).toEqual([])
    expect(client._calls.some((c: QueryLog) => c.table === 'saves')).toBe(false)
  })

  it('never marks a rail card promoted', async () => {
    const client = makeClient({ listings: [rawLot({ id: 'a' })] })
    const { lots } = await loadMoreLots({ supabase: client, user: null, listing: here })
    expect(lots.every((l) => l.promoted === false)).toBe(true)
  })

  it('excludes this listing and the same-category, own-department tier leads', async () => {
    const client = makeClient({ listings: [
      rawLot({ id: 'self', department: 'womens' }),           // the listing itself
      rawLot({ id: 'w1', category: 'Tops', department: 'womens' }),
      rawLot({ id: 'm1', category: 'Tops', department: 'mens' }),
      rawLot({ id: 'b1', category: 'Bottoms', department: 'womens' }),
    ] })
    const { lots } = await loadMoreLots({ supabase: client, user: null, listing: here })
    const ids = lots.map((l) => l.id)
    expect(ids).not.toContain('self')
    expect(ids[0]).toBe('w1')          // same category, own department first
    expect(ids.indexOf('m1')).toBeLessThan(ids.indexOf('b1')) // other dept before other category
  })

  it('returns an empty rail (not an error) when every listing query fails', async () => {
    const client = makeClient({ listingsError: true })
    await expect(loadMoreLots({ supabase: client, user: null, listing: here })).resolves.toEqual({ lots: [], savedIds: [] })
  })

  it('returns an empty rail when a query throws', async () => {
    const client = makeClient({ throwOn: 'listings' })
    await expect(loadMoreLots({ supabase: client, user: null, listing: here })).resolves.toEqual({ lots: [], savedIds: [] })
  })
})
