import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import CodesClient from './codes-client'

export default async function CodesPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) redirect('/enter')

  const { data: codes } = await supabase
    .from('invite_codes')
    .select('code, status, used_by, profiles!invite_codes_used_by_fkey(username)')
    .eq('generated_by', user.id)
    .order('created_at', { ascending: true })

  return <CodesClient codes={codes ?? []} />
}
