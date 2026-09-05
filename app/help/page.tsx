import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import { getViewerUsername } from '@/app/components/viewer'
import { helpFaqs } from '@/lib/content/help'
import HelpClient from './help-client'

export const metadata: Metadata = { title: 'Help & FAQ', alternates: { canonical: '/help' } }

/** /help — searchable FAQ (design "Footer pages" board). Numbers come from lib constants. */
export default async function HelpPage() {
  const username = await getViewerUsername()
  // One copy of the FAQ, shared with GET /api/content/help (native clients).
  const faqs = helpFaqs()
  return (
    <AppShell username={username} footerActive="/help">
      <HelpClient faqs={faqs} />
    </AppShell>
  )
}
