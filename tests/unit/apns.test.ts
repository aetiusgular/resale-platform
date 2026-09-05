import { describe, it, expect } from 'vitest'
import { generateKeyPairSync, createVerify } from 'node:crypto'
import { signProviderToken, buildApnsBody } from '@/lib/notify/apns'

describe('APNs provider token (ES256 JWT)', () => {
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' })

  it('produces header.claims.signature with alg ES256, kid, iss and iat', () => {
    const jwt = signProviderToken({ keyId: 'ABC123DEFG', teamId: 'TEAM123456', key: privateKey }, 1_700_000_000)
    const [h, c, s] = jwt.split('.')
    expect(h && c && s).toBeTruthy()
    const header = JSON.parse(Buffer.from(h, 'base64url').toString())
    const claims = JSON.parse(Buffer.from(c, 'base64url').toString())
    expect(header).toEqual({ alg: 'ES256', kid: 'ABC123DEFG' })
    expect(claims).toEqual({ iss: 'TEAM123456', iat: 1_700_000_000 })
  })

  it('signs with the raw r||s (ieee-p1363) encoding JOSE requires, verifiable with the public key', () => {
    const jwt = signProviderToken({ keyId: 'K', teamId: 'T', key: privateKey }, 1_700_000_000)
    const [h, c, s] = jwt.split('.')
    const sig = Buffer.from(s, 'base64url')
    expect(sig.length).toBe(64) // P-256: 32-byte r + 32-byte s, never DER
    const ok = createVerify('SHA256').update(`${h}.${c}`).verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, sig)
    expect(ok).toBe(true)
  })
})

describe('buildApnsBody', () => {
  it('nests alert/sound/badge under aps and carries the deep-link url at the top level', () => {
    const body = JSON.parse(buildApnsBody({ title: 'New offer — $340', body: 'RAF SIMONS · FROM @WOVENPAST', url: '/messages/abc', badge: 3 }))
    expect(body).toEqual({ aps: { alert: { title: 'New offer — $340', body: 'RAF SIMONS · FROM @WOVENPAST' }, sound: 'default', badge: 3 }, url: '/messages/abc' })
  })
  it('omits badge when not provided and keeps url null when there is no target', () => {
    const body = JSON.parse(buildApnsBody({ title: 't', body: 'b', url: null }))
    expect(body.aps.badge).toBeUndefined()
    expect(body.url).toBeNull()
  })
})
