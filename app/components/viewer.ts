import { cache } from 'react'
import { createClient } from '@/lib/supabase/server'

export type Viewer = { username: string; displayName: string | null; avatarUrl: string | null }

/**
 * The signed-in viewer's display identity (username, display name, avatar) —
 * '' username for guests. Memoised per request with React cache() so the
 * header can resolve the display name once even when the page already fetched
 * the username itself. Authorization decisions never use this — see CLAUDE.md.
 */
export const getViewer = cache(async (): Promise<Viewer> => {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { username: '', displayName: null, avatarUrl: null }
  const { data } = await supabase.from('profiles').select('username, display_name, avatar_url').eq('id', user.id).single()
  return {
    username: (data?.username as string) ?? '',
    displayName: (data?.display_name as string | null) ?? null,
    avatarUrl: (data?.avatar_url as string | null) ?? null,
  }
})

/** Username of the signed-in viewer, '' for guests (public pages that only need the header). */
export async function getViewerUsername(): Promise<string> {
  return (await getViewer()).username
}
