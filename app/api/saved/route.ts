/**
 * GET /api/saved — the Saved hub (items · searches · sellers), same assembly as /saved
 * (lib/loaders/saved). Mutations stay on /api/saves, /api/saved-searches, /api/follows.
 */
import { requireUser } from '@/lib/supabase/server'
import { loadSavedHub } from '@/lib/loaders/saved'
import { respond } from '@/lib/api/respond'

export async function GET() {
  return respond(async () => {
    const { supabase, user } = await requireUser()
    return loadSavedHub({ supabase, user })
  })
}
