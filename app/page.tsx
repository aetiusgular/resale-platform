import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'

// Authenticated home → /browse
export default async function HomePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')
  redirect('/browse')
}
