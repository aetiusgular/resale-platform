import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import { formatCents } from '@/lib/fees'
import { PHOTO_SLOTS } from '@/lib/condition'
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

export default async function AdminQueuePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')

  const { data: profile } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profile?.role !== 'admin') redirect('/')

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
    const service = await createServiceClient()
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

  return (
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <header style={{ height: '56px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 40px' }}>
        <Link href="/" style={{ font: '600 14px var(--font-ui)', color: 'var(--color-ink)', textDecoration: 'none' }}>←</Link>
        <span style={{ font: '600 14px var(--font-ui)', color: 'var(--color-ink)' }}>
          Review Queue — {items.length} pending
        </span>
        <Link href="/admin/moderation" style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)', textDecoration: 'none' }}>MODERATION →</Link>
      </header>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '40px 40px 80px' }}>
        {items.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', fontFamily: 'var(--font-mono)', fontSize: '14px', color: 'var(--color-ink-soft)' }}>
            QUEUE EMPTY
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
            {items.map((listing) => {
              const seller = (listing.profiles as unknown) as { username: string } | null
              const images: string[] = Array.isArray(listing.images) ? listing.images : []
              const ago = new Date(listing.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
              const flags = (listing.listing_flags ?? []) as ListingFlag[]
              const dupFlag = flags.find(f => f.type === 'duplicate')
              const lintFlag = flags.find(f => f.type === 'keyword_stuffing')

              return (
                <div key={listing.id} style={{ border: '1px solid var(--color-line)', borderRadius: '2px', overflow: 'hidden' }}>
                  {/* Header row */}
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'baseline', gap: '16px', flexWrap: 'wrap' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)' }}>{listing.title}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>{listing.brand} · {listing.category} · {listing.size}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink)' }}>CONDITION {listing.condition_score}/10</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', color: 'var(--color-ink)' }}>{formatCents(listing.price_cents)}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>@{seller?.username ?? '?'} · {ago}</span>
                    {/* Flag badges */}
                    {dupFlag && (
                      <span data-testid="flag-duplicate" style={{ padding: '2px 8px', background: 'var(--color-alert)', color: 'var(--color-bg)', fontFamily: 'var(--font-mono)', fontSize: '11px', borderRadius: '2px', fontWeight: 700 }}>
                        DUPLICATE SUSPECT
                      </span>
                    )}
                    {lintFlag && (
                      <span data-testid="flag-keyword-stuffing" style={{ padding: '2px 8px', background: 'var(--color-ink-soft)', color: 'var(--color-bg)', fontFamily: 'var(--font-mono)', fontSize: '11px', borderRadius: '2px', fontWeight: 700 }}>
                        KEYWORD STUFFING
                      </span>
                    )}
                  </div>

                  {/* Keyword stuffing detail */}
                  {lintFlag && lintFlag.evidence?.violations && (
                    <div style={{ padding: '10px 20px', background: 'var(--color-bg)', borderBottom: '1px solid var(--color-line)' }}>
                      {lintFlag.evidence.violations.map((v, i) => (
                        <p key={i} style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)', margin: '2px 0' }}>
                          ! {v.message}
                        </p>
                      ))}
                    </div>
                  )}

                  {/* Photos row */}
                  <div style={{ padding: '20px', display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
                    {PHOTO_SLOTS.map((slot, idx) => {
                      const url = images[idx]
                      const isPossession = slot === 'POSSESSION'
                      return (
                        <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                          <div style={{ position: 'relative', aspectRatio: '3/4', border: '1px solid var(--color-line)', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            {url ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={url} alt={slot} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                            ) : (
                              <span style={{ fontFamily: 'var(--font-mono)', fontSize: '10px', color: 'var(--color-ink-soft)' }}>—</span>
                            )}
                            {isPossession && url && (
                              <span style={{ position: 'absolute', top: '4px', left: '4px', width: '16px', height: '16px', background: 'var(--color-accent)', borderRadius: '2px', color: 'var(--color-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✓</span>
                            )}
                          </div>
                          <span style={{ font: '500 11px var(--font-ui)', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--color-ink-soft)', textAlign: 'center' }}>
                            {slot.charAt(0) + slot.slice(1).toLowerCase()}
                          </span>
                        </div>
                      )
                    })}
                  </div>

                  {/* Duplicate comparison section */}
                  {dupFlag && dupFlag.evidence?.matched_listing_ids && (
                    <div data-testid="duplicate-comparison" style={{ margin: '0 20px 20px', border: '1px solid var(--color-alert)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ padding: '8px 16px', background: 'var(--color-alert)', color: 'var(--color-bg)', fontFamily: 'var(--font-mono)', fontSize: '11px', fontWeight: 700 }}>
                        DUPLICATE COMPARISON — matched {dupFlag.evidence.matched_listing_ids.length} listing(s)
                      </div>
                      {dupFlag.evidence.matched_listing_ids.map(matchedId => {
                        const matched = matchedImages[matchedId]
                        if (!matched) return null
                        const matchedImgs: string[] = matched.images

                        // Which slots had close matches?
                        const matchedSlots = new Set(
                          (dupFlag.evidence?.per_slot_distances ?? [])
                            .filter(d => d.listing_id === matchedId)
                            .map(d => d.slot)
                        )

                        return (
                          <div key={matchedId} style={{ padding: '16px' }}>
                            <p style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)', margin: '0 0 12px' }}>
                              VS: {matched.title} <span style={{ color: 'var(--color-ink-soft)' }}>({matchedId.slice(0, 8)})</span>
                            </p>
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
                              {PHOTO_SLOTS.map((slot, idx) => {
                                const thisUrl  = images[idx]
                                const otherUrl = slot === 'POSSESSION'
                                  ? matched.possession_photo_url
                                  : matchedImgs[idx]
                                const isMatch = matchedSlots.has(slot)

                                return (
                                  <div key={slot} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: isMatch ? 'var(--color-alert)' : 'var(--color-ink-soft)', textAlign: 'center', textTransform: 'uppercase', fontWeight: isMatch ? 700 : 400 }}>
                                      {slot.charAt(0) + slot.slice(1).toLowerCase()} {isMatch ? '⚠' : ''}
                                    </span>
                                    {/* New listing photo */}
                                    <div style={{ aspectRatio: '3/4', border: `1px solid ${isMatch ? 'var(--color-alert)' : 'var(--color-line)'}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {thisUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={thisUrl} alt={`new-${slot}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                                      ) : (
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-ink-soft)' }}>—</span>
                                      )}
                                    </div>
                                    {/* Matched listing photo */}
                                    <div style={{ aspectRatio: '3/4', border: `1px solid ${isMatch ? 'var(--color-alert)' : 'var(--color-line)'}`, overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                      {otherUrl ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src={otherUrl} alt={`existing-${slot}`} style={{ width: '100%', height: '100%', objectFit: 'cover', opacity: 0.85 }} />
                                      ) : (
                                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: '9px', color: 'var(--color-ink-soft)' }}>—</span>
                                      )}
                                    </div>
                                  </div>
                                )
                              })}
                            </div>
                            {/* Per-slot distance detail */}
                            {(dupFlag.evidence?.per_slot_distances ?? []).filter(d => d.listing_id === matchedId).map(d => (
                              <span key={`${d.listing_id}-${d.slot}`} style={{ display: 'inline-block', marginRight: '8px', marginTop: '8px', fontFamily: 'var(--font-mono)', fontSize: '10px', padding: '2px 6px', background: '#fdf0f0', color: 'var(--color-alert)', borderRadius: '2px' }}>
                                {d.slot}: dist={d.distance}
                              </span>
                            ))}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {/* Actions */}
                  <AdminActions listingId={listing.id} />
                </div>
              )
            })}
          </div>
        )}

        {/* ── FLAGGED COMMENTS ──────────────────────────────────────────── */}
        <div style={{ marginTop: '64px' }}>
          <h2 style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '14px', letterSpacing: '0.08em', color: 'var(--color-ink)', margin: '0 0 24px' }}>
            FLAGGED COMMENTS — {(flaggedComments ?? []).length}
          </h2>

          {(flaggedComments ?? []).length === 0 ? (
            <div style={{ padding: '24px 0', fontFamily: 'var(--font-mono)', fontSize: '12px', color: 'var(--color-ink-soft)' }}>
              NO FLAGGED COMMENTS
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {(flaggedComments ?? []).map((c) => {
                const author = (c.profiles as unknown) as { username: string; tier: string; verified_checker: boolean } | null
                const flagCount = (c.comment_actions as { action: string }[]).filter(a => a.action === 'flag').length
                const agreeCount = (c.comment_actions as { action: string }[]).filter(a => a.action === 'agree').length
                const ago = new Date(c.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })

                return (
                  <div key={c.id} style={{ border: '1px solid var(--color-alert)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ padding: '10px 16px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap', background: 'var(--color-bg)' }}>
                      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '12px', color: 'var(--color-ink)' }}>@{author?.username ?? '?'}</span>
                      {author?.verified_checker && (
                        <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700, fontSize: '10px', letterSpacing: '0.08em', color: 'var(--color-accent)' }}>VERIFIED CHECKER</span>
                      )}
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', letterSpacing: '0.08em', color: 'var(--color-ink-soft)', textTransform: 'uppercase' }}>{c.thread_type} THREAD</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>{ago}</span>
                      <span style={{ marginLeft: 'auto', padding: '2px 8px', background: 'var(--color-alert)', color: 'var(--color-bg)', fontFamily: 'var(--font-mono)', fontSize: '10px', borderRadius: '2px', fontWeight: 700 }}>
                        {flagCount} FLAG{flagCount !== 1 ? 'S' : ''}
                      </span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--color-ink-soft)' }}>
                        {agreeCount} AGREE
                      </span>
                    </div>
                    <div style={{ padding: '12px 16px' }}>
                      {c.redacted ? (
                        <div>
                          <span style={{ fontSize: '13px', textDecoration: 'line-through', color: 'var(--color-ink-soft)' }}>{c.body}</span>
                          <div style={{ fontSize: '11px', color: 'var(--color-alert)', marginTop: '4px' }}>link removed — off-platform payment offers violate policy.</div>
                        </div>
                      ) : (
                        <span style={{ fontSize: '13px', color: 'var(--color-ink)', lineHeight: 1.6 }}>{c.body}</span>
                      )}
                    </div>
                    <div style={{ padding: '10px 16px', borderTop: '1px solid var(--color-line)' }}>
                      <CommentActions commentId={c.id} listingId={c.listing_id} currentStatus={c.status} pinned={c.pinned} />
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
