/**
 * /api/idv/start — send the signed-in user into Stripe Identity's hosted verification flow.
 * Behind VERIFICATION_ENABLED. metadata.user_id ties the resulting VerificationSession back to
 * us; the signed identity.verification_session.verified webhook (handled in the shared Stripe
 * webhook) is what actually marks them verified.
 *
 *   GET  — web: 302 to the hosted flow; returns to /onboarding/verify?submitted=1.
 *   POST — native clients: `{ url }`; Stripe requires an https return URL, so it comes back to
 *          /api/idv/return?client=ios which 302s into the `archive://` scheme.
 */
import { NextRequest, NextResponse } from 'next/server'
import { createClient, requireUser } from '@/lib/supabase/server'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { createIdentitySession } from '@/lib/idv/stripe-identity'
import { ApiError, enforceRateLimit, respond } from '@/lib/api/respond'

const appBase = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

async function startSession(userId: string, returnUrl: string): Promise<{ url: string; id: string } | null> {
  let session: { url: string; id: string } | null = null
  try {
    session = await createIdentitySession(userId, returnUrl)
  } catch (e) {
    console.error('[idv] Stripe Identity session create failed:', e)
  }
  if (!session) return null
  // Mark them pending so the UI reflects "in progress" until the webhook resolves it.
  try {
    await createServiceClientRaw().from('profiles').update({ id_verification_status: 'pending' }).eq('id', userId)
  } catch { /* non-fatal: the flow still starts */ }
  return session
}

export async function GET() {
  if (!VERIFICATION_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/enter', appBase()))

  const session = await startSession(user.id, `${appBase()}/onboarding/verify?submitted=1`)
  if (!session) return NextResponse.redirect(new URL('/onboarding/verify?error=unconfigured', appBase()))
  return NextResponse.redirect(session.url)
}

export async function POST(_request: NextRequest) {
  return respond(async () => {
    if (!VERIFICATION_ENABLED) throw new ApiError(404, 'Not found')
    const { user } = await requireUser()
    await enforceRateLimit(`idv_start:${user.id}`, 5, 60_000)
    const session = await startSession(user.id, `${appBase()}/api/idv/return?client=ios&submitted=1`)
    if (!session) throw new ApiError(503, 'Identity verification is not configured.', 'unconfigured')
    return { url: session.url, session_id: session.id }
  })
}
