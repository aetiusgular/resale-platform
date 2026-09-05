/**
 * POST /api/listings/[id]/view — count a listing view (sell catalog: "214 VIEWS").
 * Public; the page calls it once per session per listing. bump_listing_view() is
 * SECURITY DEFINER and only touches active/sold rows.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limit'

interface Ctx { params: Promise<{ id: string }> }

export async function POST(request: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ error: 'Invalid id' }, { status: 400 })
  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon'
  const rl = await checkRateLimit(`listing_view:${ip}:${id}`, 3, 60 * 60 * 1000)
  if (!rl.allowed) return NextResponse.json({ ok: true, counted: false })
  const supabase = await createClient()
  const { error } = await supabase.rpc('bump_listing_view', { p_listing_id: id })
  if (error) return NextResponse.json({ ok: true, counted: false })
  return NextResponse.json({ ok: true, counted: true })
}
