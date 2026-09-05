/**
 * GET /api/me — the signed-in viewer for the app chrome: auth user, own profile (null until it
 * exists → onboarding), unread/active counts and the public flag subset. lib/loaders/viewer.
 */
import { requireUser } from '@/lib/supabase/server'
import { loadMe } from '@/lib/loaders/viewer'
import { respond } from '@/lib/api/respond'

export async function GET() {
  return respond(async () => {
    const { supabase, user } = await requireUser()
    return loadMe({ supabase, user })
  })
}
