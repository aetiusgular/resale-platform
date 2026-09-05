import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import { NOTIFICATIONS_ENABLED, SHIPPING_LABELS_ENABLED } from '@/lib/flags'
import AppShell from '@/app/components/app-shell'
import { getViewer } from '@/app/components/viewer'
import NotificationsPage from './notifications-page'

export const metadata: Metadata = { title: 'Notifications' }

/**
 * /notifications — the notifications list as a page (mobile-web handoff 27). On
 * desktop the same list lives in the header popout; the account popout links here
 * at the mobile breakpoint instead of opening the panel.
 */
export default async function NotificationsRoute() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')
  const viewer = await getViewer()
  return (
    <AppShell username={viewer.username} displayName={viewer.displayName ?? undefined}>
      <NotificationsPage enabled={NOTIFICATIONS_ENABLED} shippingLabelsEnabled={SHIPPING_LABELS_ENABLED} />
    </AppShell>
  )
}
