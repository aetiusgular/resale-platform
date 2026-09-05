/**
 * POST   /api/notifications/devices { platform:'ios'|'android', token, app_build?, locale? }
 *        — register (or re-point) a native push device token for the caller.
 * DELETE /api/notifications/devices { token? } — remove one token, or all of the caller's devices.
 * Behind NOTIFICATIONS_ENABLED like the web-push route. Writes go through the service client
 * after requireUser(): a token is UNIQUE per platform and a sign-in on a shared device must be
 * able to take it over from the previous user, which owner-scoped RLS would refuse.
 */
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { NOTIFICATIONS_ENABLED } from '@/lib/flags'
import { ApiError, enforceRateLimit, respond } from '@/lib/api/respond'

const PLATFORMS = new Set(['ios', 'android'])
// APNs tokens are 64 hex chars; FCM registration tokens run ~150–200. 512 leaves headroom and stays index-safe.
const TOKEN_RE = /^[A-Za-z0-9:_\-.]{16,512}$/

async function readJson<T>(req: NextRequest): Promise<T> {
  try { return (await req.json()) as T } catch { throw new ApiError(400, 'Invalid JSON') }
}

export async function POST(req: NextRequest) {
  return respond(async () => {
    if (!NOTIFICATIONS_ENABLED) throw new ApiError(404, 'Not found')
    const { user } = await requireUser()
    await enforceRateLimit(`push_device:${user.id}`, 30, 60_000)
    const body = await readJson<{ platform?: unknown; token?: unknown; app_build?: unknown; locale?: unknown }>(req)
    const platform = typeof body.platform === 'string' ? body.platform.toLowerCase() : ''
    const token = typeof body.token === 'string' ? body.token.trim() : ''
    if (!PLATFORMS.has(platform)) throw new ApiError(400, "platform must be 'ios' or 'android'")
    if (!TOKEN_RE.test(token)) throw new ApiError(400, 'token: 16–512 token characters required')
    const appBuild = typeof body.app_build === 'string' ? body.app_build.slice(0, 32) : null
    const locale = typeof body.locale === 'string' ? body.locale.slice(0, 16) : null

    const service = createServiceClientRaw()
    const { error } = await service
      .from('push_devices')
      .upsert(
        { user_id: user.id, platform, token, app_build: appBuild, locale, last_seen_at: new Date().toISOString() },
        { onConflict: 'platform,token' },
      )
    if (error) {
      console.error('[notifications/devices] upsert error:', error)
      throw new ApiError(500, 'Failed to register device')
    }
    return { ok: true }
  })
}

export async function DELETE(req: NextRequest) {
  return respond(async () => {
    if (!NOTIFICATIONS_ENABLED) throw new ApiError(404, 'Not found')
    const { user } = await requireUser()
    let token: string | null = null
    try {
      const body = (await req.json()) as { token?: unknown }
      if (body.token !== undefined) {
        // A token that is present but malformed is a client bug, not a request to wipe every device.
        if (typeof body.token !== 'string' || !TOKEN_RE.test(body.token.trim())) throw new ApiError(400, 'token: 16–512 token characters required')
        token = body.token.trim()
      }
    } catch (e) {
      if (e instanceof ApiError) throw e
      /* no body → remove all of the caller's devices */
    }

    const service = createServiceClientRaw()
    let q = service.from('push_devices').delete().eq('user_id', user.id)
    if (token) q = q.eq('token', token)
    const { error } = await q
    if (error) {
      console.error('[notifications/devices] delete error:', error)
      throw new ApiError(500, 'Failed to remove device')
    }
    return { ok: true }
  })
}
