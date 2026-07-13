/**
 * Raw Supabase service-role client — no cookies, no session management.
 * Use this in webhook handlers, cron routes, and any context without
 * an HTTP request (e.g. background jobs).
 *
 * For route handlers that DO have a request context, createServiceClient()
 * from ./server is fine. This module avoids the next/headers import entirely.
 */
import { createClient } from '@supabase/supabase-js'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function createServiceClientRaw(): ReturnType<typeof createClient<any>> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is not set')
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false } },
  )
}
