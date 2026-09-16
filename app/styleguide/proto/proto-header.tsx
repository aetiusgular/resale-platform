'use client'

/**
 * The signed-in header for the proto tour, mounted by ShellSwitch in place of the
 * real SiteHeader on `/styleguide/proto/**`.
 *
 * Same components and markup as the real chrome (Wordmark · HeaderSearch ·
 * HeaderActions → account / notifications popouts), fed a fixture identity so the
 * tour shows what a member sees and every link stays inside the tour.
 *
 * This is NOT auth. There is no session, no cookie and no getUser() anywhere in
 * this path — the real /saved, /sell, /messages, /settings and /orders routes keep
 * their server-side gates and still redirect guests to /enter.
 */
import { Suspense } from 'react'
import HeaderSearch from '@/app/components/header-search'
import HeaderActions from '@/app/components/header-actions'
import { Wordmark } from '@/app/components/wordmark'
import { PROTO_BASE, PROTO_NOTIFICATIONS, PROTO_UNREAD_MESSAGES, PROTO_VIEWER } from '@/app/proto/viewer-fixture'

export default function ProtoHeader() {
  return (
    <header className="header">
      <Wordmark href={PROTO_BASE} testId="proto-wordmark" />
      <Suspense fallback={<div className="search" data-mobile="hide" aria-hidden="true" />}>
        <HeaderSearch protoBase={PROTO_BASE} />
      </Suspense>
      <HeaderActions
        username={PROTO_VIEWER.username}
        displayName={PROTO_VIEWER.displayName}
        notificationsEnabled
        shippingLabelsEnabled
        proto={{ base: PROTO_BASE, notifications: PROTO_NOTIFICATIONS, messageCount: PROTO_UNREAD_MESSAGES }}
      />
    </header>
  )
}
