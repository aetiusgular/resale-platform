import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/app/components/site-header'
import MobileTabBar from '@/app/components/mobile-tabbar'
import SettingsClient from './settings-client'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, sizes, payouts_enabled, stripe_connect_account_id')
    .eq('id', user.id)
    .single()

  const username: string = (profile?.username as string) ?? ''
  const sizes = (profile?.sizes as Record<string, string[]>) ?? {}
  const payoutsEnabled: boolean = (profile?.payouts_enabled as boolean) ?? false
  const stripeConnectId: string | null = (profile?.stripe_connect_account_id as string) ?? null

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} className="mobile-bottom-pad">
      <SiteHeader username={username} />
      <Suspense>
        <SettingsClient
          username={username}
          initialSizes={sizes}
          payoutsEnabled={payoutsEnabled}
          stripeConnectId={stripeConnectId}
        />
      </Suspense>
      <MobileTabBar username={username} />
    </div>
  )
}
