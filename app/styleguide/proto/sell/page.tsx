import type { Metadata } from 'next'
import AppShell from '@/app/components/app-shell'
import PrefetchLink from '@/app/components/prefetch-link'
import SellCatalog from '@/app/sell/sell-catalog'
import { PROTO_FEE_LINE, PROTO_FLAGS, PROTO_SELLER_LISTINGS } from '@/app/proto/account-fixtures'
import { PROTO_BASE } from '@/app/proto/viewer-fixture'

export const metadata: Metadata = {
  title: 'Prototype sell',
  robots: { index: false, follow: false },
}

/** The real seller catalog (SellCatalog) on fixture listings. */
export default function ProtoSellPage() {
  return (
    <AppShell username="">
      <SellCatalog
        listings={PROTO_SELLER_LISTINGS}
        feeLine={PROTO_FEE_LINE}
        bumpEnabled={PROTO_FLAGS.bump}
        boostEnabled={PROTO_FLAGS.boost}
        protoBase={PROTO_BASE}
        newListing={<PrefetchLink href={`${PROTO_BASE}/sell/new`} className="btn-primary btn-primary--inline" data-testid="new-listing">NEW LISTING +</PrefetchLink>}
      />
    </AppShell>
  )
}
