import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import AppShell from '@/app/components/app-shell'
import { getProtoListing } from '@/app/proto/fixtures'
import ProtoPdp from '@/app/proto/proto-pdp'

interface PageProps {
  params: Promise<{ id: string }>
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params
  const listing = getProtoListing(id)
  if (!listing) return { title: 'Listing not found', robots: { index: false, follow: false } }
  return {
    title: `${listing.title} — ${listing.brand} — ${listing.price_display}`,
    robots: { index: false, follow: false },
  }
}

export default async function StyleguideProtoListingPage({ params }: PageProps) {
  const { id } = await params
  const listing = getProtoListing(id)
  if (!listing) notFound()

  return (
    <AppShell username="">
      <ProtoPdp listing={listing} backHref="/styleguide/proto" />
    </AppShell>
  )
}
