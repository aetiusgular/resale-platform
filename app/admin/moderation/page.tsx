/**
 * /admin/moderation — G6 moderation console.
 * Queues over the existing trust primitives: flagged listings (listing_flags, incl. the
 * prohibited-items tiers), flagged/banned users (upheld_complaints + banned), and the
 * append-only moderation_actions audit log. One-click actions post to the moderation
 * endpoints (each admin-checked + audit-logged). Admin-only (role='admin').
 */
import Link from 'next/link'
import { redirect } from 'next/navigation'
import { createClient, createServiceClient } from '@/lib/supabase/server'
import AdminFrame, { stamp } from '../admin-frame'
import ModerationActions from './moderation-actions'
import { COLLUSION_REASON_LABEL } from '@/lib/trust/release-hold'
import { formatCents } from '@/lib/fees'

export const metadata = { title: 'Admin — Moderation', robots: { index: false, follow: false } }

type Flag = { id: string; type: string; evidence: Record<string, unknown>; created_at: string; listing_id: string }
type ListingRow = { id: string; title: string; brand: string; status: string; seller_id: string }
type UserRow = { id: string; username: string; banned: boolean; banned_reason: string | null; upheld_complaints: number; role: string }
type AuditRow = { id: string; actor_id: string | null; target_type: string; target_id: string; action: string; reason: string | null; created_at: string }
type HoldFlag = { id: string; order_id: string; buyer_id: string; seller_id: string; reasons: string[]; created_at: string }
type HoldOrder = { id: string; state: string; transfer_cents: number; transfer_hold_reason: string | null; stripe_transfer_id: string | null }
type AuthRow = { id: string; title: string; brand: string; price_cents: number; seller_id: string; authentication_reasons: string[] }

const AUTH_REASON_LABEL: Record<string, string> = { high_value: 'HIGH VALUE', flagged: 'FLAGGED' }

const FLAG_LABEL: Record<string, string> = {
  duplicate: 'DUPLICATE', keyword_stuffing: 'KEYWORD STUFFING',
  prohibited_block: 'PROHIBITED — BLOCK', prohibited_review: 'PROHIBITED — REVIEW',
}

function flagHint(f: Flag): string {
  const ev = f.evidence || {}
  const matches = ev.matches as Array<{ label?: string }> | undefined
  if (matches?.length) return matches.map((m) => m.label).filter(Boolean).join(', ')
  const violations = ev.violations as Array<{ message?: string }> | undefined
  if (violations?.length) return violations.map((v) => v.message).filter(Boolean).join('; ')
  const matched = ev.matched_listing_ids as string[] | undefined
  if (matched?.length) return `matched ${matched.length} listing(s)`
  return ''
}


