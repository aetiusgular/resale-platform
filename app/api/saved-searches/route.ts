import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// POST /api/saved-searches { query: Record<string, string> }
// Persists a saved search for the current user (notifications are PA).

export async function POST(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { query } = body
  if (typeof query !== 'object' || query === null || Array.isArray(query)) {
    return NextResponse.json({ error: 'query must be a JSON object' }, { status: 400 })
  }

  // Size cap: max 20 keys, max 200 chars per value
  const entries = Object.entries(query)
  if (entries.length > 20) {
    return NextResponse.json({ error: 'query may not have more than 20 keys' }, { status: 400 })
  }

  // Validate only string values (no PII, no nested objects)
  for (const [k, v] of entries) {
    if (typeof v !== 'string') {
      return NextResponse.json({ error: `query.${k} must be a string` }, { status: 400 })
    }
    if (v.length > 200) {
      return NextResponse.json({ error: `query.${k} exceeds max length (200 chars)` }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('saved_searches')
    .insert({ user_id: user.id, query })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: true })
}
