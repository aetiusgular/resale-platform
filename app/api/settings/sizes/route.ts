import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_CATEGORIES = ['tops', 'bottoms', 'footwear'] as const

export async function PUT(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const raw = body?.sizes
  if (!raw || typeof raw !== 'object') {
    return NextResponse.json({ error: 'Invalid sizes' }, { status: 400 })
  }

  // Validate: only known categories, values must be string arrays
  const cleaned: Record<string, string[]> = {}
  for (const cat of VALID_CATEGORIES) {
    if (Array.isArray(raw[cat])) {
      cleaned[cat] = raw[cat].filter((v: unknown) => typeof v === 'string').slice(0, 20)
    }
  }

  const { error } = await supabase
    .from('profiles')
    .update({ sizes: cleaned })
    .eq('id', user.id)

  if (error) {
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
