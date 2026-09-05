import { describe, it, expect, vi, beforeEach } from 'vitest'

// next/headers is request-scoped; stub it so createClient() can be exercised in a unit test.
const headerStore = new Map<string, string>()
vi.mock('next/headers', () => ({
  headers: async () => ({ get: (k: string) => headerStore.get(k.toLowerCase()) ?? null }),
  cookies: async () => ({ getAll: () => [], set: () => {} }),
}))

const bearerFactory = vi.fn((_url: string, _key: string, opts: unknown) => ({ kind: 'bearer', opts }))
const cookieFactory = vi.fn((_url: string, _key: string, opts: unknown) => ({ kind: 'cookie', opts }))
vi.mock('@supabase/supabase-js', () => ({ createClient: (...a: unknown[]) => bearerFactory(...(a as [string, string, unknown])) }))
vi.mock('@supabase/ssr', () => ({ createServerClient: (...a: unknown[]) => cookieFactory(...(a as [string, string, unknown])) }))

import { parseBearer, createClient, requireUser, UnauthorizedError } from '@/lib/supabase/server'

const JWT = 'eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIxMjMifQ.abc-_DEF'

beforeEach(() => {
  headerStore.clear()
  bearerFactory.mockClear()
  cookieFactory.mockClear()
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://ref.supabase.co'
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'anon-key'
})

describe('parseBearer', () => {
  it('extracts a JWT from a well-formed header (case-insensitive scheme)', () => {
    expect(parseBearer(`Bearer ${JWT}`)).toBe(JWT)
    expect(parseBearer(`bearer ${JWT}`)).toBe(JWT)
    expect(parseBearer(`  Bearer   ${JWT}  `)).toBe(JWT)
  })
  it('ignores missing, empty, or non-bearer headers', () => {
    expect(parseBearer(null)).toBeNull()
    expect(parseBearer(undefined)).toBeNull()
    expect(parseBearer('')).toBeNull()
    expect(parseBearer('Basic dXNlcjpwYXNz')).toBeNull()
    expect(parseBearer('Bearer')).toBeNull()
  })
  it('rejects tokens with characters outside base64url/JWT', () => {
    expect(parseBearer('Bearer abc def')).toBeNull()
    expect(parseBearer('Bearer <script>')).toBeNull()
  })
})

describe('createClient', () => {
  it('builds an anon-key client with a global Authorization header when a bearer is present', async () => {
    headerStore.set('authorization', `Bearer ${JWT}`)
    const client = (await createClient()) as unknown as { kind: string; opts: { global: { headers: Record<string, string> }; auth: Record<string, boolean> } }
    expect(client.kind).toBe('bearer')
    expect(bearerFactory).toHaveBeenCalledTimes(1)
    const [url, key] = bearerFactory.mock.calls[0]
    expect(url).toBe('https://ref.supabase.co')
    expect(key).toBe('anon-key') // never the service key: RLS must still apply
    expect(client.opts.global.headers.Authorization).toBe(`Bearer ${JWT}`)
    expect(client.opts.auth.persistSession).toBe(false)
    expect(client.opts.auth.autoRefreshToken).toBe(false)
    expect(cookieFactory).not.toHaveBeenCalled()
  })

  it('falls back to the cookie client when there is no Authorization header', async () => {
    const client = (await createClient()) as unknown as { kind: string }
    expect(client.kind).toBe('cookie')
    expect(bearerFactory).not.toHaveBeenCalled()
  })

  it('treats a malformed Authorization header as absent', async () => {
    headerStore.set('authorization', 'Bearer not a token')
    const client = (await createClient()) as unknown as { kind: string }
    expect(client.kind).toBe('cookie')
  })
})

describe('requireUser', () => {
  it('throws UnauthorizedError (status 401) when getUser returns no user', async () => {
    headerStore.set('authorization', `Bearer ${JWT}`)
    bearerFactory.mockImplementation(() => ({
      kind: 'bearer', opts: {},
      auth: { getUser: async () => ({ data: { user: null }, error: { message: 'invalid' } }) },
    }))
    const err = await requireUser().then(() => null, (e: unknown) => e)
    expect(err).toBeInstanceOf(UnauthorizedError)
    expect((err as UnauthorizedError).status).toBe(401)
  })

  it('returns the client and user when the token validates', async () => {
    headerStore.set('authorization', `Bearer ${JWT}`)
    bearerFactory.mockImplementation(() => ({
      kind: 'bearer', opts: {},
      auth: { getUser: async () => ({ data: { user: { id: 'u1' } }, error: null }) },
    }))
    const { user } = await requireUser()
    expect(user.id).toBe('u1')
  })
})
