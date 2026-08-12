/**
 * POST /api/admin/profiles/[profileId]/moderator   Body: { is_moderator: boolean }
 * Admin: grant or revoke moderator status directly (bootstrap + revoke).
 *
 * Uses service_role to write is_moderator/moderator_since — these columns are not
 * grantable to `authenticated` (self-promotion escalation guard). Mirrors the
 * verified_checker admin route.
 */
import { NextRequest, NextResponse } from 'next/server'
import { isUuid } from '@/lib/security/uuid'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ profileId: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { profileId } = await params
  if (!isUuid(profileId)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { is_moderator?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }
  if (typeof body.is_moderator !== 'boolean') {
    return NextResponse.json({ error: 'is_moderator (boolean) required' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {
    is_moderator: body.is_moderator,
    moderator_since: body.is_moderator ? new Date().toISOString() : null,
  }

  const service = await createServiceClient()
  const { error } = await service
    .from('profiles')
    .update(updatePayload)
    .eq('id', profileId)

  if (error) {
    console.error('[admin/moderator] update error:', error)
    return NextResponse.json({ error: 'Failed to update moderator status' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
