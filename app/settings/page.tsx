import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import SiteHeader from '@/app/components/site-header'
import MobileTabBar from '@/app/components/mobile-tabbar'
import SettingsClient from './settings-client'
import { NOTIFICATIONS_ENABLED, PHONE_VERIFICATION_ENABLED, TIER_DASHBOARD_ENABLED } from '@/lib/flags'
import { createServiceClientRaw } from '@/lib/supabase/service'
import { getTierDashboard, type SideDashboard } from '@/lib/tier-dashboard'

export default async function SettingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, sizes, payouts_enabled, stripe_connect_account_id, phone, phone_verified_at')
    .eq('id', user.id)
    .single()

  const username: string = (profile?.username as string) ?? ''
  const sizes = (profile?.sizes as Record<string, string[]>) ?? {}
  const payoutsEnabled: boolean = (profile?.payouts_enabled as boolean) ?? false
  const stripeConnectId: string | null = (profile?.stripe_connect_account_id as string) ?? null
  const initialPhone: string | null = (profile?.phone as string) ?? null
  const phoneVerified: boolean = Boolean(profile?.phone_verified_at)

  let buyerTier: SideDashboard | null = null
  let sellerTier: SideDashboard | null = null
  if (TIER_DASHBOARD_ENABLED) {
    const svc = createServiceClientRaw()
    ;[buyerTier, sellerTier] = await Promise.all([
      getTierDashboard(svc, user.id, 'buyer'),
      getTierDashboard(svc, user.id, 'seller'),
    ])
  }

  const { data: prefsRow } = await supabase
    .from('notification_prefs')
    .select('email_offers, push_offers, email_orders, push_orders, email_messages, push_messages')
    .eq('user_id', user.id)
    .maybeSingle()
  const initialPrefs = {
    email_offers: prefsRow?.email_offers ?? true,
    push_offers: prefsRow?.push_offers ?? true,
    email_orders: prefsRow?.email_orders ?? true,
    push_orders: prefsRow?.push_orders ?? true,
    email_messages: prefsRow?.email_messages ?? true,
    push_messages: prefsRow?.push_messages ?? true,
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--color-bg)' }} className="mobile-bottom-pad">
      <SiteHeader username={username} />
      <Suspense>
        <SettingsClient
          username={username}
          initialSizes={sizes}
          payoutsEnabled={payoutsEnabled}
          stripeConnectId={stripeConnectId}
          initialPrefs={initialPrefs}
          notificationsEnabled={NOTIFICATIONS_ENABLED}
          phoneVerificationEnabled={PHONE_VERIFICATION_ENABLED}
          phoneVerified={phoneVerified}
          initialPhone={initialPhone}
          tierDashboardEnabled={TIER_DASHBOARD_ENABLED}
          buyerTier={buyerTier}
          sellerTier={sellerTier}
        />
      </Suspense>
      <MobileTabBar username={username} />
    </div>
  )
}
