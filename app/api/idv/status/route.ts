/**
 * GET /api/idv/status?required=sell|payout — the viewer's identity-verification status, exactly
 * as /onboarding/verify renders it (lib/loaders/verification). Not flag-gated: the app needs the
 * `enabled` bit to decide whether to show the START VERIFICATION button.
 */
import { NextRequest } from 'next/server'
import { requireUser } from '@/lib/supabase/server'
import { loadVerificationStatus } from '@/lib/loaders/verification'
import { respond } from '@/lib/api/respond'

export async function GET(request: NextRequest) {
  return respond(async () => {
    const { supabase, user } = await requireUser()
    return loadVerificationStatus({ supabase, user, required: request.nextUrl.searchParams.get('required') })
  })
}
