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

  // Validate only string values (no PII, no nested objects)
  for (const [k, v] of Object.entries(query)) {
    if (typeof v !== 'string') {
      return NextResponse.json({ error: `query.${k} must be a string` }, { status: 400 })
    }
  }

  const { error } = await supabase
    .from('saved_searches')
    .insert({ user_id: user.id, query })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ saved: true })
}
