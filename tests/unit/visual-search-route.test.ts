import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

// ── module mocks (the route's repo-internal dependencies) ─────────────────────
const rpc = vi.fn()
// A thenable query builder: every chained call returns `chain`, `await chain` resolves the
// listing rows set by listingRows(), and `.maybeSingle()` resolves the image_hashes row.
type Resolver = (value: unknown) => unknown
const chain: {
  select: ReturnType<typeof vi.fn>; in: ReturnType<typeof vi.fn>; eq: ReturnType<typeof vi.fn>
  maybeSingle: ReturnType<typeof vi.fn>; then: (res: Resolver, rej?: Resolver) => Promise<unknown>; rows: unknown[]
} = {
  select: vi.fn(), in: vi.fn(), eq: vi.fn(), maybeSingle: vi.fn(), rows: [],
  then(res, rej) { return Promise.resolve({ data: chain.rows }).then(res, rej) },
}
const from = vi.fn(() => chain)
const getUser = vi.fn()
const rateLimit = vi.fn()
const engineByImage = vi.fn()
const engineByListing = vi.fn()
const blockhash = vi.fn()

vi.mock('@/lib/flags', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/flags')>()
  return { ...actual, VISUAL_SEARCH_ENABLED: true }
})
vi.mock('@/lib/visual-search/config', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/visual-search/config')>()
  return { ...actual, VISUAL_SEARCH_ENABLED: true, VISUAL_SEARCH_GUESTS: true, VISUAL_SEARCH_MAX_BYTES: 2000 }
})
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({ auth: { getUser } })),
  UnauthorizedError: class UnauthorizedError extends Error {},
}))
vi.mock('@/lib/supabase/service', () => ({
  createServiceClientRaw: vi.fn(() => ({ rpc, from })),
}))
vi.mock('@/lib/rate-limit', () => ({ checkRateLimit: rateLimit }))
vi.mock('@/lib/visual-search/client', () => ({
  engineSearchByImage: engineByImage,
  engineSearchByListingPhoto: engineByListing,
}))
vi.mock('@/lib/visual-search/image', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/visual-search/image')>()
  return { ...actual, blockhashFromBuffer: blockhash }
})
vi.mock('@/lib/security/image-url', () => ({
  storageHost: () => 'proj.supabase.co',
  isAllowedImageUrl: (u: string) => u.startsWith('https://proj.supabase.co/'),
}))

const { POST } = await import('@/app/api/search/image/route')

const A = '00000000-0000-4000-8000-00000000000a'
const B = '00000000-0000-4000-8000-00000000000b'
const IMG = (id: string, n: number) => `https://proj.supabase.co/storage/v1/object/public/product-images/${id}/p-${n}.jpg`
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0, 1, 2, 3])
const OK_LIMIT = { allowed: true, remaining: 19, retryAfterSeconds: 0 }

function upload(bytes: Uint8Array, type = 'image/jpeg', qs = '') {
  return new NextRequest(`http://t/api/search/image${qs}`, {
    method: 'POST',
    headers: { 'content-type': type, 'content-length': String(bytes.byteLength), 'x-forwarded-for': '203.0.113.9' },
    body: new Blob([bytes.slice().buffer as ArrayBuffer]),
  })
}

