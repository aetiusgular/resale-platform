/**
 * POST /api/conversations/[id]/report { reason? } — REPORT from the thread bar.
 * Writes a `reports` row (RLS: reporter = caller; one per target) that the
 * moderation console lists. Never blocks the thread.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { reason?: unknown } = {}
  try { body = await request.json() } catch { /* reason optional */ }
  const reason = typeof body.reason === 'string' ? body.reason.trim().slice(0, 500) : ''

  // Only a participant can report the conversation (RLS on conversations proves membership).
  const { data: conv } = await supabase.from('conversations').select('id').eq('id', id).maybeSingle()
  if (!conv) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase.from('reports').insert({ reporter_id: user.id, target_type: 'conversation', target_id: id, reason })
  if (error) {
    if (error.code === '23505') return NextResponse.json({ ok: true, duplicate: true })
    console.error('[conversations/:id/report] insert error:', error)
    return NextResponse.json({ error: 'Could not send report' }, { status: 500 })
  }
  return NextResponse.json({ ok: true }, { status: 201 })
}
