// APNs adapter — SERVER ONLY. Sends alert pushes to the iOS app over HTTP/2 with token-based
// (JWT / ES256) provider authentication. No dependency: Node 22 `http2` + `crypto`.
//
// Env (all server-side): APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY (the .p8 contents; literal
// "\n" sequences are accepted), APNS_BUNDLE_ID (defaults to supply.archive.ios),
// APNS_ENV = sandbox | production (defaults to sandbox outside production).
// Fail-soft: unconfigured → no-op `false`; transport/HTTP errors are logged, never thrown.
import http2 from 'node:http2'
import { createPrivateKey, createSign, type KeyObject } from 'node:crypto'

export type ApnsPayload = {
  title: string
  body: string
  /** Deep link the app resolves (same paths as the web: /messages/{id}, /listings/{id}, …). */
  url: string | null
  badge?: number
  /** Collapses duplicate alerts on the device (e.g. one per conversation). */
  collapseId?: string
}

export type ApnsResult =
  | { ok: true; apnsId: string | null }
  | { ok: false; status: number | null; reason: string; /** The token is dead — delete the device row. */ unregistered: boolean }

type ApnsConfig = { keyId: string; teamId: string; key: KeyObject; bundleId: string; host: string }

let cachedConfig: ApnsConfig | null | undefined
let cachedToken: { jwt: string; issuedAt: number } | null = null

/** Apple: reuse a provider token for up to 60 minutes; refresh no more than once every 20. */
const TOKEN_TTL_MS = 50 * 60 * 1000

export function apnsConfigured(): boolean {
  return getConfig() !== null
}

function getConfig(): ApnsConfig | null {
  if (cachedConfig !== undefined) return cachedConfig
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  const pem = process.env.APNS_PRIVATE_KEY?.replace(/\\n/g, '\n')
  if (!keyId || !teamId || !pem) { cachedConfig = null; return null }
  try {
    const key = createPrivateKey(pem)
    const env = process.env.APNS_ENV ?? (process.env.NODE_ENV === 'production' ? 'production' : 'sandbox')
    cachedConfig = {
      keyId,
      teamId,
      key,
      bundleId: process.env.APNS_BUNDLE_ID ?? 'supply.archive.ios',
      host: env === 'production' ? 'https://api.push.apple.com' : 'https://api.sandbox.push.apple.com',
    }
  } catch (e) {
    console.warn('[notify/apns] invalid APNS_PRIVATE_KEY:', (e as Error).message)
    cachedConfig = null
  }
  return cachedConfig
}

const b64url = (input: Buffer | string) => Buffer.from(input).toString('base64url')

/** ES256 JWT: header {alg, kid}, claims {iss, iat}. Exported for tests. */
export function signProviderToken(cfg: { keyId: string; teamId: string; key: KeyObject }, issuedAtSec: number): string {
  const header = b64url(JSON.stringify({ alg: 'ES256', kid: cfg.keyId }))
  const claims = b64url(JSON.stringify({ iss: cfg.teamId, iat: issuedAtSec }))
  const signingInput = `${header}.${claims}`
  // JOSE wants the raw r||s signature, not DER.
  const sig = createSign('SHA256').update(signingInput).sign({ key: cfg.key, dsaEncoding: 'ieee-p1363' })
  return `${signingInput}.${b64url(sig)}`
}

function providerToken(cfg: ApnsConfig): string {
  const now = Date.now()
  if (cachedToken && now - cachedToken.issuedAt < TOKEN_TTL_MS) return cachedToken.jwt
  const jwt = signProviderToken(cfg, Math.floor(now / 1000))
  cachedToken = { jwt, issuedAt: now }
  return jwt
}

/** The body APNs delivers. Exported so the app and tests agree on the shape. */
export function buildApnsBody(p: ApnsPayload): string {
  const aps: Record<string, unknown> = { alert: { title: p.title, body: p.body }, sound: 'default' }
  if (typeof p.badge === 'number') aps.badge = p.badge
  return JSON.stringify({ aps, url: p.url })
}

/** One request per call: serverless-friendly (no long-lived HTTP/2 session to keep warm). */
export async function sendApns(deviceToken: string, payload: ApnsPayload): Promise<ApnsResult | null> {
  const cfg = getConfig()
  if (!cfg) return null
  if (!/^[0-9a-f]{32,}$/i.test(deviceToken)) {
    return { ok: false, status: null, reason: 'BadDeviceToken', unregistered: true }
  }

  return new Promise<ApnsResult>((resolve) => {
    let settled = false
    const done = (r: ApnsResult) => { if (!settled) { settled = true; resolve(r) } }
    const session = http2.connect(cfg.host)
    const timer = setTimeout(() => { done({ ok: false, status: null, reason: 'Timeout', unregistered: false }); session.destroy() }, 10_000)
    session.on('error', (e) => { clearTimeout(timer); done({ ok: false, status: null, reason: `Transport: ${e.message}`, unregistered: false }) })

    const headers: Record<string, string> = {
      ':method': 'POST',
      ':path': `/3/device/${deviceToken}`,
      'authorization': `bearer ${providerToken(cfg)}`,
      'apns-topic': cfg.bundleId,
      'apns-push-type': 'alert',
      'apns-priority': '10',
      'apns-expiration': '0',
      'content-type': 'application/json',
    }
    if (payload.collapseId) headers['apns-collapse-id'] = payload.collapseId.slice(0, 64)

    const req = session.request(headers)
    let status: number | null = null
    let apnsId: string | null = null
    const chunks: Buffer[] = []
    req.on('response', (h) => {
      status = typeof h[':status'] === 'number' ? h[':status'] : Number(h[':status']) || null
      apnsId = (h['apns-id'] as string | undefined) ?? null
    })
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      clearTimeout(timer)
      session.close()
      if (status === 200) return done({ ok: true, apnsId })
      let reason = 'Unknown'
      try { reason = (JSON.parse(Buffer.concat(chunks).toString('utf8')) as { reason?: string }).reason ?? reason } catch { /* non-JSON body */ }
      const unregistered = status === 410 || reason === 'BadDeviceToken' || reason === 'Unregistered' || reason === 'DeviceTokenNotForTopic'
      if (status === 403 && (reason === 'ExpiredProviderToken' || reason === 'InvalidProviderToken')) cachedToken = null
      done({ ok: false, status, reason, unregistered })
    })
    req.on('error', (e) => { clearTimeout(timer); session.destroy(); done({ ok: false, status: null, reason: `Request: ${e.message}`, unregistered: false }) })
    req.end(buildApnsBody(payload))
  })
}
