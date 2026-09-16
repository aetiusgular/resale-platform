import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check } from '@phosphor-icons/react/ssr'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { formatCents } from '@/lib/fees'
import { PHOTO_SLOTS } from '@/lib/condition'
import AdminFrame from '../admin-frame'
import AdminActions from './admin-actions'
import CommentActions from './comment-actions'

export const metadata = { title: 'Admin — Review Queue', robots: { index: false, follow: false } }

interface ListingFlag {
  id: string
  type: 'duplicate' | 'keyword_stuffing'
  evidence: {
    matched_listing_ids?: string[]
    per_slot_distances?: { listing_id: string; slot: string; distance: number }[]
    violations?: { code: string; message: string }[]
  }
}

function slotLabel(slot: string): string {
  return slot.toUpperCase()
}

export default async function AdminQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role, username')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')
  const username = (profile?.username as string) ?? ''

  // Fetch flagged comments for admin queue (service_role to read flagged/removed)
  const service = await createServiceClient()
  const { data: flaggedComments } = await service
    .from('comments')
    .select(`
      id, listing_id, thread_type, body, status, redacted, pinned, created_at,
      profiles:author_id (username, tier, verified_checker),
      comment_actions (action)
    `)
    .eq('status', 'flagged')
    .order('created_at', { ascending: true })

  // Fetch pending_review listings with seller info and flags
  const { data: listings, error } = await supabase
    .from('listings')
    .select(`
      id, title, brand, category, size, condition_score,
      price_cents, images, possession_photo_url, created_at,
      seller_id,
      profiles:seller_id (username),
      listing_flags (id, type, evidence)
    `)
    .eq('status', 'pending_review')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[admin/queue] fetch error:', error)
  }

  const items = listings ?? []

  // For duplicate flags, fetch the matched listings' images so we can show comparison
  const allMatchedIds = new Set<string>()
  for (const listing of items) {
    const flags = (listing.listing_flags ?? []) as ListingFlag[]
    for (const flag of flags) {
      if (flag.type === 'duplicate' && flag.evidence?.matched_listing_ids) {
        flag.evidence.matched_listing_ids.forEach(id => allMatchedIds.add(id))
      }
    }
  }

  // Use service client to read matched listings' images (no RLS restriction needed here;
  // the admin's session could read active listings via public policy, but service client
  // avoids ambiguity for pending listings that are the match target).
  const matchedImages: Record<string, { title: string; images: string[]; possession_photo_url: string }> = {}
  if (allMatchedIds.size > 0) {
    const { data: matchedListings } = await service
      .from('listings')
      .select('id, title, images, possession_photo_url')
      .in('id', [...allMatchedIds])

    for (const ml of matchedListings ?? []) {
      matchedImages[ml.id] = {
        title: ml.title,
        images: Array.isArray(ml.images) ? ml.images : [],
        possession_photo_url: ml.possession_photo_url,
      }
    }
  }

  const comments = flaggedComments ?? []

  return (
    <AdminFrame username={username} section="queue" title="Review queue." note={`${items.length} PENDING · ${comments.length} FLAGGED COMMENTS`}>
      <div className="sec-head"><span className="sec-head__label">PENDING LISTINGS — {items.length}</span><span className="page-note">OLDEST FIRST</span></div>
      {items.length === 0 ? (
        <div className="admin-empty">QUEUE EMPTY — NOTHING WAITING ON REVIEW</div>
      ) : (
        <div className="admin-list">
          {items.map((listing) => {
            const seller = (listing.profiles as unknown) as { username: string } | null
            const images: string[] = Array.isArray(listing.images) ? listing.images : []
            const ago = new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()
            const flags = (listing.listing_flags ?? []) as ListingFlag[]
            const dupFlag = flags.find(f => f.type === 'duplicate')
            const lintFlag = flags.find(f => f.type === 'keyword_stuffing')

            return (
              <div key={listing.id} className={`admin-item${dupFlag ? ' admin-item--alert' : ''}`}>
                <div className="admin-item__head">
                  <span className="admin-item__title"><Link href={`/listings/${listing.id}`}>{listing.title}</Link></span>
                  <span className="admin-item__meta">{listing.brand.toUpperCase()} · {String(listing.category).toUpperCase()} · SIZE {String(listing.size).toUpperCase()} · CONDITION {listing.condition_score}/10</span>
                  <span className="admin-item__meta" style={{ color: 'var(--ink)', fontWeight: 400 }}>{formatCents(listing.price_cents)}</span>
                  <div className="admin-item__right">
                    {dupFlag && <span className="tag tag--alert" data-testid="flag-duplicate">DUPLICATE SUSPECT</span>}
                    {lintFlag && <span className="tag" data-testid="flag-keyword-stuffing">KEYWORD STUFFING</span>}
                    <span className="admin-item__meta"><Link href={`/sellers/${seller?.username ?? ''}`}>@{seller?.username ?? '?'}</Link> · {ago}</span>
                  </div>
                </div>

                {lintFlag && lintFlag.evidence?.violations && (
                  <div className="admin-item__body">
                    {lintFlag.evidence.violations.map((v, i) => (
                      <div key={i} className="admin-violation">! {v.message}</div>
                    ))}
                  </div>
                )}

                <div className="admin-item__body">
                  <div className="admin-photos">
                    {PHOTO_SLOTS.map((slot, idx) => {
                      const url = images[idx]
                      const isPossession = slot === 'POSSESSION'
                      return (
                        <div key={slot}>
                          <div className="admin-photo">
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={slot} />
                            ) : (
                              <span className="admin-photo__blank">—</span>
                            )}
                            {isPossession && url && <span className="admin-photo__check" aria-label="Possession photo present"><Check size={10} weight="bold" /></span>}
                          </div>
                          <span className="admin-photo__label">{slotLabel(slot)}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {dupFlag && dupFlag.evidence?.matched_listing_ids && (
                  <div className="admin-compare" data-testid="duplicate-comparison">
                    <div className="admin-compare__head">
                      DUPLICATE COMPARISON — MATCHED {dupFlag.evidence.matched_listing_ids.length} LISTING{dupFlag.evidence.matched_listing_ids.length === 1 ? '' : 'S'}
                    </div>
                    {dupFlag.evidence.matched_listing_ids.map(matchedId => {
                      const matched = matchedImages[matchedId]
                      if (!matched) return null
                      const matchedImgs: string[] = matched.images
                      const matchedSlots = new Set(
                        (dupFlag.evidence?.per_slot_distances ?? [])
                          .filter(d => d.listing_id === matchedId)
                          .map(d => d.slot)
                      )
                      return (
                        <div key={matchedId} className="admin-compare__body">
                          <div className="admin-compare__vs">VS <Link href={`/listings/${matchedId}`} style={{ textDecoration: 'underline', textUnderlineOffset: 2 }}>{matched.title}</Link> ({matchedId.slice(0, 8)}) — NEW ABOVE, EXISTING BELOW</div>
                          <div className="admin-photos">
                            {PHOTO_SLOTS.map((slot, idx) => {
                              const thisUrl = images[idx]
                              const otherUrl = slot === 'POSSESSION' ? matched.possession_photo_url : matchedImgs[idx]
                              const isMatch = matchedSlots.has(slot)
                              return (
                                <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                  <span className={`admin-photo__label${isMatch ? ' is-match' : ''}`} style={{ paddingTop: 0 }}>{slotLabel(slot)}{isMatch ? ' ⚠' : ''}</span>
                                  <div className={`admin-photo${isMatch ? ' is-match' : ''}`}>
                                    {thisUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={thisUrl} alt={`new-${slot}`} />
                                    ) : (
                                      <span className="admin-photo__blank">—</span>
                                    )}
                                  </div>
                                  <div className={`admin-photo admin-photo--dim${isMatch ? ' is-match' : ''}`}>
                                    {otherUrl ? (
                                      // eslint-disable-next-line @next/next/no-img-element
                                      <img src={otherUrl} alt={`existing-${slot}`} />
                                    ) : (
                                      <span className="admin-photo__blank">—</span>
                                    )}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                          {(dupFlag.evidence?.per_slot_distances ?? []).filter(d => d.listing_id === matchedId).map(d => (
                            <span key={`${d.listing_id}-${d.slot}`} className="admin-compare__dist">{d.slot.toUpperCase()} · DIST {d.distance}</span>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                )}

                <AdminActions listingId={listing.id} />
              </div>
            )
          })}
        </div>
      )}

      <div className="sec-head"><span className="sec-head__label">FLAGGED COMMENTS — {comments.length}</span><span className="page-note">LEGIT-CHECK THREADS</span></div>
      {comments.length === 0 ? (
        <div className="admin-empty">NO FLAGGED COMMENTS</div>
      ) : (
        <div className="admin-list">
          {comments.map((c) => {
            const author = (c.profiles as unknown) as { username: string; tier: string; verified_checker: boolean } | null
            const actions = (c.comment_actions as { action: string }[]) ?? []
            const flagCount = actions.filter(a => a.action === 'flag').length
            const agreeCount = actions.filter(a => a.action === 'agree').length
            const ago = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }).toUpperCase()

            return (
              <div key={c.id} className="admin-item admin-item--alert">
                <div className="admin-item__head">
                  <span className="admin-item__title"><Link href={`/sellers/${author?.username ?? ''}`}>@{author?.username ?? '?'}</Link></span>
                  {author?.verified_checker && <span className="tag tag--ink">VERIFIED CHECKER</span>}
                  <span className="admin-item__meta">{String(c.thread_type).toUpperCase()} THREAD · {ago}</span>
                  <div className="admin-item__right">
                    <span className="tag tag--alert">{flagCount} FLAG{flagCount !== 1 ? 'S' : ''}</span>
                    <span className="admin-item__meta">{agreeCount} AGREE</span>
                  </div>
                </div>
                <div className="admin-item__body">
                  {c.redacted ? (
                    <div>
                      <span className="body-copy body-copy--sub" style={{ textDecoration: 'line-through' }}>{c.body}</span>
                      <div className="admin-violation">LINK REMOVED — OFF-PLATFORM PAYMENT OFFERS VIOLATE POLICY</div>
                    </div>
                  ) : (
                    <p className="body-copy" style={{ margin: 0 }}>{c.body}</p>
                  )}
                </div>
                <div className="admin-item__foot">
                  <CommentActions commentId={c.id} listingId={c.listing_id} currentStatus={c.status} pinned={c.pinned} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </AdminFrame>
  )
}
