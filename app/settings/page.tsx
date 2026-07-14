import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/app/components/site-header'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles').select('*').eq('id', user.id).single()
  const username: string = (profile?.username as string) ?? ''

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }}>
      <SiteHeader username={username} />
      <div style={{ display: 'flex', paddingTop: '64px' }}>
        <SettingsClient username={username} userProfile={profile ?? {}} />
      </div>
    </div>
  )
}
