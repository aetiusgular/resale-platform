/**
 * True when this process cannot talk to Supabase.
 * Treats missing, blank, and whitespace-only credentials as offline so
 * browse/PDP never call createClient() with undefined and 500.
 */
export function isOfflinePreview(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ?? ''
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? ''
  return !url || !key
}
