/**
 * POST /api/saves/visit — stamp profiles.saved_visited_at = now(). The Saved page
 * note ("2 PRICE DROPS · 1 SOLD SINCE LAST VISIT") compares against the previous
 * stamp, then the page calls this so the next visit starts a fresh window.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await supabase.from('profiles').update({ saved_visited_at: new Date().toISOString() }).eq('id', user.id)
  if (error) return NextResponse.json({ error: 'Could not update' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
