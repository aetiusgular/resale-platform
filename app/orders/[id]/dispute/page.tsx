/**
 * /orders/[id]/dispute — buyer opens a dispute: description + photo upload (≥1 required).
 */
import type { Metadata } from 'next'
import { redirect } from 'next/navigation'
import { createClient } from '@/lib/supabase/server'
import AppShell from '@/app/components/app-shell'
import DisputeForm from './dispute-form'

export const metadata: Metadata = { title: 'Report an issue' }

export default async function DisputePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')
  const { data: profile } = await supabase.from('profiles').select('username').eq('id', user.id).single()
  return (
    <AppShell username={(profile?.username as string) ?? ''}>
      <DisputeForm />
    </AppShell>
  )
}
