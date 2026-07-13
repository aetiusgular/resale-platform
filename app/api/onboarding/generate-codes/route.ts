import { NextResponse } from 'next/server'
import { createClient, createServiceClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = await createClient()

  // getUser() — never getSession() for authz
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError || !user) {
    return NextResponse.json({ error: 'unauthenticated' }, { status: 401 })
  }

  // Check if user already has codes
  const { data: existing } = await supabase
    .from('invite_codes')
    .select('code')
    .eq('generated_by', user.id)
    .limit(1)

  if (existing && existing.length > 0) {
    // Already generated — idempotent
    return NextResponse.json({ ok: true, generated: false })
  }

  // Generate 3 codes using service role (bypasses RLS)
  const service = await createServiceClient()
  const { data, error } = await service.rpc('generate_member_codes', {
    p_user_id: user.id,
    p_count: 3,
  })

  if (error) {
    console.error('[generate_member_codes]', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true, generated: true, codes: data })
}
