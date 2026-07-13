/**
 * POST /api/admin/profiles/[profileId]/checker
 * Admin: grant or revoke verified_checker status + set category.
 * Body: { verified_checker: boolean, checker_category?: string }
 *
 * Uses service_role to bypass the no-grant-to-authenticated restriction on
 * verified_checker/checker_category/tier columns.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

interface RouteContext {
  params: Promise<{ profileId: string }>
}

export async function POST(req: NextRequest, { params }: RouteContext) {
  const { profileId } = await params
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()
  if (profile?.role !== 'admin') return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  let body: { verified_checker?: unknown; checker_category?: unknown }
  try { body = await req.json() } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  if (typeof body.verified_checker !== 'boolean') {
    return NextResponse.json({ error: 'verified_checker (boolean) required' }, { status: 400 })
  }

  const updatePayload: Record<string, unknown> = {
    verified_checker: body.verified_checker,
  }
  if (typeof body.checker_category === 'string') {
    updatePayload.checker_category = body.verified_checker ? body.checker_category : null
  } else if (!body.verified_checker) {
    updatePayload.checker_category = null  // clear category when revoking
  }

  // Use service_role — these columns are not grantable to authenticated (escalation risk)
  const service = await createServiceClient()
  const { error } = await service
    .from('profiles')
    .update(updatePayload)
    .eq('id', profileId)

  if (error) {
    console.error('[admin/checker] update error:', error)
    return NextResponse.json({ error: 'Failed to update checker status' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