function listingRef(body: unknown) {
  return new NextRequest('http://t/api/search/image', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

function listingRows(rows: Array<{ id: string; images: string[]; status?: string; seller_id?: string }>) {
  chain.select.mockReturnValue(chain)
  chain.in.mockReturnValue(chain)
  chain.eq.mockReturnValue(chain)
  chain.rows = rows
    .filter((r) => (r.status ?? 'active') === 'active')
    .map((r) => ({
      id: r.id, title: 'Curved jacket', brand: 'Post Archive Faction', category: 'outerwear', department: 'menswear',
      subcategory: null, size: 'M', color: 'Black', condition_score: 8, price_cents: 42000, saves_count: 3,
      is_price_dropped: false, authentication_status: 'none', status: 'active', images: r.images,
      created_at: '2026-09-24T00:00:00Z', seller_id: r.seller_id ?? 'seller-1', possession_photo_url: null,
      profiles: { username: 'mara', id_verification_status: 'verified' },
    }))
}

beforeEach(() => {
  vi.clearAllMocks()
  getUser.mockResolvedValue({ data: { user: null } })
  rateLimit.mockResolvedValue(OK_LIMIT)
  blockhash.mockResolvedValue('a'.repeat(64))
  rpc.mockResolvedValue({ data: [], error: null })
  engineByImage.mockResolvedValue(null)
  engineByListing.mockResolvedValue(null)
  listingRows([])
})

describe('POST /api/search/image', () => {
  it('rate-limits guests by IP with a Retry-After', async () => {
    rateLimit.mockResolvedValueOnce({ allowed: false, remaining: 0, retryAfterSeconds: 42 })
    const res = await POST(upload(JPEG))
    expect(res.status).toBe(429)
    expect(res.headers.get('retry-after')).toBe('42')
    expect(rateLimit).toHaveBeenCalledWith('visual-search:ip:203.0.113.9', 20, 60_000)
    expect(engineByImage).not.toHaveBeenCalled()
  })

  it('keys the rate limit on the user id when signed in', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'user-7' } } })
    await POST(upload(JPEG))
    expect(rateLimit).toHaveBeenCalledWith('visual-search:u:user-7', 20, 60_000)
  })

  it('rejects oversize, empty and non-image uploads before touching the engine', async () => {
    expect((await POST(upload(new Uint8Array(3000)))).status).toBe(413)
    expect((await POST(upload(new Uint8Array([])))).status).toBe(400)
    const gif = await POST(upload(new Uint8Array([0x47, 0x49, 0x46, 0x38, 0, 0])))
    expect(gif.status).toBe(415)
    expect(await gif.json()).toMatchObject({ code: 'unsupported_image_type' })
    expect(engineByImage).not.toHaveBeenCalled()
    expect(blockhash).not.toHaveBeenCalled()
  })

  it('answers with the hash tier alone when the engine is unavailable', async () => {
    rpc.mockResolvedValueOnce({ data: [{ listing_id: A, slot: 'PHOTO_2', distance: 3 }], error: null })
    listingRows([{ id: A, images: [IMG(A, 1), IMG(A, 2)] }])
    const res = await POST(upload(JPEG))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.engine).toBe('unavailable')
    expect(body.listed).toBe(true)
    expect(body.exact).toHaveLength(1)
    expect(body.exact[0]).toMatchObject({
      listing_id: A, tier: 'exact', hamming: 3, photo_index: 1, matched_photo: IMG(A, 2),
      listing: { id: A, price_display: '$420', seller: { username: 'mara' }, images: [IMG(A, 1), IMG(A, 2)] },
    })
    expect(rpc).toHaveBeenCalledWith('similar_image_hashes', expect.objectContaining({
      query_hex: 'a'.repeat(64), max_distance: 64, max_rows: 60, exclude_listing: null, exclude_seller: null,
    }))
    expect(engineByImage).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', { categories: [], limit: 40 })
  })

  it('merges engine tiers, hydrates active listings only, forwards categories', async () => {
    engineByImage.mockResolvedValueOnce({
      listed: true,
      query_category: 'outerwear',
      results: [
        { listing_id: A, photo_index: 0, score: 0.9, tier: 'match' },
        { listing_id: B, photo_index: 0, score: 0.6, tier: 'close' },
      ],
      counts: { exact: 0, match: 1, close: 1 },
      thresholds: { exact_cos: 0.93, match_cos: 0.8 },
    })
    listingRows([{ id: A, images: [IMG(A, 1)] }, { id: B, images: [IMG(B, 1)], status: 'sold' }])
    const res = await POST(upload(JPEG, 'image/jpeg', '?category=outerwear&category=tops'))
    const body = await res.json()
    expect(body.engine).toBe('ok')
    expect(body.category).toBe('outerwear')
    expect(body.match.map((h: { listing_id: string }) => h.listing_id)).toEqual([A])
    expect(body.close).toEqual([]) // B is sold → dropped at hydration
    expect(engineByImage).toHaveBeenCalledWith(expect.any(Buffer), 'image/jpeg', { categories: ['outerwear', 'tops'], limit: 40 })
  })

  it('marks the viewer\'s own listing and drops listings without a public photo', async () => {
    getUser.mockResolvedValueOnce({ data: { user: { id: 'seller-1' } } })
    engineByImage.mockResolvedValueOnce({
      listed: true, query_category: null,
      results: [
        { listing_id: A, photo_index: 0, score: 0.95, tier: 'exact' },
        { listing_id: B, photo_index: 0, score: 0.9, tier: 'match' },
      ],
      counts: { exact: 1, match: 1, close: 0 }, thresholds: { exact_cos: 0.93, match_cos: 0.8 },
    })
    listingRows([{ id: A, images: [IMG(A, 1)], seller_id: 'seller-1' }, { id: B, images: ['https://evil.example/x.jpg'] }])
    const body = await (await POST(upload(JPEG))).json()
    expect(body.exact[0].listing.own).toBe(true)
    expect(body.match).toEqual([])
    expect(body.listed).toBe(true)
  })

  it('reports listed from the hydrated tiers, not from hits hydration dropped', async () => {
    // Engine + hash both say "exact", but the listing is pending review (RPC includes it for
    // near-dup detection; search shows active only) → no card → the response must not say listed.
    rpc.mockResolvedValueOnce({ data: [{ listing_id: A, slot: 'PHOTO_1', distance: 0 }], error: null })
    engineByImage.mockResolvedValueOnce({
      listed: true, query_category: null,
      results: [{ listing_id: A, photo_index: 0, score: 0.99, tier: 'exact' }, { listing_id: B, photo_index: 0, score: 0.5, tier: 'close' }],
      counts: { exact: 1, match: 0, close: 1 }, thresholds: { exact_cos: 0.93, match_cos: 0.8 },
    })
    listingRows([{ id: A, images: [IMG(A, 1)], status: 'pending_review' }, { id: B, images: [IMG(B, 1)] }])
    const body = await (await POST(upload(JPEG))).json()
    expect(body.listed).toBe(false)
    expect(body.exact).toEqual([])
    expect(body.close.map((h: { listing_id: string }) => h.listing_id)).toEqual([B])
  })

  it('listing-photo mode uses the stored hash and excludes the source listing', async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: { hash: 'b'.repeat(64) } })
    engineByListing.mockResolvedValueOnce({
      listed: false, query_category: null,
      results: [{ listing_id: B, photo_index: 0, score: 0.5, tier: 'close' }],
      counts: { exact: 0, match: 0, close: 1 }, thresholds: { exact_cos: 0.93, match_cos: 0.8 },
    })
    listingRows([{ id: B, images: [IMG(B, 1)] }])
    const res = await POST(listingRef({ listing_id: A, photo_index: 1 }))
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.listed).toBe(false)
    expect(body.close[0].listing_id).toBe(B)
    expect(chain.eq).toHaveBeenCalledWith('slot', 'PHOTO_2')
    expect(rpc).toHaveBeenCalledWith('similar_image_hashes', expect.objectContaining({ query_hex: 'b'.repeat(64), exclude_listing: A }))
    expect(engineByListing).toHaveBeenCalledWith(A, 1, { categories: [], limit: 40 })
  })

  it('skips the hash tier when the source photo has no stored hash', async () => {
    chain.maybeSingle.mockResolvedValueOnce({ data: null })
    await POST(listingRef({ listing_id: A, photo_index: 0 }))
    expect(rpc).not.toHaveBeenCalled()
    expect(engineByListing).toHaveBeenCalled()
  })

  it('rejects a bad listing ref and malformed JSON', async () => {
    expect((await POST(listingRef({ listing_id: 'nope' }))).status).toBe(400)
    expect((await POST(listingRef({ listing_id: A, photo_index: 99 }))).status).toBe(400)
    const bad = new NextRequest('http://t/api/search/image', {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: '{not json',
    })
    expect((await POST(bad)).status).toBe(400)
  })

  it('requires sign-in when guests are disabled', async () => {
    vi.resetModules()
    vi.doMock('@/lib/visual-search/config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/visual-search/config')>()
      return { ...actual, VISUAL_SEARCH_ENABLED: true, VISUAL_SEARCH_GUESTS: false }
    })
    const { POST: post } = await import('@/app/api/search/image/route')
    const res = await post(upload(JPEG))
    expect(res.status).toBe(401)
    expect(await res.json()).toMatchObject({ code: 'auth_required' })
    vi.doUnmock('@/lib/visual-search/config')
  })

  it('is a 404 when the flag is off', async () => {
    vi.resetModules()
    vi.doMock('@/lib/visual-search/config', async (importOriginal) => {
      const actual = await importOriginal<typeof import('@/lib/visual-search/config')>()
      return { ...actual, VISUAL_SEARCH_ENABLED: false }
    })
    const { POST: post } = await import('@/app/api/search/image/route')
    expect((await post(upload(JPEG))).status).toBe(404)
    vi.doUnmock('@/lib/visual-search/config')
  })
})
