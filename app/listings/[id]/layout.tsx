import { notFound } from 'next/navigation'
import { getListing } from './get-listing'

/**
 * Existence gate for /listings/[id].
 *
 * With loading.tsx on this route the response STREAMS: the shell (status 200)
 * flushes before the page's data resolves, so notFound() inside the page can no
 * longer set a 404 status — unknown listings started returning 200 (caught by
 * e2e "listings/nonexistent returns 404"). A segment layout renders ABOVE the
 * loading boundary, before the first flush, so notFound() here still produces a
 * real HTTP 404 for browsers, bots, and curl alike.
 *
 * Cost: the shell now waits on one PK lookup (~one DB round-trip) before the
 * skeleton paints; the page reuses the same getListing() flight via cache(), so
 * total queries are unchanged. RLS makes non-active listings invisible to the
 * public here, same as the page's own check (seller/admin still pass and the
 * page enforces its role rules).
 */
export default async function ListingExistsLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const listing = await getListing(id)
  if (!listing) notFound()
  return children
}
