/**
 * GET /api/sellers/[username] — public seller profile, the same assembly as /sellers/[username]
 * (lib/loaders/seller). Guests get the public view; members also get follow/moderator state.
 */
import { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { loadSellerProfile } from '@/lib/loaders/seller'
import { ApiError, respond } from '@/lib/api/respond'

interface Ctx { params: Promise<{ username: string }> }

export async function GET(_request: NextRequest, { params }: Ctx) {
  return respond(async () => {
    const { username } = await params
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const profile = await loadSellerProfile({ supabase, user, username })
    if (!profile) throw new ApiError(404, 'Not found')
    return profile
  })
}
