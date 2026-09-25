import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/visual-search/config', () => ({
  VISUAL_SEARCH_TIMEOUT_MS: 1000,
  visualEngine: () => ({ url: 'https://feed.example', token: 'tok' }),
}))

const { engineSearchByImage, engineSearchByListingPhoto } = await import('@/lib/visual-search/client')

const ENGINE_OK = {
  listed: false, query_category: null, results: [], counts: { exact: 0, match: 0, close: 0 },
  thresholds: { exact_cos: 0.93, match_cos: 0.8 },
}

describe('engine client — query building (P2 text + category hooks)', () => {
  const fetchMock = vi.fn()
  beforeEach(() => { fetchMock.mockReset(); vi.stubGlobal('fetch', fetchMock) })
  afterEach(() => vi.unstubAllGlobals())

  it('sends text, categories, limit and auto_category=false as query params on the raw upload', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(ENGINE_OK), { status: 200 }))
    const out = await engineSearchByImage(Buffer.from([1, 2, 3]), 'image/jpeg', {
      categories: ['Outerwear'], limit: 40, text: 'black leather', autoCategory: false,
    })
    expect(out).toMatchObject({ listed: false })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    const u = new URL(url)
    expect(u.pathname).toBe('/v1/search/image')
    expect(u.searchParams.getAll('category')).toEqual(['Outerwear'])
    expect(u.searchParams.get('limit')).toBe('40')
    expect(u.searchParams.get('text')).toBe('black leather')
    expect(u.searchParams.get('auto_category')).toBe('false')
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('image/jpeg')
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer tok')
  })

  it('omits text and auto_category when unset (engine defaults apply)', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(ENGINE_OK), { status: 200 }))
    await engineSearchByImage(Buffer.from([1]), 'image/png', { limit: 40 })
    const u = new URL(fetchMock.mock.calls[0][0] as string)
    expect(u.search).toBe('?limit=40')
  })

  it('puts text and auto_category in the listing-photo body', async () => {
    fetchMock.mockResolvedValueOnce(new Response(JSON.stringify(ENGINE_OK), { status: 200 }))
    await engineSearchByListingPhoto('00000000-0000-4000-8000-00000000000a', 2, { text: 'denim', autoCategory: true, limit: 10 })
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit]
    expect(url).toBe('https://feed.example/v1/search/image/listing')
    expect(JSON.parse(init.body as string)).toEqual({
      listing_id: '00000000-0000-4000-8000-00000000000a', photo_index: 2, categories: [], limit: 10, text: 'denim', auto_category: true,
    })
  })

  it('is fail-soft: non-2xx, bad JSON and network errors return null', async () => {
    fetchMock.mockResolvedValueOnce(new Response('nope', { status: 503 }))
    expect(await engineSearchByImage(Buffer.from([1]), 'image/jpeg')).toBeNull()
    fetchMock.mockResolvedValueOnce(new Response('{not json', { status: 200 }))
    expect(await engineSearchByImage(Buffer.from([1]), 'image/jpeg')).toBeNull()
    fetchMock.mockRejectedValueOnce(new Error('ECONNREFUSED'))
    expect(await engineSearchByImage(Buffer.from([1]), 'image/jpeg')).toBeNull()
  })
})
