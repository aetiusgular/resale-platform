/**
 * GET /api/idv/start — send the signed-in user into Stripe Identity's hosted verification
 * flow. Behind VERIFICATION_ENABLED. metadata.user_id ties the resulting VerificationSession
 * back to us; the signed identity.verification_session.verified webhook (handled in the shared
 * Stripe webhook) is what actually marks them verified.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { createIdentitySession } from '@/lib/idv/stripe-identity'

const appBase = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET() {
  if (!VERIFICATION_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/enter', appBase()))

  const returnUrl = `${appBase()}/onboarding/verify?submitted=1`
  let session: { url: string; id: string } | null = null
  try {
    session = await createIdentitySession(user.id, returnUrl)
  } catch (e) {
    console.error('[idv] Stripe Identity session create failed:', e)
  }
  if (!session) return NextResponse.redirect(new URL('/onboarding/verify?error=unconfigured', appBase()))

  // Mark them pending so the UI reflects "in progress" until the webhook resolves it.
  const { createServiceClientRaw } = await import('@/lib/supabase/service')
  try {
    await createServiceClientRaw().from('profiles').update({ id_verification_status: 'pending' }).eq('id', user.id)
  } catch { /* non-fatal: the flow still starts */ }
  return NextResponse.redirect(session.url)
}
