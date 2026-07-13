import { NextRequest, NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const body = await request.json()
  const { reason } = body

  if (typeof reason !== 'string' || !reason.trim()) {
    return NextResponse.json({ error: 'rejection reason required' }, { status: 400 })
  }

  const { id } = await params

  const service = await createServiceClient()
  const { error } = await service
    .from('listings')
    .update({
      status: 'removed',
      rejection_reason: reason.trim(),
    })
    .eq('id', id)
    .eq('status', 'pending_review')

  if (error) {
    console.error('[admin/reject] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
