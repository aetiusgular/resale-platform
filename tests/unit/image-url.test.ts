import { describe, it, expect, afterEach } from 'vitest'
import { isAllowedImageUrl, allImageUrlsAllowed, storageHost } from '../../lib/security/image-url'

const HOST = 'abc.supabase.co'

describe('isAllowedImageUrl', () => {
  it('allows HTTPS on the configured host', () => {
    expect(isAllowedImageUrl(`https://${HOST}/storage/v1/object/public/listings/a.jpg`, HOST)).toBe(true)
  })
  it('rejects http (non-TLS)', () => {
    expect(isAllowedImageUrl(`http://${HOST}/a.jpg`, HOST)).toBe(false)
  })
  it('rejects a different host', () => {
    expect(isAllowedImageUrl('https://evil.example.com/a.jpg', HOST)).toBe(false)
  })
  it('rejects internal / metadata targets', () => {
    expect(isAllowedImageUrl('http://169.254.169.254/latest/meta-data/', HOST)).toBe(false)
    expect(isAllowedImageUrl('https://10.0.0.5/x', HOST)).toBe(false)
  })
  it('rejects garbage and empty allowedHost', () => {
    expect(isAllowedImageUrl('not a url', HOST)).toBe(false)
    expect(isAllowedImageUrl(`https://${HOST}/a.jpg`, '')).toBe(false)
  })
})

describe('allImageUrlsAllowed', () => {
  it('skips empty slots and passes when all real URLs are on-host', () => {
    expect(allImageUrlsAllowed([`https://${HOST}/a.jpg`, '', '  ', `https://${HOST}/b.jpg`], HOST)).toBe(true)
  })
  it('fails if any URL is off-host', () => {
    expect(allImageUrlsAllowed([`https://${HOST}/a.jpg`, 'https://evil.com/x.jpg'], HOST)).toBe(false)
  })
  it('empty list is vacuously allowed', () => {
    expect(allImageUrlsAllowed([], HOST)).toBe(true)
  })
})

describe('storageHost', () => {
  const saved = process.env.NEXT_PUBLIC_SUPABASE_URL
  afterEach(() => { process.env.NEXT_PUBLIC_SUPABASE_URL = saved })
  it('extracts the hostname from the env URL', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://xyz.supabase.co'
    expect(storageHost()).toBe('xyz.supabase.co')
  })
  it('returns empty string when unset/garbage', () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = ''
    expect(storageHost()).toBe('')
  })
})
