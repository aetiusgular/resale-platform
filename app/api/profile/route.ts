/**
 * POST /api/profile — create the viewer's profile row if it does not exist (idempotent).
 * The web signup does this client-side (app/enter/signup-form#createProfileForUser); native
 * clients do it here after their first sign-in. Same derivation (lib/auth/username), same RLS:
 * the insert runs as the caller, so role/verification columns are pinned by migration 0043.
 * Returns the viewer bundle (GET /api/me) with 201 when created, 200 when it already existed.
 */
import { NextResponse } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { randomSuffix, usernameFromEmail } from '@/lib/auth/username'
import { loadMe } from '@/lib/loaders/viewer'
import { ApiError, enforceRateLimit, respond } from '@/lib/api/respond'

export async function POST() {
  return respond(async () => {
    const { supabase, user } = await requireUser()
    await enforceRateLimit(`profile_create:${user.id}`, 5, 60_000)
    const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle()
    if (existing) return NextResponse.json(await loadMe({ supabase, user }), { status: 200 })

    const email = user.email ?? ''
    let created = false
    for (let attempt = 0; attempt < 4 && !created; attempt++) {
      const username = usernameFromEmail(email, attempt === 0 ? undefined : randomSuffix())
      const { error } = await supabase.from('profiles').insert({ id: user.id, username })
      if (!error) { created = true; break }
      if (error.code === '23505' && error.message.includes('username')) continue
      if (error.code === '23505') { created = true; break } // row raced into existence
      console.error('[profile] insert failed:', error)
      throw new ApiError(500, 'Could not create profile')
    }
    if (!created) throw new ApiError(409, 'Could not pick a username — try again.', 'username_collision')
    return NextResponse.json(await loadMe({ supabase, user }), { status: 201 })
  })
}
