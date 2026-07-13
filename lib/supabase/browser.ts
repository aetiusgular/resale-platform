import { createBrowserClient } from '@supabase/ssr'

// Returns a typed SupabaseClient. The Database generic can't be threaded through
// @supabase/ssr with moduleResolution:"bundler" (dist path issue). Use the
// Tables<>/Enums<> helpers from ./types for explicit type assertions at call sites.
export function createClient() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createBrowserClient<any>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  )
}
