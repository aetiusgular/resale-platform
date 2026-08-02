/**
 * GET /api/idv/start — send the signed-in user into Persona's hosted ID-verification flow.
 * Behind VERIFICATION_ENABLED. reference-id = user.id ties the resulting inquiry back to us;
 * the signed webhook (/api/webhooks/persona) is what actually marks them verified.
 */
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { VERIFICATION_ENABLED } from '@/lib/flags'
import { personaHostedUrl } from '@/lib/idv/persona'

const appBase = () => process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'

export async function GET() {
  if (!VERIFICATION_ENABLED) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.redirect(new URL('/enter', appBase()))

  const url = personaHostedUrl(user.id)
  if (!url) return NextResponse.redirect(new URL('/onboarding/verify?error=unconfigured', appBase()))
  // Mark them pending so the UI reflects "in progress" until the webhook resolves it.
  const { createServiceClientRaw } = await import('@/lib/supabase/service')
  try {
    await createServiceClientRaw().from('profiles').update({ id_verification_status: 'pending' }).eq('id', user.id)
  } catch { /* non-fatal: the flow still starts */ }
  return NextResponse.redirect(url)
}
