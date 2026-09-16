import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import SellForm from '@/app/sell/sell-form'
import { PROTO_DRAFT } from '@/app/proto/account-fixtures'

export const metadata: Metadata = {
  title: 'Prototype new listing',
  robots: { index: false, follow: false },
}

interface PageProps {
  searchParams: Promise<{ draft?: string; edit?: string }>
}

/**
 * The real create-listing wizard on a fixture draft, so the tour can walk
 * 01 PHOTOS → 05 REVIEW. Photo upload and PUBLISH still go through the real
 * gated endpoints and will refuse without a session — by design.
 */
export default async function ProtoNewListingPage({ searchParams }: PageProps) {
  const { edit } = await searchParams
  return (
    <AppShell username="">
      <SellForm
        userId="proto-user"
        sellerBps={900}
        welcomeSalesRemaining={0}
        initial={PROTO_DRAFT}
        mode={edit ? 'edit' : 'new'}
      />
    </AppShell>
  )
}
