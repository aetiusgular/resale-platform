/**
 * /settings/review?order=<id> — "Leave a review" inside the settings shell
 * (reference: SETTINGS / ORDERS / REVIEW). LEAVE FEEDBACK → lands here.
 */
import type { Metadata } from 'next'
import SettingsShell from '../settings-shell'

export const metadata: Metadata = { title: 'Leave a review' }

interface PageProps {
  searchParams: Promise<{ order?: string }>
}

export default async function SettingsReviewPage({ searchParams }: PageProps) {
  const { order } = await searchParams
  const id = order && /^[0-9a-f-]{36}$/i.test(order) ? order : null
  return <SettingsShell section="review" reviewOrderId={id} />
}
