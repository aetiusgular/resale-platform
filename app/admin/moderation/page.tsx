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
import ModerationActions from './moderation-actions'
import { COLLUSION_REASON_LABEL } from '@/lib/trust/release-hold'
import { formatCents } from '@/lib/fees'

export const metadata = { title: 'Admin — Moderation' }

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

function ago(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) +
    ' ' + new Date(iso).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })
}

const mono = (size: number, color = 'var(--color-ink)') =>
  ({ fontFamily: 'var(--font-mono)', fontSize: `${size}px`, color } as const)

export default async function ModerationConsolePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/enter')
  const { data: me } = await supabase.from('profiles').select('role').eq('id', user.id).single()
  if (me?.role !== 'admin') redirect('/')

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
    <div style={{ background: 'var(--color-bg)', minHeight: '100vh' }}>
      <header style={{ height: '56px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: '16px', padding: '0 40px' }}>
        <Link href="/" style={{ font: '600 14px var(--font-ui)', color: 'var(--color-ink)', textDecoration: 'none' }}>←</Link>
        <span style={{ font: '600 14px var(--font-ui)', color: 'var(--color-ink)' }}>Moderation console</span>
        <Link href="/admin/queue" style={{ marginLeft: 'auto', ...mono(12, 'var(--color-ink-soft)'), textDecoration: 'none' }}>REVIEW QUEUE →</Link>
      </header>

      <div style={{ maxWidth: '1080px', margin: '0 auto', padding: '40px 40px 80px', display: 'flex', flexDirection: 'column', gap: '56px' }}>

        {/* Held payouts (collusion) */}
        <section>
          <h2 style={{ ...mono(14), fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 8px' }}>HELD PAYOUTS — {holds.length}</h2>
          <p style={{ ...mono(11, 'var(--color-ink-soft)'), margin: '0 0 20px', maxWidth: '620px', lineHeight: 1.6 }}>
            Collusion checks parked these transfers. Releasing pays the seller and clears the flag. (Refund/clawback for confirmed collusion is a separate flow.)
          </p>
          {holds.length === 0 ? (
            <div style={mono(12, 'var(--color-ink-soft)')}>NO HELD PAYOUTS</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {holds.map((h) => {
                const o = holdOrderById.get(h.order_id)
                return (
                  <div key={h.id} style={{ border: '1px solid var(--color-alert)', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                      <Link href={`/orders/${h.order_id}`} style={{ ...mono(13), fontWeight: 700, textDecoration: 'none' }}>ORDER {h.order_id.slice(0, 8)}</Link>
                      <span style={mono(12)}>{formatCents(o?.transfer_cents ?? 0)} payout</span>
                      <span style={{ ...mono(11), marginLeft: 'auto', padding: '2px 8px', border: '1px solid var(--color-line)', borderRadius: '2px', textTransform: 'uppercase' }}>{o?.state ?? 'unknown'}</span>
                    </div>
                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                      <div style={mono(11, 'var(--color-ink-soft)')}>
                        buyer <Link href={`/sellers/${holdUserName.get(h.buyer_id) ?? ''}`} style={{ ...mono(11), textDecoration: 'none' }}>@{holdUserName.get(h.buyer_id) ?? '?'}</Link>
                        {' · '}seller <Link href={`/sellers/${holdUserName.get(h.seller_id) ?? ''}`} style={{ ...mono(11), textDecoration: 'none' }}>@{holdUserName.get(h.seller_id) ?? '?'}</Link>
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                        {h.reasons.map((r) => (
                          <span key={r} style={{ ...mono(10, 'var(--color-bg)'), fontWeight: 700, padding: '2px 8px', borderRadius: '2px', background: 'var(--color-alert)' }}>
                            {COLLUSION_REASON_LABEL[r] ?? r.toUpperCase()}
                          </span>
                        ))}
                        <span style={{ ...mono(10, 'var(--color-ink-soft)'), marginLeft: 'auto' }}>{ago(h.created_at)}</span>
                      </div>
                    </div>
                    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-line)' }}>
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
          <h2 style={{ ...mono(14), fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 20px' }}>AUTHENTICATION — {authListings.length}</h2>
          {authListings.length === 0 ? (
            <div style={mono(12, 'var(--color-ink-soft)')}>NO ITEMS AWAITING AUTHENTICATION</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {authListings.map((a) => (
                <div key={a.id} style={{ border: '1px solid var(--color-line)', borderRadius: '2px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                    <Link href={`/listings/${a.id}`} style={{ ...mono(13), fontWeight: 700, textDecoration: 'none' }}>{a.title}</Link>
                    <span style={mono(12, 'var(--color-ink-soft)')}>{a.brand}</span>
                    <span style={mono(11, 'var(--color-ink-soft)')}>@{authSellerName.get(a.seller_id) ?? '?'}</span>
                    <span style={{ ...mono(12), marginLeft: 'auto' }}>{formatCents(a.price_cents)}</span>
                  </div>
                  <div style={{ padding: '12px 20px', display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'baseline' }}>
                    {(a.authentication_reasons ?? []).map((r) => (
                      <span key={r} style={{ ...mono(10, 'var(--color-bg)'), fontWeight: 700, padding: '2px 8px', borderRadius: '2px', background: 'var(--color-ink-soft)' }}>
                        {AUTH_REASON_LABEL[r] ?? r.toUpperCase()}
                      </span>
                    ))}
                  </div>
                  <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-line)' }}>
                    <ModerationActions targetType="listing" targetId={a.id} actions={['authenticate', 'reject_auth']} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Flagged listings */}
        <section>
          <h2 style={{ ...mono(14), fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 20px' }}>FLAGGED LISTINGS — {listingCards.length}</h2>
          {listingCards.length === 0 ? (
            <div style={mono(12, 'var(--color-ink-soft)')}>NO FLAGGED LISTINGS</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {listingCards.map(([listingId, lf]) => {
                const l = listingsById.get(listingId)
                const hasBlock = lf.some((f) => f.type === 'prohibited_block')
                return (
                  <div key={listingId} style={{ border: `1px solid ${hasBlock ? 'var(--color-alert)' : 'var(--color-line)'}`, borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ padding: '12px 20px', borderBottom: '1px solid var(--color-line)', display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                      <Link href={`/listings/${listingId}`} style={{ ...mono(13), fontWeight: 700, textDecoration: 'none' }}>{l?.title ?? listingId.slice(0, 8)}</Link>
                      <span style={mono(12, 'var(--color-ink-soft)')}>{l?.brand}</span>
                      <span style={mono(11, 'var(--color-ink-soft)')}>@{l ? sellerName.get(l.seller_id) ?? '?' : '?'}</span>
                      <span style={{ ...mono(11), marginLeft: 'auto', padding: '2px 8px', border: '1px solid var(--color-line)', borderRadius: '2px', textTransform: 'uppercase' }}>{l?.status ?? 'unknown'}</span>
                    </div>
                    <div style={{ padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {lf.map((f) => (
                        <div key={f.id} style={{ display: 'flex', alignItems: 'baseline', gap: '10px', flexWrap: 'wrap' }}>
                          <span style={{ ...mono(10, 'var(--color-bg)'), fontWeight: 700, padding: '2px 8px', borderRadius: '2px', background: f.type === 'prohibited_block' ? 'var(--color-alert)' : 'var(--color-ink-soft)' }}>
                            {FLAG_LABEL[f.type] ?? f.type.toUpperCase()}
                          </span>
                          <span style={mono(11, 'var(--color-ink-soft)')}>{flagHint(f)}</span>
                          <span style={{ ...mono(10, 'var(--color-ink-soft)'), marginLeft: 'auto' }}>{ago(f.created_at)}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ padding: '12px 20px', borderTop: '1px solid var(--color-line)' }}>
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
          <h2 style={{ ...mono(14), fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 20px' }}>USERS — {users.length}</h2>
          {users.length === 0 ? (
            <div style={mono(12, 'var(--color-ink-soft)')}>NO FLAGGED USERS</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {users.map((u) => (
                <div key={u.id} style={{ border: `1px solid ${u.banned ? 'var(--color-alert)' : 'var(--color-line)'}`, borderRadius: '2px', padding: '12px 20px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                    <Link href={`/sellers/${u.username}`} style={{ ...mono(13), fontWeight: 700, textDecoration: 'none' }}>@{u.username}</Link>
                    {u.banned && <span style={{ ...mono(10, 'var(--color-bg)'), fontWeight: 700, padding: '2px 8px', borderRadius: '2px', background: 'var(--color-alert)' }}>BANNED</span>}
                    {u.role === 'admin' && <span style={mono(10, 'var(--color-accent)')}>ADMIN</span>}
                    <span style={{ ...mono(11, 'var(--color-ink-soft)'), marginLeft: 'auto' }}>{u.upheld_complaints} UPHELD COMPLAINT{u.upheld_complaints === 1 ? '' : 'S'}</span>
                  </div>
                  {u.banned && u.banned_reason && <span style={mono(11, 'var(--color-ink-soft)')}>Reason: {u.banned_reason}</span>}
                  {u.role !== 'admin' && (
                    <ModerationActions targetType="user" targetId={u.id} actions={u.banned ? ['unban'] : ['ban']} />
                  )}
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Audit log */}
        <section>
          <h2 style={{ ...mono(14), fontWeight: 700, letterSpacing: '0.08em', margin: '0 0 20px' }}>RECENT ACTIONS — {audit.length}</h2>
          {audit.length === 0 ? (
            <div style={mono(12, 'var(--color-ink-soft)')}>NO ACTIONS YET</div>
          ) : (
            <div style={{ border: '1px solid var(--color-line)', borderRadius: '2px' }}>
              {audit.map((a, i) => (
                <div key={a.id} style={{ padding: '10px 16px', borderTop: i === 0 ? 'none' : '1px solid var(--color-line)', display: 'flex', alignItems: 'baseline', gap: '12px', flexWrap: 'wrap' }}>
                  <span style={{ ...mono(11, 'var(--color-ink)'), fontWeight: 700, textTransform: 'uppercase' }}>{a.action}</span>
                  <span style={mono(11, 'var(--color-ink-soft)')}>{a.target_type} {a.target_id.slice(0, 8)}</span>
                  {a.reason && <span style={mono(11, 'var(--color-ink-soft)')}>“{a.reason}”</span>}
                  <span style={{ ...mono(10, 'var(--color-ink-soft)'), marginLeft: 'auto' }}>@{a.actor_id ? actorName.get(a.actor_id) ?? '?' : 'system'} · {ago(a.created_at)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
