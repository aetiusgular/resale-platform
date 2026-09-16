import type { Metadata } from 'next'
import { Suspense } from 'react'
import AppShell from '@/app/components/app-shell'
import SavedClient from '@/app/saved/saved-client'
import { PROTO_FLAGS, PROTO_FOLLOWED_SELLERS, PROTO_SAVED_LISTINGS, PROTO_SAVED_SEARCHES, PROTO_SINCE_VISIT } from '@/app/proto/account-fixtures'
import { PROTO_BASE } from '@/app/proto/viewer-fixture'

export const metadata: Metadata = {
  title: 'Prototype saved',
  robots: { index: false, follow: false },
}

/** The real /saved screen (SavedClient) on fixture data — no session, no query. */
export default function ProtoSavedPage() {
  return (
    <AppShell username="">
      <Suspense>
        <SavedClient
          listings={PROTO_SAVED_LISTINGS}
          searches={PROTO_SAVED_SEARCHES}
          sellers={PROTO_FOLLOWED_SELLERS}
          sinceVisit={PROTO_SINCE_VISIT}
          followsEnabled={PROTO_FLAGS.follows}
          alertsEnabled={PROTO_FLAGS.alerts}
          protoBase={PROTO_BASE}
        />
      </Suspense>
    </AppShell>
  )
}