export default async function ModerationConsolePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')
  const { data: me } = await supabase.from('profiles').select('role, username').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')
  const username = (me?.username as string) ?? ''

  const service = await createServiceClient()

  // 0) Held payouts (collusion) — real money parked pending review; highest priority.
  const { data: holdRows } = await service
    .from('collusion_flags')
    .select('id, order_id, buyer_id, seller_id, reasons, created_at')
    .is('resolved_at', null)
    .order('created_at', { ascending: false })
    .limit(100)
  const holds = (holdRows ?? []) as HoldFlag[]
  const holdOrderIds = holds.map((h) => h.order_id)
  const { data: holdOrderRows } = holdOrderIds.length
    ? await service.from('orders').select('id, state, transfer_cents, transfer_hold_reason, stripe_transfer_id').in('id', holdOrderIds)
    : { data: [] as HoldOrder[] }
  const holdOrderById = new Map((holdOrderRows ?? []).map((o) => [o.id as string, o as HoldOrder]))
  const holdUserIds = [...new Set(holds.flatMap((h) => [h.buyer_id, h.seller_id]))]
  const { data: holdUserRows } = holdUserIds.length
    ? await service.from('profiles').select('id, username').in('id', holdUserIds)
    : { data: [] as Array<{ id: string; username: string }> }
  const holdUserName = new Map((holdUserRows ?? []).map((pr) => [pr.id as string, pr.username as string]))

  // 0b) Authentication review queue (G5) — high-value / flagged listings awaiting a decision.
  const { data: authRows } = await service
    .from('listings')
    .select('id, title, brand, price_cents, seller_id, authentication_reasons')
    .eq('authentication_status', 'pending')
    .order('price_cents', { ascending: false })
    .limit(100)
  const authListings = (authRows ?? []) as AuthRow[]
  const authSellerIds = [...new Set(authListings.map((a) => a.seller_id))]
  const { data: authSellerRows } = authSellerIds.length
    ? await service.from('profiles').select('id, username').in('id', authSellerIds)
    : { data: [] as Array<{ id: string; username: string }> }
  const authSellerName = new Map((authSellerRows ?? []).map((pr) => [pr.id as string, pr.username as string]))

  // 1) Flagged listings — group flags by listing
  const { data: flagsRaw } = await service
    .from('listing_flags')
    .select('id, type, evidence, created_at, listing_id')
    .order('created_at', { ascending: false })
    .limit(200)
  const flags = (flagsRaw ?? []) as Flag[]
  const byListing = new Map<string, Flag[]>()
  for (const f of flags) {
    const arr = byListing.get(f.listing_id) ?? []
    arr.push(f)
    byListing.set(f.listing_id, arr)
  }
  const listingIds = [...byListing.keys()]
  const { data: lRows } = listingIds.length
    ? await service.from('listings').select('id, title, brand, status, seller_id').in('id', listingIds)
    : { data: [] as ListingRow[] }
  const listingsById = new Map((lRows ?? []).map((l) => [l.id, l as ListingRow]))
  const sellerIds = [...new Set((lRows ?? []).map((l) => (l as ListingRow).seller_id))]
  const { data: sRows } = sellerIds.length
    ? await service.from('profiles').select('id, username').in('id', sellerIds)
    : { data: [] as Array<{ id: string; username: string }> }
  const sellerName = new Map((sRows ?? []).map((p) => [p.id as string, p.username as string]))

  // 2) Flagged / banned users
  const { data: uRows } = await service
    .from('profiles')
    .select('id, username, banned, banned_reason, upheld_complaints, role')
    .or('banned.eq.true,upheld_complaints.gte.1')
    .order('upheld_complaints', { ascending: false })
    .limit(100)
  const users = (uRows ?? []) as UserRow[]

  // 3) Audit log
  const { data: aRows } = await service
    .from('moderation_actions')
    .select('id, actor_id, target_type, target_id, action, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(50)
  const audit = (aRows ?? []) as AuditRow[]
  const actorIds = [...new Set(audit.map((a) => a.actor_id).filter(Boolean) as string[])]
  const { data: actorRows } = actorIds.length
    ? await service.from('profiles').select('id, username').in('id', actorIds)
    : { data: [] as Array<{ id: string; username: string }> }
  const actorName = new Map((actorRows ?? []).map((p) => [p.id as string, p.username as string]))

  const listingCards = [...byListing.entries()]

  return (
    <AdminFrame username={username} section="moderation" title="Moderation." note={`${holds.length} HELD · ${authListings.length} AUTH · ${listingCards.length} FLAGGED · ${users.length} USERS`}>

      {/* Held payouts (collusion) */}
      <section>
        <div className="sec-head"><span className="sec-head__label">HELD PAYOUTS — {holds.length}</span><span className="page-note">REAL MONEY PARKED · HIGHEST PRIORITY</span></div>
        <p className="admin-note">
          Collusion checks parked these transfers. Releasing pays the seller and clears the flag. Refund or clawback for confirmed collusion is a separate flow.
        </p>
        {holds.length === 0 ? (
          <div className="admin-empty">NO HELD PAYOUTS</div>
        ) : (
          <div className="admin-list">
            {holds.map((h) => {
              const o = holdOrderById.get(h.order_id)
              return (
                <div key={h.id} className="admin-item admin-item--alert">
                  <div className="admin-item__head">
                    <span className="admin-item__title"><Link href={`/orders/${h.order_id}`}>ORDER {h.order_id.slice(0, 8).toUpperCase()}</Link></span>
                    <span className="admin-item__meta" style={{ color: 'var(--ink)', fontWeight: 400 }}>{formatCents(o?.transfer_cents ?? 0)} PAYOUT</span>
                    <span className="admin-item__meta">
                      BUYER <Link href={`/sellers/${holdUserName.get(h.buyer_id) ?? ''}`}>@{holdUserName.get(h.buyer_id) ?? '?'}</Link>
                      {' · '}SELLER <Link href={`/sellers/${holdUserName.get(h.seller_id) ?? ''}`}>@{holdUserName.get(h.seller_id) ?? '?'}</Link>
                    </span>
                    <div className="admin-item__right">
                      <span className="tag">{(o?.state ?? 'unknown').toUpperCase()}</span>
                      <span className="admin-item__meta">{stamp(h.created_at)}</span>
                    </div>
                  </div>
                  <div className="admin-item__body">
                    <div className="row row--wrap" style={{ gap: 6 }}>
                      {h.reasons.map((r) => (
                        <span key={r} className="tag tag--alert">{COLLUSION_REASON_LABEL[r] ?? r.toUpperCase()}</span>
                      ))}
                    </div>
                  </div>
                  <div className="admin-item__foot">
                    <ModerationActions targetType="order" targetId={h.order_id} actions={['release', 'refund']} />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Authentication review (G5) */}
      <section>
        <div className="sec-head"><span className="sec-head__label">AUTHENTICATION — {authListings.length}</span><span className="page-note">HIGH-VALUE OR FLAGGED · AWAITING A DECISION</span></div>
        {authListings.length === 0 ? (
          <div className="admin-empty">NO ITEMS AWAITING AUTHENTICATION</div>
        ) : (
          <div className="admin-list">
            {authListings.map((a) => (
              <div key={a.id} className="admin-item">
                <div className="admin-item__head">
                  <span className="admin-item__title"><Link href={`/listings/${a.id}`}>{a.title}</Link></span>
                  <span className="admin-item__meta">{a.brand.toUpperCase()} · <Link href={`/sellers/${authSellerName.get(a.seller_id) ?? ''}`}>@{authSellerName.get(a.seller_id) ?? '?'}</Link></span>
                  <div className="admin-item__right">
                    {(a.authentication_reasons ?? []).map((r) => (
                      <span key={r} className="tag">{AUTH_REASON_LABEL[r] ?? r.toUpperCase()}</span>
                    ))}
                    <span className="admin-item__meta" style={{ color: 'var(--ink)', fontWeight: 400 }}>{formatCents(a.price_cents)}</span>
                  </div>
                </div>
                <div className="admin-item__foot">
                  <ModerationActions targetType="listing" targetId={a.id} actions={['authenticate', 'reject_auth']} />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Flagged listings */}
      <section>
        <div className="sec-head"><span className="sec-head__label">FLAGGED LISTINGS — {listingCards.length}</span><span className="page-note">NEWEST FLAG FIRST</span></div>
        {listingCards.length === 0 ? (
          <div className="admin-empty">NO FLAGGED LISTINGS</div>
        ) : (
          <div className="admin-list">
            {listingCards.map(([listingId, lf]) => {
              const l = listingsById.get(listingId)
              const hasBlock = lf.some((f) => f.type === 'prohibited_block')
              return (
                <div key={listingId} className={`admin-item${hasBlock ? ' admin-item--alert' : ''}`}>
                  <div className="admin-item__head">
                    <span className="admin-item__title"><Link href={`/listings/${listingId}`}>{l?.title ?? listingId.slice(0, 8)}</Link></span>
                    <span className="admin-item__meta">{l?.brand?.toUpperCase()}{l ? <> · <Link href={`/sellers/${sellerName.get(l.seller_id) ?? ''}`}>@{sellerName.get(l.seller_id) ?? '?'}</Link></> : null}</span>
                    <div className="admin-item__right">
                      <span className="tag">{(l?.status ?? 'unknown').toUpperCase()}</span>
                    </div>
                  </div>
                  <div className="admin-item__body">
                    {lf.map((f) => (
                      <div key={f.id} className="row row--wrap" style={{ gap: 10, padding: '4px 0' }}>
                        <span className={`tag${f.type === 'prohibited_block' ? ' tag--alert' : ''}`}>{FLAG_LABEL[f.type] ?? f.type.toUpperCase()}</span>
                        <span className="admin-item__meta grow">{flagHint(f)}</span>
                        <span className="admin-item__meta">{stamp(f.created_at)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="admin-item__foot">
                    <ModerationActions
                      targetType="listing"
                      targetId={listingId}
                      actions={l?.status === 'removed' ? ['restore', 'dismiss'] : ['remove', 'dismiss']}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* Flagged / banned users */}
      <section>
        <div className="sec-head"><span className="sec-head__label">USERS — {users.length}</span><span className="page-note">BANNED OR WITH UPHELD COMPLAINTS</span></div>
        {users.length === 0 ? (
          <div className="admin-empty">NO FLAGGED USERS</div>
        ) : (
          <div className="admin-list">
            {users.map((u) => (
              <div key={u.id} className={`admin-item${u.banned ? ' admin-item--alert' : ''}`}>
                <div className="admin-item__head">
                  <span className="admin-item__title"><Link href={`/sellers/${u.username}`}>@{u.username}</Link></span>
                  {u.banned && <span className="tag tag--alert">BANNED</span>}
                  {u.role === 'admin' && <span className="tag tag--ink">ADMIN</span>}
                  <div className="admin-item__right">
                    <span className="admin-item__meta">{u.upheld_complaints} UPHELD COMPLAINT{u.upheld_complaints === 1 ? '' : 'S'}</span>
                  </div>
                </div>
                {u.banned && u.banned_reason && (
                  <div className="admin-item__body"><span className="admin-item__meta">REASON: {u.banned_reason}</span></div>
                )}
                {u.role !== 'admin' && (
                  <div className="admin-item__foot">
                    <ModerationActions targetType="user" targetId={u.id} actions={u.banned ? ['unban'] : ['ban']} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Audit log */}
      <section>
        <div className="sec-head"><span className="sec-head__label">RECENT ACTIONS — {audit.length}</span><span className="page-note">APPEND-ONLY AUDIT LOG · LAST 50</span></div>
        {audit.length === 0 ? (
          <div className="admin-empty">NO ACTIONS YET</div>
        ) : (
          <div style={{ overflowX: 'auto', paddingTop: 8 }}>
            <table className="admin-table">
              <thead>
                <tr><th>ACTION</th><th>TARGET</th><th>REASON</th><th>BY</th><th>WHEN</th></tr>
              </thead>
              <tbody>
                {audit.map((a) => (
                  <tr key={a.id}>
                    <td style={{ color: 'var(--ink)', fontWeight: 400 }}>{a.action.toUpperCase()}</td>
                    <td>{a.target_type.toUpperCase()} {a.target_id.slice(0, 8)}</td>
                    <td className="is-sans">{a.reason ? `“${a.reason}”` : '—'}</td>
                    <td>@{a.actor_id ? actorName.get(a.actor_id) ?? '?' : 'system'}</td>
                    <td>{stamp(a.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </AdminFrame>
  )
}
